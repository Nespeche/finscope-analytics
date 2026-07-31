import { describe, expect, it, vi } from 'vitest';
import {
  OperationQuotaGuard,
  SEC_MAX_EXTERNAL_CALLS_PER_OPERATION,
} from '../../../src/gateway/quota-state';
import {
  computeRetryDelayMilliseconds,
  executeWithRetry,
  isRetryableHttpStatus,
  parseRetryAfterMilliseconds,
} from '../../../src/gateway/retry-policy';

function openedToken(guard: OperationQuotaGuard, requestKey = 'submissions:0000320193') {
  const opened = guard.openLogicalRequest({ requestKey, essential: true });
  if (opened.status !== 'opened') throw new Error(`Expected opened request: ${opened.reasonCode}`);
  return opened.token;
}

describe('shared retry and quota guard', () => {
  it('uses Retry-After precedence and otherwise exact 1/2/4 backoff with bounded jitter', () => {
    const now = Date.parse('2025-01-15T12:00:00.000Z');
    expect(parseRetryAfterMilliseconds('45', now)).toBe(30_000);
    expect(parseRetryAfterMilliseconds('Wed, 15 Jan 2025 12:00:05 GMT', now)).toBe(5_000);
    expect(computeRetryDelayMilliseconds({
      failedAttemptNumber: 1,
      retryAfter: '3',
      nowMilliseconds: now,
      jitterMilliseconds: 250,
    })).toBe(3_000);
    expect(computeRetryDelayMilliseconds({
      failedAttemptNumber: 1,
      nowMilliseconds: now,
      jitterMilliseconds: 250,
    })).toBe(1_250);
    expect(computeRetryDelayMilliseconds({
      failedAttemptNumber: 2,
      nowMilliseconds: now,
      jitterMilliseconds: 0,
    })).toBe(2_000);
  });

  it('performs three logical attempts, charges all retries and then stops', async () => {
    const guard = new OperationQuotaGuard(0);
    const token = openedToken(guard);
    const attempt = vi.fn().mockResolvedValue({
      ok: false as const,
      retryable: true,
      reasonCode: 'provider_unavailable' as const,
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    let now = 0;
    const result = await executeWithRetry({
      guard,
      token,
      attempt,
      sleep,
      now: () => now,
      jitterMilliseconds: () => 0,
    });
    now += 1;

    expect(result).toEqual({ status: 'failed', reasonCode: 'retry_exhausted', attempts: 3 });
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000, expect.any(AbortSignal));
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000, expect.any(AbortSignal));
    expect(guard.snapshot().externalCallCount).toBe(3);
  });

  it('enforces the 20-second request timeout even when an executor ignores abort', async () => {
    const guard = new OperationQuotaGuard(0);
    const token = openedToken(guard, 'companyfacts:0000320193');
    const attempt = vi.fn(() => new Promise<never>(() => {}));
    const resultPromise = executeWithRetry({
      guard,
      token,
      attempt,
      sleep: vi.fn().mockResolvedValue(undefined),
      now: () => 0,
      jitterMilliseconds: () => 0,
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(resultPromise).resolves.toEqual({
      status: 'failed',
      reasonCode: 'retry_exhausted',
      attempts: 3,
    });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('forbids a 15th external call and duplicate logical request keys', () => {
    const guard = new OperationQuotaGuard(0);
    for (let index = 0; index < SEC_MAX_EXTERNAL_CALLS_PER_OPERATION; index += 1) {
      const token = openedToken(guard, `company_concept:${index}`);
      expect(guard.authorizeAttempt(token, index)).toMatchObject({ status: 'permitted' });
      guard.completeLogicalRequest(token);
    }
    expect(guard.snapshot()).toMatchObject({ externalCallCount: 14, remainingExternalCalls: 0 });
    expect(guard.openLogicalRequest({ requestKey: 'company_concept:15', essential: true }))
      .toEqual({ status: 'stopped', reasonCode: 'quota_exhausted' });
    expect(() => guard.openLogicalRequest({ requestKey: 'company_concept:0', essential: true }))
      .toThrow(/Duplicate SEC request key/u);
  });

  it('stops nonessential refresh work before reserved calls are consumed', () => {
    const guard = new OperationQuotaGuard(0);
    for (let index = 0; index < 12; index += 1) {
      const token = openedToken(guard, `essential:${index}`);
      expect(guard.authorizeAttempt(token, index)).toMatchObject({ status: 'permitted' });
      guard.completeLogicalRequest(token);
    }
    expect(guard.openLogicalRequest({
      requestKey: 'optional:price-refresh',
      essential: false,
      reserveCalls: 2,
    })).toEqual({ status: 'stopped', reasonCode: 'nonessential_refresh_stopped' });
  });

  it('recognizes only bounded transient HTTP failures as retryable', () => {
    expect([408, 429, 500, 502, 503, 504].every(isRetryableHttpStatus)).toBe(true);
    expect([400, 403, 404, 413].some(isRetryableHttpStatus)).toBe(false);
  });
});
