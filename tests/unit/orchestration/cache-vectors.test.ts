import { describe, expect, it } from 'vitest';
import cacheVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/cache-refresh-test-vectors.json';
import {
  classifyCacheFreshness,
  decideCacheRefresh,
  preserveSnapshotAfterRefreshFailure,
} from '../../../src/domain/orchestration/cache-policy';

function triggerFor(vector: { readonly appState?: string; readonly manualRefresh?: boolean }):
  'closed_app' | 'manual_refresh' | 'app_opened' {
  if (vector.appState === 'closed') return 'closed_app';
  return vector.manualRefresh === true ? 'manual_refresh' : 'app_opened';
}

describe('cache and refresh authority vectors', () => {
  it('matches every freshness and consent vector without unconditional network', () => {
    for (const vector of cacheVectors.vectors) {
      const decision = decideCacheRefresh({
        trigger: triggerFor(vector),
        refreshConsent: vector.refreshConsent,
        hasSnapshot: vector.ageSeconds !== undefined,
        ...(vector.ageSeconds === undefined ? {} : { ageSeconds: vector.ageSeconds }),
      });

      if (vector.expectedBand !== undefined) expect(decision.band, vector.vectorId).toBe(vector.expectedBand);
      switch (vector.expectedAction) {
        case 'none':
          expect(decision.action, vector.vectorId).toBe('none');
          expect(decision.shouldFetchSubmissions, vector.vectorId).toBe(false);
          break;
        case 'fetch_submissions':
          expect(decision.action, vector.vectorId).toBe('fetch_submissions');
          expect(decision.shouldFetchSubmissions, vector.vectorId).toBe(true);
          break;
        case 'no_network':
          expect(decision.action, vector.vectorId).toBe('no_network');
          expect(decision.shouldFetchSubmissions, vector.vectorId).toBe(false);
          break;
        case 'no_background_scheduler':
          expect(decision.action, vector.vectorId).toBe('no_background_scheduler');
          expect(decision.shouldStartBackgroundScheduler, vector.vectorId).toBe(false);
          break;
        case 'preserve_last_valid_snapshot': {
          expect(decision.action, vector.vectorId).toBe('fetch_submissions');
          const failure = preserveSnapshotAfterRefreshFailure(decision);
          expect(failure.action, vector.vectorId).toBe('preserve_last_valid_snapshot');
          expect(failure.publishCandidate, vector.vectorId).toBe(false);
          break;
        }
      }
    }
  });

  it('enforces exact 6-hour and 7-day boundaries', () => {
    expect(classifyCacheFreshness(21_599)).toBe('fresh');
    expect(classifyCacheFreshness(21_600)).toBe('stale_revalidatable');
    expect(classifyCacheFreshness(604_799)).toBe('stale_revalidatable');
    expect(classifyCacheFreshness(604_800)).toBe('expired');
  });

  it('treats a cache miss as Submissions-first and never schedules background work', () => {
    const decision = decideCacheRefresh({
      trigger: 'app_resumed',
      refreshConsent: true,
      hasSnapshot: false,
    });
    expect(decision).toMatchObject({
      band: 'missing',
      action: 'fetch_submissions',
      reasonCode: 'cache_missing',
      shouldFetchSubmissions: true,
      shouldStartBackgroundScheduler: false,
    });
  });
});
