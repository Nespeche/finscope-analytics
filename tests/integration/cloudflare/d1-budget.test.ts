import { describe, expect, it } from 'vitest';
import { D1InvocationBudget, d1CanaryExceeded } from '../../../workers/sec-gateway/src/catalog/d1-metrics';

describe('D1 Free budget', () => {
  it('permits at most two measured runtime queries', () => {
    const budget = new D1InvocationBudget();
    expect(budget.recordQuery({ rowsRead: 10 })).toEqual({ queryCount: 1, rowsRead: 10, rowsWritten: 0 });
    expect(budget.recordQuery({ rowsRead: 4 })).toEqual({ queryCount: 2, rowsRead: 14, rowsWritten: 0 });
    expect(() => budget.recordQuery({ rowsRead: 1 })).toThrow('CLOUDFLARE_BUDGET_EXCEEDED:d1QueriesInvocation');
  });

  it('detects daily and storage canaries', () => {
    expect(d1CanaryExceeded({ rowsReadDay: 50_001, rowsWrittenDay: 0, storageBytes: 0 })).toBe(true);
    expect(d1CanaryExceeded({ rowsReadDay: 50_000, rowsWrittenDay: 1_000, storageBytes: 50 * 1024 * 1024 })).toBe(false);
  });
});
