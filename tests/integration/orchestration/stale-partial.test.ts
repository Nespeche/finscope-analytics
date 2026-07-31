import { describe, expect, it } from 'vitest';
import { decideCacheRefresh } from '../../../src/domain/orchestration/cache-policy';
import { resolveRefreshDegradation } from '../../../src/domain/orchestration/degradation';

describe('stale refresh degradation and pointer preservation', () => {
  it.each([
    'quota_exhausted',
    'retry_exhausted',
    'request_timeout',
    'operation_timeout',
    'provider_unavailable',
    'upstream_timeout',
    'invalid_payload',
  ] as const)('preserves snapshot A on %s and never activates candidate B', (reasonCode: 'quota_exhausted' | 'retry_exhausted' | 'request_timeout' | 'operation_timeout' | 'provider_unavailable' | 'upstream_timeout' | 'invalid_payload') => {
    const refresh = decideCacheRefresh({
      trigger: 'app_resumed',
      refreshConsent: true,
      hasSnapshot: true,
      ageSeconds: 604_800,
    });
    expect(refresh).toMatchObject({ band: 'expired', action: 'fetch_submissions' });

    const degraded = resolveRefreshDegradation({
      reasonCode,
      priorSnapshotId: 'snapshot-A',
      candidateSnapshotId: 'snapshot-B',
    });
    const gatewayReason = reasonCode === 'provider_unavailable'
      || reasonCode === 'upstream_timeout'
      || reasonCode === 'invalid_payload';
    expect(degraded).toEqual({
      pipelineState: 'partial',
      reasonCode,
      activeSnapshotId: 'snapshot-A',
      candidatePublished: false,
      activePointerAction: 'preserve',
      displayStalenessWarning: true,
      recoveryActions: gatewayReason
        ? ['retry', 'use_cached_sec_payload', 'use_last_snapshot']
        : ['retry', 'use_last_snapshot'],
    });
  });

  it('maps cancellation to the exact local cancelled state and prior-snapshot recovery', () => {
    expect(resolveRefreshDegradation({
      reasonCode: 'cancelled',
      priorSnapshotId: 'snapshot-A',
      candidateSnapshotId: 'snapshot-B',
    })).toEqual({
      pipelineState: 'cancelled',
      reasonCode: 'cancelled',
      activeSnapshotId: 'snapshot-A',
      candidatePublished: false,
      activePointerAction: 'preserve',
      displayStalenessWarning: true,
      recoveryActions: ['restart', 'use_last_snapshot'],
    });
  });

  it('keeps compatible quality-gated outputs partial with catalog recovery actions', () => {
    expect(resolveRefreshDegradation({ reasonCode: 'quality_gate_failed' })).toEqual({
      pipelineState: 'partial',
      reasonCode: 'quality_gate_failed',
      candidatePublished: false,
      activePointerAction: 'none',
      displayStalenessWarning: false,
      recoveryActions: ['review_limitations', 'retry'],
    });
  });

  it('fails without fabricating an active snapshot when no prior valid snapshot exists', () => {
    expect(resolveRefreshDegradation({ reasonCode: 'retry_exhausted' })).toEqual({
      pipelineState: 'failed',
      reasonCode: 'retry_exhausted',
      candidatePublished: false,
      activePointerAction: 'none',
      displayStalenessWarning: false,
      recoveryActions: ['retry'],
    });
  });
});
