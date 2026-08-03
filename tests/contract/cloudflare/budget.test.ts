import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_FREE_LIMITS, FINSCOPE_CLOUDFLARE_BUDGET, CloudflareBudgetExceededError, assertWithinCloudflareBudget, authorizeRefresh } from '../../../workers/sec-gateway/src/budget';

describe('Cloudflare Free budget authority', () => {
  it('pins official limits and stricter internal margins', () => {
    expect(CLOUDFLARE_FREE_LIMITS).toMatchObject({ workerRequestsDay: 100_000, workerCpuMilliseconds: 10, workerMemoryBytes: 134_217_728, workerSubrequests: 50, d1QueriesInvocation: 50, pagesFiles: 20_000 });
    expect(FINSCOPE_CLOUDFLARE_BUDGET).toMatchObject({ workerRequestsDay: 2_000, workerCpuP95Milliseconds: 4, workerSubrequests: 1, d1QueriesInvocation: 2, pagesFiles: 500 });
    expect(FINSCOPE_CLOUDFLARE_BUDGET.workerRequestsDay).toBeLessThan(CLOUDFLARE_FREE_LIMITS.workerRequestsDay);
  });

  it('fails closed and stops only nonessential refresh at the canary', () => {
    expect(() => assertWithinCloudflareBudget('workerSubrequests', 2)).toThrow(CloudflareBudgetExceededError);
    expect(authorizeRefresh({ essential: false, canaryExceeded: true })).toEqual({ authorized: false, reasonCode: 'nonessential_refresh_stopped' });
    expect(authorizeRefresh({ essential: true, canaryExceeded: true })).toEqual({ authorized: true });
  });
});
