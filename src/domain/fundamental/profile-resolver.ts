import profileCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json';
import metricCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import mappingCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json';
import type { AccountingStandard, EntityType } from '../model';

export type ProfileSupportState = 'supported' | 'unsupported';
export type CapabilityState = 'eligible' | 'not_applicable';

export interface AccountingProfileDefinition {
  readonly accountingStandard: AccountingStandard;
  readonly conceptAllowlist: readonly string[];
  readonly metricAllowlist: readonly string[];
  readonly profileId: string;
  readonly profilePriority: number;
  readonly status: 'ACTIVE_FULL' | 'ACTIVE_LIMITED' | 'ACTIVE_DEGRADED';
  readonly unsupportedBehavior: string;
}

export interface ProfileCapability {
  readonly id: string;
  readonly state: CapabilityState;
  readonly reasonCode?: 'profile_not_allowlisted' | 'unsupported_profile';
}

export interface ProfileResolution {
  readonly profile: AccountingProfileDefinition;
  readonly supportState: ProfileSupportState;
  readonly pipelineState: 'ready' | 'partial';
  readonly concepts: readonly ProfileCapability[];
  readonly metrics: readonly ProfileCapability[];
  readonly limitations: readonly string[];
}

const catalog = profileCatalogJson as unknown as {
  readonly profiles: readonly AccountingProfileDefinition[];
};
const metricCatalog = metricCatalogJson as unknown as {
  readonly metrics: readonly { readonly class: string; readonly metricId: string }[];
};
const mappingCatalog = mappingCatalogJson as unknown as {
  readonly mappings: readonly { readonly canonicalConceptId: string }[];
  readonly debtPolicy: { readonly buckets: readonly string[] } & Record<string, unknown>;
};

export const ACCOUNTING_PROFILES = Object.freeze([...catalog.profiles]);

const PROFILE_BY_ID = new Map(ACCOUNTING_PROFILES.map((profile) => [profile.profileId, profile] as const));
const ALL_FUNDAMENTAL_METRICS = Object.freeze(metricCatalog.metrics
  .filter((metric) => metric.class === 'fundamental')
  .map((metric) => metric.metricId));
const ALL_CANONICAL_CONCEPTS = Object.freeze([...new Set([
  ...mappingCatalog.mappings.map((mapping) => mapping.canonicalConceptId),
  ...mappingCatalog.debtPolicy.buckets,
])].sort((left, right) => left.localeCompare(right, 'en')));

function profileIdFor(accountingStandard: AccountingStandard, entityType: EntityType): string {
  if (accountingStandard === 'unknown' || entityType === 'unknown') return 'unsupported_profile';
  if (accountingStandard === 'ifrs') {
    return entityType === 'operating_company'
      ? 'general_operating_ifrs_limited'
      : 'unsupported_profile';
  }
  switch (entityType) {
    case 'operating_company': return 'general_operating_us_gaap';
    case 'financial_institution': return 'financial_institution_limited';
    case 'insurance': return 'insurance_limited';
    case 'reit': return 'reit_limited';
  }
}

function capabilityList(
  universe: readonly string[],
  allowlist: readonly string[],
  unsupported: boolean,
): readonly ProfileCapability[] {
  const allowed = new Set(allowlist);
  return Object.freeze(universe.map((id): ProfileCapability => {
    if (allowed.has(id)) return Object.freeze({ id, state: 'eligible' as const });
    return Object.freeze({
      id,
      state: 'not_applicable' as const,
      reasonCode: unsupported ? 'unsupported_profile' as const : 'profile_not_allowlisted' as const,
    });
  }));
}

/** Selects one catalog profile from exact accounting-standard/entity-type inputs. */
export function resolveAccountingProfile(input: Readonly<{
  accountingStandard: AccountingStandard;
  entityType: EntityType;
}>): ProfileResolution {
  const profileId = profileIdFor(input.accountingStandard, input.entityType);
  const profile = PROFILE_BY_ID.get(profileId);
  if (profile === undefined) throw new Error(`PROFILE_CATALOG_ENTRY_MISSING:${profileId}`);
  const unsupported = profile.profileId === 'unsupported_profile';

  return Object.freeze({
    profile: Object.freeze({ ...profile }),
    supportState: unsupported ? 'unsupported' as const : 'supported' as const,
    pipelineState: unsupported ? 'partial' as const : 'ready' as const,
    concepts: capabilityList(ALL_CANONICAL_CONCEPTS, profile.conceptAllowlist, unsupported),
    metrics: capabilityList(ALL_FUNDAMENTAL_METRICS, profile.metricAllowlist, unsupported),
    limitations: Object.freeze(unsupported
      ? ['unsupported_profile', 'identity_filings_and_evidence_preserved', 'all_fundamental_metrics_not_applicable']
      : profile.status === 'ACTIVE_LIMITED' ? ['profile_limited_to_explicit_allowlists'] : []),
  });
}

export function getProfileCapability(
  resolution: ProfileResolution,
  kind: 'concept' | 'metric',
  id: string,
): ProfileCapability {
  const capability = (kind === 'concept' ? resolution.concepts : resolution.metrics)
    .find((candidate) => candidate.id === id);
  return capability ?? Object.freeze({
    id,
    state: 'not_applicable' as const,
    reasonCode: resolution.supportState === 'unsupported'
      ? 'unsupported_profile' as const
      : 'profile_not_allowlisted' as const,
  });
}
