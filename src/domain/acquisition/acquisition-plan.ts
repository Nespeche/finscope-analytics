import type { OrderedFallback } from './fallback-order';

export const SEC_ACQUISITION_MAX_EXTERNAL_CALLS = 14 as const;
export const SEC_COMPANY_CONCEPT_MAX_CALLS = 12 as const;

export type AcquisitionPlanStatus = 'complete' | 'partial';
export type AcquisitionSourceKind = 'submissions' | 'company_facts' | 'company_concept';

export interface AcquisitionPlanAttempt {
  readonly attemptIndex: number;
  readonly sourceKind: AcquisitionSourceKind;
  readonly priority: 30 | 40 | 70;
  readonly requestKey: string;
  readonly canonicalConceptId?: string;
  readonly taxonomy?: string;
  readonly tag?: string;
}

export interface AcquisitionPlanInput {
  readonly cik: string;
  readonly maxExternalCalls: 14;
  readonly requestedConceptIds: readonly string[];
  readonly cacheState: 'valid_complete' | 'miss' | 'stale' | 'expired';
  readonly companyFactsResolvedConceptIds: readonly string[];
  readonly eligibleFallbacks: readonly OrderedFallback[];
}

export interface AcquisitionPlan {
  readonly primarySource: 'company_facts';
  readonly attempts: readonly AcquisitionPlanAttempt[];
  readonly externalCallCount: number;
  readonly budgetRemaining: number;
  readonly unresolvedConceptIds: readonly string[];
  readonly unattemptedFallbacks: readonly OrderedFallback[];
  readonly status: AcquisitionPlanStatus;
}

function normalizeUnique(values: readonly string[]): readonly string[] {
  const selected = new Set<string>();
  for (const value of values) {
    if (value.length === 0) throw new TypeError('EMPTY_CONCEPT_ID');
    selected.add(value);
  }
  return Object.freeze([...selected]);
}

function freezeAttempt(attempt: AcquisitionPlanAttempt): AcquisitionPlanAttempt {
  return Object.freeze(attempt);
}

export function createAcquisitionPlan(input: AcquisitionPlanInput): AcquisitionPlan {
  if (input.maxExternalCalls !== SEC_ACQUISITION_MAX_EXTERNAL_CALLS) {
    throw new TypeError('SEC_MAX_EXTERNAL_CALLS_MUST_EQUAL_14');
  }
  if (!/^\d{10}$/u.test(input.cik)) throw new TypeError('INVALID_CIK');
  const requested = normalizeUnique(input.requestedConceptIds);
  if (input.cacheState === 'valid_complete') {
    return Object.freeze({
      primarySource: 'company_facts' as const,
      attempts: Object.freeze([]),
      externalCallCount: 0,
      budgetRemaining: SEC_ACQUISITION_MAX_EXTERNAL_CALLS,
      unresolvedConceptIds: Object.freeze([]),
      unattemptedFallbacks: Object.freeze([]),
      status: 'complete' as const,
    });
  }

  const resolvedByCompanyFacts = new Set(input.companyFactsResolvedConceptIds);
  const unresolved = requested.filter((conceptId) => !resolvedByCompanyFacts.has(conceptId));
  const attempts: AcquisitionPlanAttempt[] = [
    freezeAttempt({
      attemptIndex: 1,
      sourceKind: 'submissions',
      priority: 30,
      requestKey: `submissions:${input.cik}`,
    }),
    freezeAttempt({
      attemptIndex: 2,
      sourceKind: 'company_facts',
      priority: 40,
      requestKey: `companyfacts:${input.cik}`,
    }),
  ];

  const eligible = input.eligibleFallbacks.filter((fallback) => unresolved.includes(fallback.canonicalConceptId));
  const selectedFallbacks = eligible.slice(0, SEC_COMPANY_CONCEPT_MAX_CALLS);
  for (const fallback of selectedFallbacks) {
    const attemptIndex = attempts.length + 1;
    if (attemptIndex > SEC_ACQUISITION_MAX_EXTERNAL_CALLS) {
      throw new Error('SEC_ACQUISITION_PLAN_EXCEEDED_14_CALLS');
    }
    attempts.push(freezeAttempt({
      attemptIndex,
      sourceKind: 'company_concept',
      priority: 70,
      requestKey: `company_concept:${fallback.requestKey}`,
      canonicalConceptId: fallback.canonicalConceptId,
      taxonomy: fallback.taxonomy,
      tag: fallback.tag,
    }));
  }

  const coveredConcepts = new Set(selectedFallbacks.map((fallback) => fallback.canonicalConceptId));
  const unresolvedAfterPlan = unresolved.filter((conceptId) => !coveredConcepts.has(conceptId));
  const unattemptedFallbacks = Object.freeze(eligible.slice(selectedFallbacks.length));
  const status: AcquisitionPlanStatus = unresolvedAfterPlan.length === 0 ? 'complete' : 'partial';

  return Object.freeze({
    primarySource: 'company_facts' as const,
    attempts: Object.freeze(attempts),
    externalCallCount: attempts.length,
    budgetRemaining: SEC_ACQUISITION_MAX_EXTERNAL_CALLS - attempts.length,
    unresolvedConceptIds: Object.freeze(unresolvedAfterPlan),
    unattemptedFallbacks,
    status,
  });
}
