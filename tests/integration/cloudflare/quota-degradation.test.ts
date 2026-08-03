import { describe, expect, it } from 'vitest';
import { resolveQuotaDegradation } from '../../../src/domain/orchestration/quota-degradation';
import { createQuotaProblemResponse } from '../../../workers/sec-gateway/src/quota-errors';

describe('quota degradation', () => {
  it('preserves the prior snapshot and emits bounded retry instructions', async () => {
    const result = resolveQuotaDegradation({ reasonCode: 'quota_exhausted', priorSnapshotId: 'snapshot-7', retryAfterSeconds: 900 });
    expect(result).toMatchObject({ pipelineState: 'partial', activeSnapshotId: 'snapshot-7', candidatePublished: false, networkRefreshAuthorized: false, paidFallbackAuthorized: false });
    const response = createQuotaProblemResponse('quota_exhausted', 900);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('900');
    expect(await response.json()).toMatchObject({ preservedState: 'last_valid_local_snapshot', paidFallback: false });
  });

  it('never invents a snapshot or silently substitutes a paid service', () => {
    expect(resolveQuotaDegradation({ reasonCode: 'nonessential_refresh_stopped', retryAfterSeconds: 60 })).toEqual({ pipelineState: 'failed', candidatePublished: false, networkRefreshAuthorized: false, retryAfterSeconds: 60, paidFallbackAuthorized: false, displayStalenessWarning: false });
  });
});
