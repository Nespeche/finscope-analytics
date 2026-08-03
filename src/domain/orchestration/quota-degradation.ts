export interface QuotaDegradationInput {
  readonly reasonCode: 'quota_exhausted' | 'nonessential_refresh_stopped';
  readonly priorSnapshotId?: string;
  readonly retryAfterSeconds: number;
}

export interface QuotaDegradationResult {
  readonly pipelineState: 'partial' | 'failed';
  readonly activeSnapshotId?: string;
  readonly candidatePublished: false;
  readonly networkRefreshAuthorized: false;
  readonly retryAfterSeconds: number;
  readonly paidFallbackAuthorized: false;
  readonly displayStalenessWarning: boolean;
}

export function resolveQuotaDegradation(input: QuotaDegradationInput): QuotaDegradationResult {
  if (input.priorSnapshotId !== undefined && input.priorSnapshotId.length === 0) {
    throw new TypeError('EMPTY_PRIOR_SNAPSHOT_ID');
  }
  if (!Number.isSafeInteger(input.retryAfterSeconds) || input.retryAfterSeconds < 1) {
    throw new TypeError('INVALID_RETRY_AFTER_SECONDS');
  }
  return Object.freeze({
    pipelineState: input.priorSnapshotId === undefined ? 'failed' as const : 'partial' as const,
    ...(input.priorSnapshotId === undefined ? {} : { activeSnapshotId: input.priorSnapshotId }),
    candidatePublished: false as const,
    networkRefreshAuthorized: false as const,
    retryAfterSeconds: input.retryAfterSeconds,
    paidFallbackAuthorized: false as const,
    displayStalenessWarning: input.priorSnapshotId !== undefined,
  });
}
