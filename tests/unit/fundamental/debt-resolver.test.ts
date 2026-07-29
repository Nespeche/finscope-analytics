import { describe, expect, it } from 'vitest';
import { canonicalizeDecimalString } from '../../../src/core/decimal';
import {
  APPROVED_DEBT_BUCKETS,
  resolveBorrowingsDebt,
  type DebtFactCandidate,
} from '../../../src/domain/fundamental/debt-resolver';

function debt(overrides: Partial<DebtFactCandidate> = {}): DebtFactCandidate {
  return {
    factId: 'short-term',
    canonicalConceptId: 'shortTermBorrowings',
    valueDecimal: canonicalizeDecimalString('10'),
    mappingId: 'map-debt-short-term',
    mappingStatus: 'ACTIVE',
    mappingQuality: 'exact',
    instantDate: '2025-12-31',
    scopeId: 'consolidated',
    currency: 'USD',
    restatementLineageId: 'lineage-1',
    sourceRef: 'sec-companyfacts-1',
    classification: 'approved_bucket',
    ...overrides,
  };
}

const ABSENT_EXCEPT = (included: readonly string[]) =>
  APPROVED_DEBT_BUCKETS.filter((bucket) => !included.includes(bucket));

describe('borrowings debt resolver', () => {
  it('sums every approved non-overlapping bucket once and excludes accounts payable', () => {
    const result = resolveBorrowingsDebt({
      facts: [
        debt(),
        debt({
          factId: 'current-ltd', canonicalConceptId: 'currentPortionLongTermDebt',
          valueDecimal: canonicalizeDecimalString('20'), mappingId: 'map-debt-current-ltd',
        }),
        debt({
          factId: 'ap', canonicalConceptId: 'accountsPayable',
          valueDecimal: canonicalizeDecimalString('999'), mappingId: 'map-ap',
          classification: 'operating_liability',
        }),
      ],
      absentConceptIds: ABSENT_EXCEPT(['shortTermBorrowings', 'currentPortionLongTermDebt']),
    });
    expect(result).toMatchObject({
      state: 'available',
      valueDecimal: '30',
      includedFactIds: ['short-term', 'current-ltd'],
      dependentMetrics: { FND_NET_DEBT: 'eligible', FND_DEBT_EQUITY: 'eligible' },
    });
    expect(result.ignoredFacts).toContainEqual({ factId: 'ap', reasonCode: 'operating_liability_excluded' });
  });

  it('keeps leases separate and never sums them into borrowings debt', () => {
    const result = resolveBorrowingsDebt({
      facts: [
        debt(),
        debt({
          factId: 'lease', canonicalConceptId: 'financeLeaseLiability',
          valueDecimal: canonicalizeDecimalString('7'), mappingId: 'map-lease', classification: 'lease',
        }),
      ],
      absentConceptIds: ABSENT_EXCEPT(['shortTermBorrowings']),
    });
    expect(result).toMatchObject({
      state: 'available',
      valueDecimal: '10',
      leaseValueDecimal: '7',
      leaseFactIds: ['lease'],
    });
  });

  it('ignores a generic total but returns partial when overlap cannot be resolved', () => {
    const result = resolveBorrowingsDebt({
      facts: [
        debt(),
        debt({
          factId: 'generic', canonicalConceptId: 'borrowingsDebt',
          valueDecimal: canonicalizeDecimalString('100'), mappingId: 'generic-total', classification: 'generic_total',
        }),
      ],
      absentConceptIds: ABSENT_EXCEPT(['shortTermBorrowings']),
    });
    expect(result).toMatchObject({
      state: 'partial',
      dependentMetrics: { FND_NET_DEBT: 'insufficient', FND_DEBT_EQUITY: 'insufficient' },
    });
    expect(result).not.toHaveProperty('valueDecimal');
    expect(result.reasonCodes).toContain('generic_total_overlap_unresolved');
  });

  it('returns partial without a value for unresolved bucket overlap and blocks dependent ratios', () => {
    const result = resolveBorrowingsDebt({
      facts: [
        debt({ factId: 'A', overlapsWithFactIds: ['B'] }),
        debt({
          factId: 'B', canonicalConceptId: 'currentPortionLongTermDebt',
          valueDecimal: canonicalizeDecimalString('20'), mappingId: 'map-debt-current-ltd',
          overlapsWithFactIds: ['A'],
        }),
      ],
      absentConceptIds: ABSENT_EXCEPT(['shortTermBorrowings', 'currentPortionLongTermDebt']),
    });
    expect(result.state).toBe('partial');
    expect(result).not.toHaveProperty('valueDecimal');
    expect(result.reasonCodes).toContain('overlap_or_conflicting_bucket_unresolved');
    expect(result.dependentMetrics.FND_NET_DEBT).toBe('insufficient');
  });

  it('returns insufficient when currency, scope, instant or lineage are incompatible', () => {
    const result = resolveBorrowingsDebt({
      facts: [
        debt(),
        debt({
          factId: 'eur', canonicalConceptId: 'commercialPaper',
          valueDecimal: canonicalizeDecimalString('20'), mappingId: 'map-debt-commercial-paper', currency: 'EUR',
        }),
      ],
      absentConceptIds: ABSENT_EXCEPT(['shortTermBorrowings', 'commercialPaper']),
    });
    expect(result).toMatchObject({
      state: 'insufficient',
      dependentMetrics: { FND_NET_DEBT: 'insufficient', FND_DEBT_EQUITY: 'insufficient' },
    });
    expect(result).not.toHaveProperty('valueDecimal');
  });
});
