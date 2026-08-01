import { canonicalJsonBytes, type JsonObject } from '../../core/canonical-json';
import { sha256Digest, type Sha256Digest } from '../../core/sha256';
import {
  assertCapabilityDisposition,
  type BlockedOperation,
  type Capability,
  type CapabilityDisposition,
} from '../../domain/orchestration/capabilities';
import {
  CACHE_REFRESH_POLICY_VERSION,
  decideCacheRefresh,
  type CacheRefreshDecision,
} from '../../domain/orchestration/cache-policy';
import {
  resolveRefreshDegradation,
  type RefreshFailureReasonCode,
  type RefreshRecoveryAction,
} from '../../domain/orchestration/degradation';
import {
  createIdempotencyKey,
  IdempotentOperationCoordinator,
  IncompatibleIssuerOperationError,
  type AcquisitionType,
} from '../../domain/orchestration/idempotency';
import {
  buildInvalidationPlan,
  type InvalidationDependencies,
  type InvalidationEvent,
  type InvalidationPlan,
} from '../../domain/orchestration/invalidation-graph';
import {
  computeSubmissionsNoveltyFingerprint,
  decideCompanyFactsFetch,
  type SubmissionNoveltyRecord,
} from '../../domain/orchestration/novelty';
import {
  OperationQuotaGuard,
  type OperationQuotaSnapshot,
  type QuotaStopReason,
} from '../../gateway/quota-state';
import {
  executeWithRetry,
  isRetryableHttpStatus,
  type ExecuteWithRetryResult,
  type RetryAttemptResult,
  type RetryFailureReason,
} from '../../gateway/retry-policy';
import { createConsentRepository, type ConsentRepository } from '../../persistence/consent-repository';

interface AppPluginContext {
  readonly document: Document;
  readonly window: Window;
}

type AppPluginCleanup = () => void;

export const pluginId = 'resume-refresh';
export const order = 20;
export const VISUAL_PREFERENCE_EVENT = 'finscope:visual-preference-changed';

const DEFAULT_ISSUER_CIK = '0000320193';
const DEFAULT_ACTIVE_SNAPSHOT_ID = 'snapshot-0000320193-active';
const FULL_SNAPSHOT_CAPABILITIES = Object.freeze([
  'issuer_identity',
  'filings',
  'fundamentals',
  'insights',
  'local_snapshot',
  'evidence',
  'definitions',
  'mappings',
] as const satisfies readonly Capability[]);
const DEGRADED_SNAPSHOT_CAPABILITIES = Object.freeze([
  'issuer_identity',
  'local_snapshot',
  'definitions',
  'mappings',
  'evidence',
] as const satisfies readonly Capability[]);
const ACQUISITION_BLOCKED_CAPABILITIES = Object.freeze([
  'filings',
  'fundamentals',
  'insights',
] as const satisfies readonly Capability[]);

export type RefreshPipelineState =
  | 'idle'
  | 'checking'
  | 'acquiring'
  | 'normalizing'
  | 'analyzing'
  | 'ready'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type AppRefreshTrigger = 'app_opened' | 'app_resumed' | 'manual_refresh';

export interface LocalSnapshotConfiguration {
  readonly issuerCik: string;
  readonly activeSnapshotId: string;
  readonly ageSeconds: number;
  readonly submissionsFingerprint?: Sha256Digest;
  readonly activePointerGeneration?: number;
}

export interface RefreshInvalidationInput {
  readonly event: InvalidationEvent;
  readonly changedConceptIds?: readonly string[];
  readonly changedMetricIds?: readonly string[];
  readonly changedRuleIds?: readonly string[];
  readonly dependencies?: InvalidationDependencies;
}

export interface RefreshRuntimeSnapshot {
  readonly state: RefreshPipelineState;
  readonly trigger: AppRefreshTrigger | null;
  readonly refreshConsent: boolean;
  readonly foregroundActive: boolean;
  readonly pluginInstallationCount: number;
  readonly issuerCik: string;
  readonly activeSnapshotId: string;
  readonly activePointerGeneration: number;
  readonly activeOperationId: string | null;
  readonly operationCount: number;
  readonly candidateCount: number;
  readonly networkCallCount: number;
  readonly cacheAgeSeconds: number;
  readonly statusMessage: string;
  readonly lastReasonCode: string | null;
  readonly recoveryActions: readonly RefreshRecoveryAction[];
  readonly preservedCapabilities: readonly Capability[];
  readonly blockedCapabilities: readonly Capability[];
  readonly blockedOperations: readonly BlockedOperation[];
  readonly quota: OperationQuotaSnapshot | null;
  readonly lastInvalidationPlan: InvalidationPlan | null;
}

export type RefreshRequestStatus =
  | 'closed'
  | 'local_only'
  | 'no_refresh_needed'
  | 'completed'
  | 'coalesced'
  | 'replayed'
  | 'failed'
  | 'cancelled'
  | 'busy';

export interface RefreshRequestResult {
  readonly status: RefreshRequestStatus;
  readonly snapshot: RefreshRuntimeSnapshot;
}

interface FetchedResource {
  readonly payload: unknown;
  readonly payloadDigest: Sha256Digest;
}

interface RefreshCandidate {
  readonly activeSnapshotId: string;
  readonly submissionsFingerprint: Sha256Digest;
  readonly companyFactsFetched: boolean;
  readonly changed: boolean;
}

interface RunCandidateInput {
  readonly trigger: AppRefreshTrigger;
  readonly manualRefresh: boolean;
  readonly decision: CacheRefreshDecision;
}

class RefreshOperationError extends Error {
  constructor(
    readonly reasonCode: RefreshFailureReasonCode,
    readonly quotaSnapshot: OperationQuotaSnapshot | undefined,
  ) {
    super(`Refresh operation stopped: ${reasonCode}`);
    this.name = 'RefreshOperationError';
  }
}

function requireCik(value: string): string {
  if (!/^\d{10}$/u.test(value)) throw new TypeError('INVALID_REFRESH_CIK');
  return value;
}

function requireNonEmpty(value: string, code: string): string {
  if (value.length === 0) throw new TypeError(code);
  return value;
}

function requireAgeSeconds(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError('REFRESH_CACHE_AGE_MUST_BE_A_NON_NEGATIVE_INTEGER');
  }
  return value;
}

function requirePointerGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('REFRESH_POINTER_GENERATION_MUST_BE_A_NON_NEGATIVE_INTEGER');
  }
  return value;
}

function asObject(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.filter((entry): entry is string => typeof entry === 'string'));
}

function extractSubmissionRecords(payload: unknown): readonly SubmissionNoveltyRecord[] {
  const envelope = asObject(payload);
  const source = asObject(envelope?.payload) ?? envelope;
  const filings = asObject(source?.filings);
  const recent = asObject(filings?.recent);
  if (recent === undefined) return Object.freeze([]);

  const accessionNumbers = stringArray(recent.accessionNumber);
  const forms = stringArray(recent.form);
  const filingDates = stringArray(recent.filingDate);
  const reportDates = stringArray(recent.reportDate);
  const primaryDocuments = stringArray(recent.primaryDocument);
  const count = Math.min(
    accessionNumbers.length,
    forms.length,
    filingDates.length,
    reportDates.length,
    primaryDocuments.length,
  );
  const records: SubmissionNoveltyRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const accessionNumber = accessionNumbers[index];
    const form = forms[index];
    const filingDate = filingDates[index];
    const reportDate = reportDates[index];
    const primaryDocument = primaryDocuments[index];
    if (
      accessionNumber === undefined
      || form === undefined
      || filingDate === undefined
      || reportDate === undefined
      || primaryDocument === undefined
      || accessionNumber.length === 0
      || form.length === 0
      || filingDate.length === 0
      || reportDate.length === 0
      || primaryDocument.length === 0
    ) {
      continue;
    }
    records.push(Object.freeze({ accessionNumber, form, filingDate, reportDate, primaryDocument }));
  }
  return Object.freeze(records);
}

function responseFailureReason(status: number): RetryFailureReason {
  if (status === 504) return 'upstream_timeout';
  if (status === 502 || status === 503 || status === 429 || status === 408 || status === 500) {
    return 'provider_unavailable';
  }
  return 'non_retryable_failure';
}

function degradationReason(
  reason: RetryFailureReason | QuotaStopReason | 'retry_exhausted',
): RefreshFailureReasonCode {
  switch (reason) {
    case 'request_timeout':
      return 'request_timeout';
    case 'provider_unavailable':
    case 'non_retryable_failure':
      return 'provider_unavailable';
    case 'upstream_timeout':
      return 'upstream_timeout';
    case 'invalid_payload':
      return 'invalid_payload';
    case 'retry_exhausted':
      return 'retry_exhausted';
    case 'quota_exhausted':
    case 'nonessential_refresh_stopped':
      return 'quota_exhausted';
    case 'operation_timeout':
      return 'operation_timeout';
    case 'operation_cancelled':
      return 'cancelled';
  }
}

function requestStatusForFailure(reason: RefreshFailureReasonCode): 'failed' | 'cancelled' {
  return reason === 'cancelled' ? 'cancelled' : 'failed';
}

function frozenCapabilities(values: readonly Capability[]): readonly Capability[] {
  return Object.freeze([...values]);
}

function frozenOperations(values: readonly BlockedOperation[]): readonly BlockedOperation[] {
  return Object.freeze([...values]);
}

function errorStatusMessage(reasonCode: RefreshFailureReasonCode): string {
  switch (reasonCode) {
    case 'cancelled':
      return 'Refresh cancelled. The previous active snapshot and pointer were preserved.';
    case 'quota_exhausted':
      return 'Refresh stopped by the operation quota. The previous active snapshot remains available.';
    case 'retry_exhausted':
      return 'Refresh retries were exhausted. The previous active snapshot remains available.';
    case 'request_timeout':
    case 'operation_timeout':
    case 'upstream_timeout':
      return 'Refresh timed out. The previous active snapshot remains available.';
    case 'provider_unavailable':
      return 'The SEC gateway is unavailable. The previous active snapshot remains available.';
    case 'invalid_payload':
      return 'The SEC response was invalid. The previous active snapshot remains available.';
    case 'quality_gate_failed':
      return 'The refreshed candidate did not pass quality checks. The previous snapshot remains active.';
  }
}

export class RefreshRuntime {
  #consentRepository: ConsentRepository = createConsentRepository();
  #coordinator = new IdempotentOperationCoordinator<RefreshCandidate>();
  readonly #listeners = new Set<(snapshot: RefreshRuntimeSnapshot) => void>();
  #context: AppPluginContext | undefined;
  #foregroundActive = false;
  #closedByPageHide = false;
  #pluginInstallationCount = 0;
  #state: RefreshPipelineState = 'ready';
  #trigger: AppRefreshTrigger | null = null;
  #issuerCik = DEFAULT_ISSUER_CIK;
  #activeSnapshotId = DEFAULT_ACTIVE_SNAPSHOT_ID;
  #activePointerGeneration = 1;
  #cacheAgeSeconds = 0;
  #submissionsFingerprint: Sha256Digest | undefined;
  #dependentAuthorityChanged = false;
  #activeOperationId: string | null = null;
  #activeController: AbortController | undefined;
  #activeGuard: OperationQuotaGuard | undefined;
  #operationCount = 0;
  #candidateCount = 0;
  #networkCallCount = 0;
  #statusMessage = 'Active local snapshot loaded. Refresh consent is off.';
  #lastReasonCode: string | null = null;
  #recoveryActions: readonly RefreshRecoveryAction[] = Object.freeze([]);
  #preservedCapabilities: readonly Capability[] = FULL_SNAPSHOT_CAPABILITIES;
  #blockedCapabilities: readonly Capability[] = Object.freeze([]);
  #blockedOperations: readonly BlockedOperation[] = Object.freeze([]);
  #quota: OperationQuotaSnapshot | null = null;
  #lastInvalidationPlan: InvalidationPlan | null = null;

  snapshot(): RefreshRuntimeSnapshot {
    const disposition: CapabilityDisposition = {
      preservedCapabilities: this.#preservedCapabilities,
      blockedCapabilities: this.#blockedCapabilities,
      blockedOperations: this.#blockedOperations,
    };
    assertCapabilityDisposition(disposition);
    return Object.freeze({
      state: this.#state,
      trigger: this.#trigger,
      refreshConsent: this.#consentRepository.read('refreshConsent').granted,
      foregroundActive: this.#foregroundActive && !this.#closedByPageHide,
      pluginInstallationCount: this.#pluginInstallationCount,
      issuerCik: this.#issuerCik,
      activeSnapshotId: this.#activeSnapshotId,
      activePointerGeneration: this.#activePointerGeneration,
      activeOperationId: this.#activeOperationId,
      operationCount: this.#operationCount,
      candidateCount: this.#candidateCount,
      networkCallCount: this.#networkCallCount,
      cacheAgeSeconds: this.#cacheAgeSeconds,
      statusMessage: this.#statusMessage,
      lastReasonCode: this.#lastReasonCode,
      recoveryActions: Object.freeze([...this.#recoveryActions]),
      preservedCapabilities: frozenCapabilities(this.#preservedCapabilities),
      blockedCapabilities: frozenCapabilities(this.#blockedCapabilities),
      blockedOperations: frozenOperations(this.#blockedOperations),
      quota: this.#quota,
      lastInvalidationPlan: this.#lastInvalidationPlan,
    });
  }

  subscribe(listener: (snapshot: RefreshRuntimeSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.#listeners.delete(listener);
    };
  }

  attach(context: AppPluginContext): void {
    this.#context = context;
    this.#foregroundActive = true;
    this.#closedByPageHide = false;
    this.#pluginInstallationCount += 1;
    this.#emit();
  }

  detach(context: AppPluginContext): void {
    if (this.#context?.document !== context.document) return;
    this.#foregroundActive = false;
    this.#closedByPageHide = true;
    this.cancelActiveOperation('application_closed');
    this.#context = undefined;
    this.#emit();
  }

  markPageHidden(): void {
    this.#foregroundActive = false;
    this.#closedByPageHide = true;
    this.cancelActiveOperation('application_closed');
    this.#emit();
  }

  markPageShown(): void {
    this.#foregroundActive = true;
    this.#closedByPageHide = false;
    this.#emit();
  }

  setRefreshConsent(granted: boolean): void {
    this.#consentRepository.set('refreshConsent', granted);
    if (!granted) {
      this.cancelActiveOperation('refresh_consent_revoked');
      this.#statusMessage = 'Refresh consent is off. The active local snapshot remains available.';
    } else {
      this.#statusMessage = 'Refresh consent is on. Open, resume, and manual checks still use cache and quota guards.';
    }
    this.#emit();
  }

  configureLocalSnapshot(input: LocalSnapshotConfiguration): void {
    this.#issuerCik = requireCik(input.issuerCik);
    this.#activeSnapshotId = requireNonEmpty(input.activeSnapshotId, 'EMPTY_ACTIVE_SNAPSHOT_ID');
    this.#cacheAgeSeconds = requireAgeSeconds(input.ageSeconds);
    this.#submissionsFingerprint = input.submissionsFingerprint;
    this.#activePointerGeneration = requirePointerGeneration(input.activePointerGeneration ?? 1);
    this.#state = 'ready';
    this.#lastReasonCode = null;
    this.#recoveryActions = Object.freeze([]);
    this.#setFullSnapshotCapabilities();
    this.#statusMessage = `Active local snapshot ${this.#activeSnapshotId} configured for ${this.#issuerCik}.`;
    this.#emit();
  }

  setCacheAgeSeconds(ageSeconds: number): void {
    this.#cacheAgeSeconds = requireAgeSeconds(ageSeconds);
    this.#emit();
  }

  setDependentAuthorityChanged(changed: boolean): void {
    this.#dependentAuthorityChanged = changed;
    this.#emit();
  }

  processInvalidation(input: RefreshInvalidationInput): InvalidationPlan {
    const plan = buildInvalidationPlan({
      event: input.event,
      refreshConsent: this.#consentRepository.read('refreshConsent').granted,
      ...(input.changedConceptIds === undefined ? {} : { changedConceptIds: input.changedConceptIds }),
      ...(input.changedMetricIds === undefined ? {} : { changedMetricIds: input.changedMetricIds }),
      ...(input.changedRuleIds === undefined ? {} : { changedRuleIds: input.changedRuleIds }),
      ...(input.dependencies === undefined ? {} : { dependencies: input.dependencies }),
    });
    this.#lastInvalidationPlan = plan;
    this.#statusMessage = plan.domainWorkStarted
      ? `Incremental invalidation planned: ${plan.affectedStages.join(', ')}.`
      : plan.networkWorkStarted
        ? 'Incremental invalidation requires a network acquisition.'
        : 'Visual preference change affected rendering only; no domain work started.';
    this.#emit();
    return plan;
  }

  async requestLifecycleRefresh(
    trigger: Exclude<AppRefreshTrigger, 'manual_refresh'>,
  ): Promise<RefreshRequestResult> {
    return this.#requestRefresh(trigger, false);
  }

  async requestManualRefresh(): Promise<RefreshRequestResult> {
    return this.#requestRefresh('manual_refresh', true);
  }

  cancelActiveOperation(reason = 'user_requested'): void {
    if (this.#activeController === undefined) return;
    const quotaSnapshot = this.#activeGuard?.snapshot();
    this.#activeGuard?.cancel();
    this.#activeController.abort(reason);
    if (reason === 'user_requested') {
      this.#applyDegradation('cancelled', quotaSnapshot);
      return;
    }
    this.#statusMessage = 'Cancelling the active refresh. The current snapshot remains selected.';
    this.#emit();
  }

  useLastSnapshot(): void {
    this.#state = 'ready';
    this.#trigger = null;
    this.#lastReasonCode = null;
    this.#recoveryActions = Object.freeze([]);
    this.#setFullSnapshotCapabilities();
    this.#statusMessage = `Using preserved snapshot ${this.#activeSnapshotId}.`;
    this.#emit();
  }

  resetForTesting(): void {
    this.cancelActiveOperation('test_reset');
    this.#consentRepository = createConsentRepository();
    this.#coordinator = new IdempotentOperationCoordinator<RefreshCandidate>();
    this.#state = 'ready';
    this.#trigger = null;
    this.#issuerCik = DEFAULT_ISSUER_CIK;
    this.#activeSnapshotId = DEFAULT_ACTIVE_SNAPSHOT_ID;
    this.#activePointerGeneration = 1;
    this.#cacheAgeSeconds = 0;
    this.#submissionsFingerprint = undefined;
    this.#dependentAuthorityChanged = false;
    this.#activeOperationId = null;
    this.#activeController = undefined;
    this.#activeGuard = undefined;
    this.#operationCount = 0;
    this.#candidateCount = 0;
    this.#networkCallCount = 0;
    this.#statusMessage = 'Active local snapshot loaded. Refresh consent is off.';
    this.#lastReasonCode = null;
    this.#recoveryActions = Object.freeze([]);
    this.#quota = null;
    this.#lastInvalidationPlan = null;
    this.#setFullSnapshotCapabilities();
    this.#emit();
  }

  async #requestRefresh(
    trigger: AppRefreshTrigger,
    manualRefresh: boolean,
  ): Promise<RefreshRequestResult> {
    this.#trigger = trigger;
    if (!this.#canRunForegroundWork()) {
      const decision = decideCacheRefresh({
        trigger: 'closed_app',
        refreshConsent: this.#consentRepository.read('refreshConsent').granted,
        hasSnapshot: true,
        ageSeconds: this.#cacheAgeSeconds,
      });
      this.#statusMessage = 'The application is closed or hidden from execution; no refresh work started.';
      this.#lastReasonCode = decision.reasonCode;
      this.#emit();
      return this.#result('closed');
    }

    const consentResult = await this.#consentRepository.runLifecycleRefresh(async () => {
      const decision = decideCacheRefresh({
        trigger,
        refreshConsent: true,
        hasSnapshot: true,
        ageSeconds: this.#cacheAgeSeconds,
      });
      if (!decision.shouldFetchSubmissions) {
        this.#state = 'ready';
        this.#lastReasonCode = decision.reasonCode;
        this.#recoveryActions = Object.freeze([]);
        this.#setFullSnapshotCapabilities();
        this.#statusMessage = decision.reasonCode === 'fresh_cache_hit'
          ? 'The local snapshot is fresh; no network request was made.'
          : 'The active local snapshot was used without a network request.';
        this.#emit();
        return this.#result('no_refresh_needed');
      }
      return this.#runIdempotentRefresh({ trigger, manualRefresh, decision });
    });

    if (consentResult.mode === 'local_only') {
      const decision = decideCacheRefresh({
        trigger,
        refreshConsent: false,
        hasSnapshot: true,
        ageSeconds: this.#cacheAgeSeconds,
      });
      this.#state = 'ready';
      this.#lastReasonCode = decision.reasonCode;
      this.#recoveryActions = Object.freeze([]);
      this.#setFullSnapshotCapabilities();
      this.#statusMessage = manualRefresh
        ? 'Refresh consent is required before the manual SEC check can start.'
        : 'Refresh consent is off; the active local snapshot was rendered with zero network calls.';
      this.#emit();
      return this.#result('local_only');
    }
    return consentResult.value;
  }

  async #runIdempotentRefresh(input: RunCandidateInput): Promise<RefreshRequestResult> {
    const acquisitionType: AcquisitionType = input.manualRefresh ? 'manual_refresh' : 'open_or_resume';
    const idempotencyKey = await createIdempotencyKey({
      cik: this.#issuerCik,
      acquisitionType,
      policyVersion: CACHE_REFRESH_POLICY_VERSION,
    });
    const evidenceFingerprint = await sha256Digest(canonicalJsonBytes({
      issuerCik: this.#issuerCik,
      acquisitionType,
      policyVersion: CACHE_REFRESH_POLICY_VERSION,
      activeSnapshotId: this.#activeSnapshotId,
      activePointerGeneration: this.#activePointerGeneration,
      cacheBand: input.decision.band,
      previousSubmissionsFingerprint: this.#submissionsFingerprint ?? null,
      dependentAuthorityChanged: this.#dependentAuthorityChanged,
    } satisfies JsonObject));

    try {
      const result = await this.#coordinator.run({
        cik: this.#issuerCik,
        acquisitionType,
        policyVersion: CACHE_REFRESH_POLICY_VERSION,
        idempotencyKey,
        evidenceFingerprint,
        createCandidate: () => this.#createRefreshCandidate(input),
      });
      const candidate = result.candidate.value;
      if (candidate.changed && candidate.activeSnapshotId !== this.#activeSnapshotId) {
        this.#activeSnapshotId = candidate.activeSnapshotId;
        this.#activePointerGeneration += 1;
        this.#candidateCount += 1;
      }
      this.#submissionsFingerprint = candidate.submissionsFingerprint;
      this.#cacheAgeSeconds = 0;
      this.#dependentAuthorityChanged = false;
      this.#state = 'ready';
      this.#activeOperationId = null;
      this.#lastReasonCode = candidate.changed ? 'refresh_completed' : 'submissions_unchanged';
      this.#recoveryActions = Object.freeze([]);
      this.#setFullSnapshotCapabilities();
      this.#statusMessage = candidate.changed
        ? `Fundamentals refreshed. Active snapshot is now ${this.#activeSnapshotId}.`
        : 'Submissions are unchanged; Company Facts and snapshot publication were skipped.';
      this.#emit();
      return this.#result(result.status === 'started' ? 'completed' : result.status);
    } catch (error: unknown) {
      if (error instanceof IncompatibleIssuerOperationError) {
        this.#statusMessage = 'One refresh is already active for this issuer. The duplicate activation was not started.';
        this.#emit();
        return this.#result('busy');
      }
      const operationError = error instanceof RefreshOperationError
        ? error
        : new RefreshOperationError('provider_unavailable', this.#activeGuard?.snapshot());
      this.#applyDegradation(operationError.reasonCode, operationError.quotaSnapshot);
      return this.#result(requestStatusForFailure(operationError.reasonCode));
    }
  }

  async #createRefreshCandidate(input: RunCandidateInput): Promise<RefreshCandidate> {
    if (!this.#canRunForegroundWork()) {
      throw new RefreshOperationError('cancelled', this.#activeGuard?.snapshot());
    }

    this.#operationCount += 1;
    const operationId = `refresh-${this.#operationCount}`;
    const controller = new AbortController();
    const guard = new OperationQuotaGuard(Date.now());
    this.#activeOperationId = operationId;
    this.#activeController = controller;
    this.#activeGuard = guard;
    this.#state = 'checking';
    this.#lastReasonCode = null;
    this.#recoveryActions = Object.freeze([]);
    this.#preservedCapabilities = FULL_SNAPSHOT_CAPABILITIES;
    this.#blockedCapabilities = Object.freeze([]);
    this.#blockedOperations = Object.freeze(['active_operation']);
    this.#statusMessage = input.manualRefresh
      ? 'Checking for updated SEC fundamentals. This force-check still uses consent, quota, retry, and lock guards.'
      : 'Checking cache and SEC submissions after application open or resume.';
    this.#emit();

    try {
      this.#state = 'acquiring';
      this.#statusMessage = 'Acquiring SEC Submissions through the shared fair-access guard.';
      this.#emit();
      const submissions = await this.#fetchResource(
        `/issuers/${this.#issuerCik}/submissions`,
        `${operationId}:submissions`,
        true,
        guard,
        controller.signal,
      );
      const currentFingerprint = await computeSubmissionsNoveltyFingerprint(
        extractSubmissionRecords(submissions.payload),
      );
      const companyFactsDecision = decideCompanyFactsFetch({
        ...(this.#submissionsFingerprint === undefined
          ? {}
          : { previousFingerprint: this.#submissionsFingerprint }),
        currentFingerprint,
        cacheMissing: input.decision.band === 'missing',
        dependentAuthorityChanged: this.#dependentAuthorityChanged,
        manualRefresh: input.manualRefresh,
      });

      let companyFactsDigest: Sha256Digest | null = null;
      if (companyFactsDecision.fetchCompanyFacts) {
        this.#statusMessage = 'Submissions require Company Facts; acquiring through the same quota and retry guard.';
        this.#emit();
        const companyFacts = await this.#fetchResource(
          `/issuers/${this.#issuerCik}/company-facts`,
          `${operationId}:company-facts`,
          true,
          guard,
          controller.signal,
        );
        companyFactsDigest = companyFacts.payloadDigest;
      }

      const candidateFingerprint = await sha256Digest(canonicalJsonBytes({
        issuerCik: this.#issuerCik,
        submissionsPayloadDigest: submissions.payloadDigest,
        submissionsNoveltyFingerprint: currentFingerprint,
        companyFactsPayloadDigest: companyFactsDigest,
        policyVersion: CACHE_REFRESH_POLICY_VERSION,
      } satisfies JsonObject));
      const changed = companyFactsDecision.fetchCompanyFacts || input.decision.band === 'missing';
      return Object.freeze({
        activeSnapshotId: changed
          ? `snapshot-${candidateFingerprint.slice('sha256:'.length, 'sha256:'.length + 32)}`
          : this.#activeSnapshotId,
        submissionsFingerprint: currentFingerprint,
        companyFactsFetched: companyFactsDecision.fetchCompanyFacts,
        changed,
      });
    } finally {
      this.#quota = guard.snapshot();
      if (this.#activeController === controller) {
        this.#activeController = undefined;
        this.#activeGuard = undefined;
        this.#activeOperationId = null;
      }
      this.#emit();
    }
  }

  async #fetchResource(
    pathname: string,
    requestKey: string,
    essential: boolean,
    guard: OperationQuotaGuard,
    signal: AbortSignal,
  ): Promise<FetchedResource> {
    const opened = guard.openLogicalRequest({ requestKey, essential });
    if (opened.status === 'stopped') {
      throw new RefreshOperationError(degradationReason(opened.reasonCode), guard.snapshot());
    }

    const result = await executeWithRetry<FetchedResource>({
      guard,
      token: opened.token,
      signal,
      attempt: async ({ signal: attemptSignal }): Promise<RetryAttemptResult<FetchedResource>> => {
        this.#networkCallCount += 1;
        this.#emit();
        let response: Response;
        try {
          response = await this.#fetch(pathname, attemptSignal);
        } catch (error: unknown) {
          if (attemptSignal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            throw error;
          }
          return Object.freeze({
            ok: false as const,
            retryable: true,
            reasonCode: 'provider_unavailable' as const,
          });
        }
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          return Object.freeze({
            ok: false as const,
            retryable: isRetryableHttpStatus(response.status),
            reasonCode: responseFailureReason(response.status),
            ...(retryAfter === null ? {} : { retryAfter }),
          });
        }
        const raw = await response.text();
        let payload: unknown;
        try {
          payload = JSON.parse(raw) as unknown;
        } catch {
          return Object.freeze({
            ok: false as const,
            retryable: false,
            reasonCode: 'invalid_payload' as const,
          });
        }
        return Object.freeze({
          ok: true as const,
          value: Object.freeze({
            payload,
            payloadDigest: await sha256Digest(raw),
          }),
        });
      },
    });
    return this.#unwrapResourceResult(result, guard);
  }

  #unwrapResourceResult(
    result: ExecuteWithRetryResult<FetchedResource>,
    guard: OperationQuotaGuard,
  ): FetchedResource {
    if (result.status === 'succeeded') return result.value;
    throw new RefreshOperationError(degradationReason(result.reasonCode), guard.snapshot());
  }

  async #fetch(pathname: string, signal: AbortSignal): Promise<Response> {
    const fetchFunction = this.#context?.window.fetch.bind(this.#context.window) ?? globalThis.fetch;
    if (fetchFunction === undefined) throw new Error('BROWSER_FETCH_UNAVAILABLE');
    return fetchFunction(pathname, {
      method: 'GET',
      headers: { accept: 'application/json, application/problem+json' },
      signal,
    });
  }

  #applyDegradation(
    reasonCode: RefreshFailureReasonCode,
    quotaSnapshot: OperationQuotaSnapshot | undefined,
  ): void {
    const degradation = resolveRefreshDegradation({
      reasonCode,
      priorSnapshotId: this.#activeSnapshotId,
    });
    this.#state = degradation.pipelineState;
    this.#activeOperationId = null;
    this.#lastReasonCode = degradation.reasonCode;
    this.#recoveryActions = degradation.recoveryActions;
    this.#preservedCapabilities = DEGRADED_SNAPSHOT_CAPABILITIES;
    this.#blockedCapabilities = reasonCode === 'cancelled'
      ? Object.freeze([])
      : ACQUISITION_BLOCKED_CAPABILITIES;
    this.#blockedOperations = reasonCode === 'cancelled'
      ? Object.freeze(['active_operation'])
      : Object.freeze(['acquisition']);
    this.#quota = quotaSnapshot ?? this.#quota;
    this.#statusMessage = errorStatusMessage(reasonCode);
    this.#emit();
  }

  #setFullSnapshotCapabilities(): void {
    this.#preservedCapabilities = FULL_SNAPSHOT_CAPABILITIES;
    this.#blockedCapabilities = Object.freeze([]);
    this.#blockedOperations = Object.freeze([]);
  }

  #canRunForegroundWork(): boolean {
    if (!this.#foregroundActive || this.#closedByPageHide) return false;
    const context = this.#context;
    if (context === undefined || context.window.closed) return false;
    return context.document.visibilityState !== 'hidden';
  }

  #result(status: RefreshRequestStatus): RefreshRequestResult {
    return Object.freeze({ status, snapshot: this.snapshot() });
  }

  #emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}

export const refreshRuntime = new RefreshRuntime();

const installedDocuments = new WeakSet<Document>();

export function installAppPlugin(context: AppPluginContext): AppPluginCleanup {
  if (installedDocuments.has(context.document)) return () => {};
  installedDocuments.add(context.document);
  refreshRuntime.attach(context);

  const onVisibilityChange = (): void => {
    if (context.document.visibilityState === 'visible') {
      void refreshRuntime.requestLifecycleRefresh('app_resumed');
    }
  };
  const onPageShow = (): void => {
    refreshRuntime.markPageShown();
    void refreshRuntime.requestLifecycleRefresh('app_resumed');
  };
  const onPageHide = (): void => {
    refreshRuntime.markPageHidden();
  };
  const onResume = (): void => {
    void refreshRuntime.requestLifecycleRefresh('app_resumed');
  };
  const onVisualPreferenceChanged = (): void => {
    refreshRuntime.processInvalidation({ event: 'visual_preference_changed' });
  };

  context.document.addEventListener('visibilitychange', onVisibilityChange);
  context.window.addEventListener('pageshow', onPageShow);
  context.window.addEventListener('pagehide', onPageHide);
  context.window.addEventListener('resume', onResume);
  context.window.addEventListener(VISUAL_PREFERENCE_EVENT, onVisualPreferenceChanged);
  void refreshRuntime.requestLifecycleRefresh('app_opened');

  return () => {
    context.document.removeEventListener('visibilitychange', onVisibilityChange);
    context.window.removeEventListener('pageshow', onPageShow);
    context.window.removeEventListener('pagehide', onPageHide);
    context.window.removeEventListener('resume', onResume);
    context.window.removeEventListener(VISUAL_PREFERENCE_EVENT, onVisualPreferenceChanged);
    installedDocuments.delete(context.document);
    refreshRuntime.detach(context);
  };
}
