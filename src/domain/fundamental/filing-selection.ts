export const ADMITTED_STATEMENT_FORMS = Object.freeze([
  '10-K', '10-K/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '6-K', '6-K/A', '40-F', '40-F/A',
] as const);
export const EVIDENCE_ONLY_FORMS = Object.freeze(['8-K', '8-K/A'] as const);

export type SecFactSource = 'company_facts' | 'company_concept';
export type FilingSelectionReasonCode =
  | 'form_not_admitted'
  | 'evidence_only_form'
  | 'mapping_not_active'
  | 'scope_incompatible'
  | 'unit_incompatible'
  | 'exact_duplicate_collapsed'
  | 'amendment_precedence'
  | 'restatement_precedence'
  | 'conflicting_equal_precedence';

export interface SecFactCandidate {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly unit: string;
  readonly start?: string;
  readonly end: string;
  readonly scope: string;
  readonly source: SecFactSource;
  readonly form: string;
  readonly filed: string;
  readonly accessionNumber: string;
  readonly value: string;
  readonly mappingStatus: 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';
  readonly mappingQuality: 'exact' | 'approved_alias';
  readonly mappingVersion: string;
  readonly profileCompatible: boolean;
  readonly scopeCompatible: boolean;
  readonly containsConcept?: boolean;
  readonly frame?: string;
}

export interface FactPeriod {
  readonly kind: 'instant' | 'duration';
  readonly start?: string;
  readonly end: string;
}

export interface FactSourceReference {
  readonly factId: string;
  readonly source: SecFactSource;
  readonly accessionNumber: string;
  readonly form: string;
  readonly filed: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly unit: string;
  readonly period: FactPeriod;
  readonly scope: string;
  readonly mappingVersion: string;
  readonly frame?: string;
}

export interface SelectedFilingFact {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly value: string;
  readonly unit: string;
  readonly period: FactPeriod;
  readonly scope: string;
  readonly sourceRefs: readonly FactSourceReference[];
  readonly lineageSourceRefs: readonly FactSourceReference[];
  readonly reasonCodes: readonly FilingSelectionReasonCode[];
}

export type FilingFactSelection =
  | Readonly<{ state: 'selected'; fact: SelectedFilingFact; evidence: readonly FactSourceReference[] }>
  | Readonly<{ state: 'evidence_only'; evidence: readonly FactSourceReference[]; reasonCode: 'evidence_only_form' }>
  | Readonly<{ state: 'ambiguous'; evidence: readonly FactSourceReference[]; reasonCode: 'conflicting_equal_precedence' }>
  | Readonly<{ state: 'incompatible'; evidence: readonly FactSourceReference[]; reasonCode: 'unit_incompatible' | 'scope_incompatible' }>
  | Readonly<{ state: 'not_found'; evidence: readonly FactSourceReference[]; reasonCodes: readonly FilingSelectionReasonCode[] }>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new TypeError(`INVALID_${field.toUpperCase()}`);
  }
}

export function extractFactPeriod(candidate: Pick<SecFactCandidate, 'start' | 'end'>): FactPeriod {
  assertIsoDate(candidate.end, 'period_end');
  if (candidate.start === undefined) {
    return Object.freeze({ kind: 'instant' as const, end: candidate.end });
  }
  assertIsoDate(candidate.start, 'period_start');
  if (candidate.start > candidate.end) throw new TypeError('INVALID_FACT_PERIOD_ORDER');
  return Object.freeze({ kind: 'duration' as const, start: candidate.start, end: candidate.end });
}

export function createFactSourceReference(candidate: SecFactCandidate): FactSourceReference {
  assertIsoDate(candidate.filed, 'filed');
  const base = {
    factId: candidate.factId,
    source: candidate.source,
    accessionNumber: candidate.accessionNumber,
    form: candidate.form,
    filed: candidate.filed,
    taxonomy: candidate.taxonomy,
    tag: candidate.tag,
    unit: candidate.unit,
    period: extractFactPeriod(candidate),
    scope: candidate.scope,
    mappingVersion: candidate.mappingVersion,
  };
  return candidate.frame === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, frame: candidate.frame });
}

function isAdmittedForm(form: string): boolean {
  return (ADMITTED_STATEMENT_FORMS as readonly string[]).includes(form);
}

function isEvidenceOnlyForm(form: string): boolean {
  return (EVIDENCE_ONLY_FORMS as readonly string[]).includes(form);
}

function sameSelectionGroup(left: SecFactCandidate, right: SecFactCandidate): boolean {
  return left.canonicalConceptId === right.canonicalConceptId
    && left.taxonomy === right.taxonomy
    && left.tag === right.tag
    && left.unit === right.unit
    && left.start === right.start
    && left.end === right.end
    && left.scope === right.scope;
}

function stableSourceReferences(candidates: readonly SecFactCandidate[]): readonly FactSourceReference[] {
  return Object.freeze(
    [...candidates]
      .sort((left, right) => left.accessionNumber.localeCompare(right.accessionNumber, 'en'))
      .map(createFactSourceReference),
  );
}

function latestFiled(candidates: readonly SecFactCandidate[]): string {
  return candidates.reduce((latest, candidate) => candidate.filed > latest ? candidate.filed : latest, '');
}

export function selectFilingFact(candidatesInput: readonly SecFactCandidate[]): FilingFactSelection {
  const candidates = Object.freeze([...candidatesInput]);
  const evidenceCandidates = candidates.filter((candidate) => isEvidenceOnlyForm(candidate.form) || candidate.frame !== undefined);
  const evidence = stableSourceReferences(evidenceCandidates);
  const reasons = new Set<FilingSelectionReasonCode>();

  const selectable = candidates.filter((candidate) => {
    if (candidate.containsConcept === false) return false;
    if (candidate.mappingStatus !== 'ACTIVE' || candidate.mappingQuality !== 'exact') {
      reasons.add('mapping_not_active');
      return false;
    }
    if (!candidate.profileCompatible || !candidate.scopeCompatible) {
      reasons.add('scope_incompatible');
      return false;
    }
    if (isEvidenceOnlyForm(candidate.form) || candidate.frame !== undefined) {
      reasons.add('evidence_only_form');
      return false;
    }
    if (!isAdmittedForm(candidate.form)) {
      reasons.add('form_not_admitted');
      return false;
    }
    return true;
  });

  if (selectable.length === 0) {
    if (evidence.length > 0 && reasons.size === 1 && reasons.has('evidence_only_form')) {
      return Object.freeze({ state: 'evidence_only' as const, evidence, reasonCode: 'evidence_only_form' as const });
    }
    return Object.freeze({
      state: 'not_found' as const,
      evidence,
      reasonCodes: Object.freeze([...reasons].sort()),
    });
  }

  const reference = selectable[0];
  if (reference === undefined) throw new Error('UNREACHABLE_EMPTY_SELECTABLE');
  const sameConceptPeriodScope = selectable.filter((candidate) => (
    candidate.canonicalConceptId === reference.canonicalConceptId
    && candidate.start === reference.start
    && candidate.end === reference.end
    && candidate.scope === reference.scope
  ));
  const units = new Set(sameConceptPeriodScope.map((candidate) => candidate.unit));
  if (units.size > 1) {
    return Object.freeze({
      state: 'incompatible' as const,
      evidence: stableSourceReferences(sameConceptPeriodScope),
      reasonCode: 'unit_incompatible' as const,
    });
  }

  const group = selectable.filter((candidate) => sameSelectionGroup(reference, candidate));
  const latest = latestFiled(group);
  const effective = group.filter((candidate) => candidate.filed === latest);
  const values = new Set(effective.map((candidate) => candidate.value));
  const lineageSourceRefs = stableSourceReferences(group);
  if (values.size > 1) {
    return Object.freeze({
      state: 'ambiguous' as const,
      evidence: lineageSourceRefs,
      reasonCode: 'conflicting_equal_precedence' as const,
    });
  }

  const chosen = [...effective].sort(
    (left, right) => left.accessionNumber.localeCompare(right.accessionNumber, 'en'),
  )[0];
  if (chosen === undefined) throw new Error('UNREACHABLE_EMPTY_EFFECTIVE_SELECTION');
  const reasonCodes: FilingSelectionReasonCode[] = [];
  if (effective.length > 1) reasonCodes.push('exact_duplicate_collapsed');
  if (chosen.form.endsWith('/A')) reasonCodes.push('amendment_precedence');
  if (group.some((candidate) => candidate.filed < chosen.filed && candidate.value !== chosen.value)) {
    reasonCodes.push('restatement_precedence');
  }

  return Object.freeze({
    state: 'selected' as const,
    fact: Object.freeze({
      factId: chosen.factId,
      canonicalConceptId: chosen.canonicalConceptId,
      value: chosen.value,
      unit: chosen.unit,
      period: extractFactPeriod(chosen),
      scope: chosen.scope,
      sourceRefs: stableSourceReferences(effective),
      lineageSourceRefs,
      reasonCodes: Object.freeze(reasonCodes),
    }),
    evidence,
  });
}
