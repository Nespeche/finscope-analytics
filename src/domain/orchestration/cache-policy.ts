import cachePolicyDocument from '../../../specs/001-fundamental-analysis-platform/contracts/cache-and-refresh-policy.json';

export type CacheFreshnessBand = 'missing' | 'fresh' | 'stale_revalidatable' | 'expired';
export type RefreshTrigger = 'app_opened' | 'app_resumed' | 'manual_refresh' | 'closed_app';
export type CacheRefreshAction =
  | 'none'
  | 'fetch_submissions'
  | 'no_network'
  | 'no_background_scheduler'
  | 'preserve_last_valid_snapshot';
export type CacheDecisionReason =
  | 'closed_application'
  | 'refresh_consent_required'
  | 'cache_missing'
  | 'fresh_cache_hit'
  | 'manual_refresh_forced'
  | 'stale_revalidation_required'
  | 'expired_refresh_required'
  | 'refresh_failed_snapshot_preserved';

interface FreshnessBandAuthority {
  readonly band: 'fresh' | 'stale_revalidatable' | 'expired';
  readonly minimumAgeSeconds: number;
  readonly maximumAgeSecondsExclusive: number | null;
}

interface CachePolicyAuthority {
  readonly policyId: string;
  readonly version: string;
  readonly executionModel: string;
  readonly freshnessBands: readonly FreshnessBandAuthority[];
  readonly offlinePolicy: {
    readonly serveLastValidSnapshot: boolean;
    readonly displayStalenessWarning: boolean;
    readonly publishCandidateOnFailedRefresh: boolean;
  };
}

const authority = cachePolicyDocument as CachePolicyAuthority;
const freshAuthority = authority.freshnessBands.find((entry) => entry.band === 'fresh');
const staleAuthority = authority.freshnessBands.find((entry) => entry.band === 'stale_revalidatable');
const expiredAuthority = authority.freshnessBands.find((entry) => entry.band === 'expired');

if (
  authority.policyId !== 'cache-and-refresh-policy'
  || authority.executionModel !== 'foreground_on_open_or_resume'
  || freshAuthority?.minimumAgeSeconds !== 0
  || freshAuthority.maximumAgeSecondsExclusive !== 21_600
  || staleAuthority?.minimumAgeSeconds !== 21_600
  || staleAuthority.maximumAgeSecondsExclusive !== 604_800
  || expiredAuthority?.minimumAgeSeconds !== 604_800
  || expiredAuthority.maximumAgeSecondsExclusive !== null
  || !authority.offlinePolicy.serveLastValidSnapshot
  || !authority.offlinePolicy.displayStalenessWarning
  || authority.offlinePolicy.publishCandidateOnFailedRefresh
) {
  throw new Error('CACHE_REFRESH_AUTHORITY_MISMATCH');
}

export const CACHE_REFRESH_POLICY_VERSION = authority.version;
export const CACHE_FRESH_MAX_AGE_SECONDS = 21_600 as const;
export const CACHE_STALE_MAX_AGE_SECONDS = 604_800 as const;

export interface CacheRefreshDecisionInput {
  readonly trigger: RefreshTrigger;
  readonly refreshConsent: boolean;
  readonly hasSnapshot: boolean;
  readonly ageSeconds?: number;
}

export interface CacheRefreshDecision {
  readonly band: CacheFreshnessBand;
  readonly action: CacheRefreshAction;
  readonly reasonCode: CacheDecisionReason;
  readonly shouldFetchSubmissions: boolean;
  readonly shouldStartBackgroundScheduler: false;
  readonly preserveLastValidSnapshotOnFailure: boolean;
  readonly displayStalenessWarning: boolean;
}

export interface RefreshFailureResolution {
  readonly band: CacheFreshnessBand;
  readonly action: 'preserve_last_valid_snapshot';
  readonly reasonCode: 'refresh_failed_snapshot_preserved';
  readonly publishCandidate: false;
  readonly activeSnapshotPreserved: true;
  readonly displayStalenessWarning: true;
}

function assertAge(ageSeconds: number | undefined, hasSnapshot: boolean): number {
  if (!hasSnapshot) return 0;
  if (ageSeconds === undefined || !Number.isInteger(ageSeconds) || ageSeconds < 0) {
    throw new TypeError('CACHE_AGE_SECONDS_MUST_BE_A_NON_NEGATIVE_INTEGER');
  }
  return ageSeconds;
}

export function classifyCacheFreshness(ageSeconds: number): Exclude<CacheFreshnessBand, 'missing'> {
  if (!Number.isInteger(ageSeconds) || ageSeconds < 0) {
    throw new TypeError('CACHE_AGE_SECONDS_MUST_BE_A_NON_NEGATIVE_INTEGER');
  }
  if (ageSeconds < CACHE_FRESH_MAX_AGE_SECONDS) return 'fresh';
  if (ageSeconds < CACHE_STALE_MAX_AGE_SECONDS) return 'stale_revalidatable';
  return 'expired';
}

function frozenDecision(
  band: CacheFreshnessBand,
  action: CacheRefreshAction,
  reasonCode: CacheDecisionReason,
  shouldFetchSubmissions: boolean,
): CacheRefreshDecision {
  return Object.freeze({
    band,
    action,
    reasonCode,
    shouldFetchSubmissions,
    shouldStartBackgroundScheduler: false as const,
    preserveLastValidSnapshotOnFailure: true,
    displayStalenessWarning: band === 'stale_revalidatable' || band === 'expired',
  });
}

/** Resolves the foreground cache decision before any SEC request is issued. */
export function decideCacheRefresh(input: CacheRefreshDecisionInput): CacheRefreshDecision {
  const ageSeconds = assertAge(input.ageSeconds, input.hasSnapshot);
  const band: CacheFreshnessBand = input.hasSnapshot
    ? classifyCacheFreshness(ageSeconds)
    : 'missing';

  if (input.trigger === 'closed_app') {
    return frozenDecision(band, 'no_background_scheduler', 'closed_application', false);
  }
  if (!input.refreshConsent) {
    return frozenDecision(band, 'no_network', 'refresh_consent_required', false);
  }
  if (band === 'missing') {
    return frozenDecision(band, 'fetch_submissions', 'cache_missing', true);
  }
  if (input.trigger === 'manual_refresh') {
    return frozenDecision(band, 'fetch_submissions', 'manual_refresh_forced', true);
  }
  if (band === 'fresh') {
    return frozenDecision(band, 'none', 'fresh_cache_hit', false);
  }
  if (band === 'stale_revalidatable') {
    return frozenDecision(band, 'fetch_submissions', 'stale_revalidation_required', true);
  }
  return frozenDecision(band, 'fetch_submissions', 'expired_refresh_required', true);
}

/** Applies the mandatory rollback rule after a failed stale/expired refresh. */
export function preserveSnapshotAfterRefreshFailure(
  decision: CacheRefreshDecision,
): RefreshFailureResolution {
  if (decision.band !== 'stale_revalidatable' && decision.band !== 'expired') {
    throw new TypeError('SNAPSHOT_PRESERVATION_REQUIRES_STALE_OR_EXPIRED_CACHE');
  }
  if (!decision.preserveLastValidSnapshotOnFailure) {
    throw new Error('CACHE_POLICY_FORBIDS_SNAPSHOT_PRESERVATION');
  }
  return Object.freeze({
    band: decision.band,
    action: 'preserve_last_valid_snapshot' as const,
    reasonCode: 'refresh_failed_snapshot_preserved' as const,
    publishCandidate: false as const,
    activeSnapshotPreserved: true as const,
    displayStalenessWarning: true as const,
  });
}
