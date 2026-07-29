import mappingCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json';
import {
  addDecimalStrings,
  canonicalizeDecimalString,
  parseDecimalString,
  type DecimalString,
} from '../../core/decimal';

export type DebtFactClassification =
  | 'approved_bucket'
  | 'generic_total'
  | 'lease'
  | 'operating_liability'
  | 'issuer_extension';

export interface DebtFactCandidate {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly valueDecimal: DecimalString;
  readonly mappingId: string;
  readonly mappingStatus: 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';
  readonly mappingQuality: 'exact' | 'approved_alias' | 'derived' | 'ambiguous';
  readonly instantDate: string;
  readonly scopeId: string;
  readonly currency: string;
  readonly restatementLineageId: string;
  readonly sourceRef: string;
  readonly classification?: DebtFactClassification;
  readonly mappingApprovedForExtension?: boolean;
  readonly overlapsWithFactIds?: readonly string[];
}

export interface DebtResolutionInput {
  readonly facts: readonly DebtFactCandidate[];
  readonly absentConceptIds?: readonly string[];
  readonly observedUnmappedBorrowingTags?: readonly string[];
}

export type DebtResolutionState = 'available' | 'partial' | 'insufficient';

export interface DebtResolution {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly state: DebtResolutionState;
  readonly valueDecimal?: DecimalString;
  readonly leaseValueDecimal?: DecimalString;
  readonly includedFactIds: readonly string[];
  readonly leaseFactIds: readonly string[];
  readonly ignoredFacts: readonly Readonly<{ factId: string; reasonCode: string }>[];
  readonly reasonCodes: readonly string[];
  readonly dependentMetrics: Readonly<{
    FND_NET_DEBT: 'eligible' | 'insufficient';
    FND_DEBT_EQUITY: 'eligible' | 'insufficient';
  }>;
}

const catalog = mappingCatalogJson as unknown as {
  readonly debtPolicy: {
    readonly policyId: string;
    readonly version: string;
    readonly buckets: readonly string[];
    readonly knownAbsentConcepts: readonly { readonly canonicalConceptId: string }[];
  };
};

export const APPROVED_DEBT_BUCKETS = Object.freeze([...catalog.debtPolicy.buckets]);
const APPROVED_BUCKET_SET = new Set(APPROVED_DEBT_BUCKETS);
const KNOWN_ABSENT_SET = new Set(catalog.debtPolicy.knownAbsentConcepts
  .map((entry) => entry.canonicalConceptId));

function compareByBucket(left: DebtFactCandidate, right: DebtFactCandidate): number {
  return APPROVED_DEBT_BUCKETS.indexOf(left.canonicalConceptId)
    - APPROVED_DEBT_BUCKETS.indexOf(right.canonicalConceptId)
    || left.factId.localeCompare(right.factId, 'en');
}

function sameDimensions(left: DebtFactCandidate, right: DebtFactCandidate): boolean {
  return left.instantDate === right.instantDate
    && left.scopeId === right.scopeId
    && left.currency === right.currency
    && left.restatementLineageId === right.restatementLineageId;
}

function sumValues(facts: readonly DebtFactCandidate[]): DecimalString {
  let total = canonicalizeDecimalString('0');
  for (const fact of facts) {
    parseDecimalString(fact.valueDecimal);
    total = addDecimalStrings(total, fact.valueDecimal);
  }
  return total;
}

function classificationOf(fact: DebtFactCandidate): DebtFactClassification {
  if (fact.classification !== undefined) return fact.classification;
  return APPROVED_BUCKET_SET.has(fact.canonicalConceptId)
    ? 'approved_bucket'
    : 'operating_liability';
}

function dependentMetricState(state: DebtResolutionState): 'eligible' | 'insufficient' {
  return state === 'available' ? 'eligible' : 'insufficient';
}

/**
 * Applies borrowings-debt-v2 exactly: approved non-overlapping buckets only,
 * with leases and operating liabilities kept outside the debt total.
 */
export function resolveBorrowingsDebt(input: DebtResolutionInput): DebtResolution {
  const ignoredFacts: { factId: string; reasonCode: string }[] = [];
  const leases: DebtFactCandidate[] = [];
  const candidates: DebtFactCandidate[] = [];
  const reasons = new Set<string>();

  for (const fact of input.facts) {
    parseDecimalString(fact.valueDecimal);
    const classification = classificationOf(fact);
    if (classification === 'lease') {
      leases.push(fact);
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'lease_excluded_from_borrowings_debt' });
      continue;
    }
    if (classification === 'generic_total') {
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'generic_total_disabled_by_default' });
      reasons.add('generic_total_overlap_unresolved');
      continue;
    }
    if (classification === 'operating_liability') {
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'operating_liability_excluded' });
      continue;
    }
    if (classification === 'issuer_extension' && !fact.mappingApprovedForExtension) {
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'issuer_extension_mapping_not_approved' });
      reasons.add('unmapped_borrowing_extension_observed');
      continue;
    }
    if (!APPROVED_BUCKET_SET.has(fact.canonicalConceptId)) {
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'concept_not_approved_debt_bucket' });
      continue;
    }
    if (fact.mappingStatus !== 'ACTIVE'
      || (fact.mappingQuality !== 'exact' && fact.mappingQuality !== 'approved_alias')) {
      ignoredFacts.push({ factId: fact.factId, reasonCode: 'mapping_not_active_exact_or_approved_alias' });
      reasons.add('approved_bucket_mapping_invalid');
      continue;
    }
    candidates.push(fact);
  }

  if ((input.observedUnmappedBorrowingTags?.length ?? 0) > 0) {
    reasons.add('unmapped_borrowing_extension_observed');
  }

  const byBucket = new Map<string, DebtFactCandidate[]>();
  for (const fact of candidates) {
    const bucket = byBucket.get(fact.canonicalConceptId) ?? [];
    bucket.push(fact);
    byBucket.set(fact.canonicalConceptId, bucket);
  }

  const included: DebtFactCandidate[] = [];
  for (const bucketId of APPROVED_DEBT_BUCKETS) {
    const bucketFacts = byBucket.get(bucketId) ?? [];
    if (bucketFacts.length === 0) continue;
    const reference = bucketFacts[0];
    if (reference === undefined) continue;
    const values = new Set(bucketFacts.map((fact) => fact.valueDecimal));
    const dimensionsCompatible = bucketFacts.every((fact) => sameDimensions(reference, fact));
    if (values.size > 1 || !dimensionsCompatible) {
      reasons.add('overlap_or_conflicting_bucket_unresolved');
      continue;
    }
    included.push([...bucketFacts].sort((left, right) => left.factId.localeCompare(right.factId, 'en'))[0] as DebtFactCandidate);
  }

  const includedIds = new Set(included.map((fact) => fact.factId));
  for (const fact of included) {
    if ((fact.overlapsWithFactIds ?? []).some((factId) => includedIds.has(factId))) {
      reasons.add('overlap_or_conflicting_bucket_unresolved');
    }
  }

  const reference = included[0];
  if (reference !== undefined && !included.every((fact) => sameDimensions(reference, fact))) {
    reasons.add('incompatible_currency_scope_instant_or_lineage');
  }

  const absent = new Set(input.absentConceptIds ?? []);
  for (const knownAbsent of KNOWN_ABSENT_SET) absent.add(knownAbsent);
  const completenessProven = APPROVED_DEBT_BUCKETS.every((bucketId) =>
    byBucket.has(bucketId) || absent.has(bucketId));

  let state: DebtResolutionState;
  if (reasons.has('incompatible_currency_scope_instant_or_lineage')) {
    state = 'insufficient';
  } else if (included.length === 0) {
    state = completenessProven && reasons.size === 0 ? 'available' : 'insufficient';
    if (state === 'insufficient') reasons.add('approved_debt_absence_not_established');
  } else if (!completenessProven || reasons.size > 0) {
    state = 'partial';
    if (!completenessProven) reasons.add('debt_bucket_completeness_not_proven');
  } else {
    state = 'available';
  }

  const sortedIncluded = [...included].sort(compareByBucket);
  const sortedLeases = [...leases].sort((left, right) => left.factId.localeCompare(right.factId, 'en'));
  const metricState = dependentMetricState(state);
  const base = {
    policyId: catalog.debtPolicy.policyId,
    policyVersion: catalog.debtPolicy.version,
    state,
    includedFactIds: Object.freeze(sortedIncluded.map((fact) => fact.factId)),
    leaseFactIds: Object.freeze(sortedLeases.map((fact) => fact.factId)),
    ignoredFacts: Object.freeze(ignoredFacts
      .sort((left, right) => left.factId.localeCompare(right.factId, 'en'))
      .map((item) => Object.freeze(item))),
    reasonCodes: Object.freeze([...reasons].sort((left, right) => left.localeCompare(right, 'en'))),
    dependentMetrics: Object.freeze({
      FND_NET_DEBT: metricState,
      FND_DEBT_EQUITY: metricState,
    }),
  };
  return Object.freeze({
    ...base,
    ...(state === 'available' ? { valueDecimal: sumValues(sortedIncluded) } : {}),
    ...(sortedLeases.length > 0 ? { leaseValueDecimal: sumValues(sortedLeases) } : {}),
  });
}
