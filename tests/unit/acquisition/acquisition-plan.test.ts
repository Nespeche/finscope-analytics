import { describe, expect, it } from 'vitest';
import acquisitionVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-acquisition-test-vectors.json';
import {
  createAcquisitionPlan,
  SEC_ACQUISITION_MAX_EXTERNAL_CALLS,
} from '../../../src/domain/acquisition/acquisition-plan';
import {
  orderEligibleFallbacks,
  type FallbackMappingCandidate,
} from '../../../src/domain/acquisition/fallback-order';

function mapping(conceptIndex: number, precedence = 10): FallbackMappingCandidate {
  const suffix = conceptIndex.toString().padStart(2, '0');
  return {
    canonicalConceptId: `concept-${suffix}`,
    taxonomy: 'us-gaap',
    tag: `Concept${suffix}`,
    status: 'ACTIVE',
    mappingQuality: 'exact',
    precedence,
    profileIds: ['general_operating_us_gaap'],
  };
}

function fallbacks(count: number) {
  const concepts = Array.from({ length: count }, (_, index) => `concept-${index.toString().padStart(2, '0')}`);
  return orderEligibleFallbacks({
    profileId: 'general_operating_us_gaap',
    profileConceptAllowlist: concepts,
    unresolvedConceptIds: concepts,
    mappings: concepts.map((_concept, index) => mapping(index)),
    metrics: concepts.map((concept, index) => ({
      metricId: `METRIC-${index}`,
      metricPriority: 10 + index,
      inputIds: [concept],
      profileAllowlist: ['general_operating_us_gaap'],
    })),
  });
}

describe('SEC acquisition plan', () => {
  it('matches the frozen primary, fallback, hard-stop and cache vectors', () => {
    expect(acquisitionVectors.fixtures.map((fixture) => fixture.fixtureId)).toEqual([
      'SEC-ORDER-PRIMARY-COMPLETE',
      'SEC-ORDER-SELECTIVE-FALLBACK',
      'SEC-BUDGET-HARD-STOP',
      'SEC-CACHE-ZERO-CALLS',
    ]);

    const primary = createAcquisitionPlan({
      cik: '0000320193',
      maxExternalCalls: 14,
      requestedConceptIds: ['revenue', 'netIncome'],
      cacheState: 'miss',
      companyFactsResolvedConceptIds: ['revenue', 'netIncome'],
      eligibleFallbacks: [],
    });
    expect(primary.attempts.map((attempt) => attempt.sourceKind)).toEqual(['submissions', 'company_facts']);
    expect(primary).toMatchObject({ externalCallCount: 2, status: 'complete' });

    const hardStop = createAcquisitionPlan({
      cik: '0000320193',
      maxExternalCalls: 14,
      requestedConceptIds: Array.from({ length: 20 }, (_, index) => `concept-${index.toString().padStart(2, '0')}`),
      cacheState: 'miss',
      companyFactsResolvedConceptIds: [],
      eligibleFallbacks: fallbacks(20),
    });
    expect(hardStop.externalCallCount).toBe(SEC_ACQUISITION_MAX_EXTERNAL_CALLS);
    expect(hardStop.attempts.filter((attempt) => attempt.sourceKind === 'company_concept')).toHaveLength(12);
    expect(hardStop.unresolvedConceptIds).toHaveLength(8);
    expect(hardStop.unattemptedFallbacks).toHaveLength(8);
    expect(hardStop.status).toBe('partial');
    expect(hardStop.attempts.some((attempt) => attempt.attemptIndex === 15)).toBe(false);

    const cache = createAcquisitionPlan({
      cik: '0000320193',
      maxExternalCalls: 14,
      requestedConceptIds: ['revenue'],
      cacheState: 'valid_complete',
      companyFactsResolvedConceptIds: [],
      eligibleFallbacks: fallbacks(1),
    });
    expect(cache).toMatchObject({ externalCallCount: 0, budgetRemaining: 14, status: 'complete' });
  });

  it('orders only ACTIVE exact profile-allowed fallbacks deterministically', () => {
    const ordered = orderEligibleFallbacks({
      profileId: 'general_operating_us_gaap',
      profileConceptAllowlist: ['revenue', 'netIncome', 'cashFlowFromOperations'],
      unresolvedConceptIds: ['cashFlowFromOperations', 'netIncome'],
      mappings: [
        {
          canonicalConceptId: 'cashFlowFromOperations', taxonomy: 'us-gaap',
          tag: 'NetCashProvidedByUsedInOperatingActivities', status: 'ACTIVE',
          mappingQuality: 'exact', precedence: 20, profileIds: ['general_operating_us_gaap'],
        },
        {
          canonicalConceptId: 'netIncome', taxonomy: 'us-gaap', tag: 'ProfitLoss',
          status: 'ACTIVE', mappingQuality: 'approved_alias', precedence: 1,
          profileIds: ['general_operating_us_gaap'],
        },
        {
          canonicalConceptId: 'netIncome', taxonomy: 'us-gaap', tag: 'NetIncomeLoss',
          status: 'ACTIVE', mappingQuality: 'exact', precedence: 10,
          profileIds: ['general_operating_us_gaap'],
        },
      ],
      metrics: [
        { metricId: 'FND_NET_INCOME', metricPriority: 20, inputIds: ['netIncome'], profileAllowlist: ['general_operating_us_gaap'] },
        { metricId: 'FND_CFO', metricPriority: 30, inputIds: ['cashFlowFromOperations'], profileAllowlist: ['general_operating_us_gaap'] },
      ],
    });

    expect(ordered.map((fallback) => fallback.canonicalConceptId)).toEqual([
      'netIncome', 'cashFlowFromOperations',
    ]);
    expect(ordered.map((fallback) => fallback.requestKey)).toEqual([
      'us-gaap:NetIncomeLoss', 'us-gaap:NetCashProvidedByUsedInOperatingActivities',
    ]);
  });
});
