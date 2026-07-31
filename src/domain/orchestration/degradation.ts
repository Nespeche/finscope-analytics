export type RefreshFailureReasonCode =
  | 'cancelled'
  | 'quota_exhausted'
  | 'retry_exhausted'
  | 'request_timeout'
  | 'operation_timeout'
  | 'provider_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'quality_gate_failed';

export type DegradedPipelineState = 'cancelled' | 'partial' | 'failed';
export type RefreshRecoveryAction =
  | 'restart'
  | 'retry'
  | 'review_limitations'
  | 'use_cached_sec_payload'
  | 'use_last_snapshot';

export interface RefreshDegradationInput {
  readonly reasonCode: RefreshFailureReasonCode;
  readonly priorSnapshotId?: string;
  readonly candidateSnapshotId?: string;
  readonly hasUsablePartialPayload?: boolean;
}

export interface RefreshDegradationResult {
  readonly pipelineState: DegradedPipelineState;
  readonly reasonCode: RefreshFailureReasonCode;
  readonly activeSnapshotId?: string;
  readonly candidatePublished: false;
  readonly activePointerAction: 'preserve' | 'none';
  readonly displayStalenessWarning: boolean;
  readonly recoveryActions: readonly RefreshRecoveryAction[];
}

function requireSnapshotId(value: string | undefined, code: string): string | undefined {
  if (value !== undefined && value.length === 0) throw new TypeError(code);
  return value;
}

function catalogRecoveryActions(
  reasonCode: RefreshFailureReasonCode,
  hasPrior: boolean,
): readonly RefreshRecoveryAction[] {
  switch (reasonCode) {
    case 'cancelled':
      return hasPrior ? ['restart', 'use_last_snapshot'] : ['restart'];
    case 'quality_gate_failed':
      return hasPrior
        ? ['review_limitations', 'retry', 'use_last_snapshot']
        : ['review_limitations', 'retry'];
    case 'provider_unavailable':
    case 'upstream_timeout':
    case 'invalid_payload':
      return hasPrior
        ? ['retry', 'use_cached_sec_payload', 'use_last_snapshot']
        : ['retry', 'use_cached_sec_payload'];
    case 'quota_exhausted':
    case 'retry_exhausted':
    case 'request_timeout':
    case 'operation_timeout':
      return hasPrior ? ['retry', 'use_last_snapshot'] : ['retry'];
  }
}

/** Resolves failure/cancellation without ever publishing or activating the failed candidate. */
export function resolveRefreshDegradation(
  input: RefreshDegradationInput,
): RefreshDegradationResult {
  const priorSnapshotId = requireSnapshotId(input.priorSnapshotId, 'EMPTY_PRIOR_SNAPSHOT_ID');
  requireSnapshotId(input.candidateSnapshotId, 'EMPTY_CANDIDATE_SNAPSHOT_ID');
  const hasPrior = priorSnapshotId !== undefined;
  const hasCompatibleOutput = input.hasUsablePartialPayload === true
    || input.reasonCode === 'quality_gate_failed';
  const pipelineState: DegradedPipelineState = input.reasonCode === 'cancelled'
    ? 'cancelled'
    : hasPrior || hasCompatibleOutput
      ? 'partial'
      : 'failed';

  return Object.freeze({
    pipelineState,
    reasonCode: input.reasonCode,
    ...(priorSnapshotId === undefined ? {} : { activeSnapshotId: priorSnapshotId }),
    candidatePublished: false as const,
    activePointerAction: hasPrior ? 'preserve' as const : 'none' as const,
    displayStalenessWarning: hasPrior,
    recoveryActions: Object.freeze([...catalogRecoveryActions(input.reasonCode, hasPrior)]),
  });
}
