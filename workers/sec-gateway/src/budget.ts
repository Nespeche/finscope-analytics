export const CLOUDFLARE_FREE_LIMITS = Object.freeze({
  pagesBuildsMonth: 500,
  pagesFiles: 20_000,
  pagesAssetBytes: 25 * 1024 * 1024,
  workerRequestsDay: 100_000,
  workerCpuMilliseconds: 10,
  workerMemoryBytes: 128 * 1024 * 1024,
  workerSubrequests: 50,
  workerCompressedBundleBytes: 3 * 1024 * 1024,
  d1RowsReadDay: 5_000_000,
  d1RowsWrittenDay: 100_000,
  d1StorageBytes: 5 * 1024 * 1024 * 1024,
  d1QueriesInvocation: 50,
} as const);

export const FINSCOPE_CLOUDFLARE_BUDGET = Object.freeze({
  pagesBuildsMonth: 20,
  pagesFiles: 500,
  pagesAssetBytes: 5 * 1024 * 1024,
  workerRequestsDay: 2_000,
  workerCpuP95Milliseconds: 4,
  workerMemoryBytes: 64 * 1024 * 1024,
  workerSubrequests: 1,
  workerCompressedBundleBytes: 512 * 1024,
  d1RowsReadDay: 50_000,
  d1RowsWrittenDay: 1_000,
  d1StorageBytes: 50 * 1024 * 1024,
  d1QueriesInvocation: 2,
} as const);

export type BudgetResource = keyof typeof FINSCOPE_CLOUDFLARE_BUDGET;

export class CloudflareBudgetExceededError extends Error {
  constructor(readonly resource: BudgetResource, readonly observed: number, readonly budget: number) {
    super(`CLOUDFLARE_BUDGET_EXCEEDED:${resource}:${observed}:${budget}`);
    this.name = 'CloudflareBudgetExceededError';
  }
}

export function assertWithinCloudflareBudget(resource: BudgetResource, observed: number): void {
  if (!Number.isFinite(observed) || observed < 0) throw new TypeError(`INVALID_BUDGET_OBSERVATION:${resource}`);
  const budget = FINSCOPE_CLOUDFLARE_BUDGET[resource];
  if (observed > budget) throw new CloudflareBudgetExceededError(resource, observed, budget);
}

export function authorizeRefresh(input: { readonly essential: boolean; readonly canaryExceeded: boolean }):
Readonly<{ authorized: true }> | Readonly<{ authorized: false; reasonCode: 'nonessential_refresh_stopped' }> {
  if (input.canaryExceeded && !input.essential) {
    return Object.freeze({ authorized: false as const, reasonCode: 'nonessential_refresh_stopped' as const });
  }
  return Object.freeze({ authorized: true as const });
}
