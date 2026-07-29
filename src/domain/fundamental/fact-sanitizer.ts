import { canonicalizeDecimalString, type DecimalString } from '../../core/decimal';
import { cloneAndFreezeDomainRecord } from '../model';

export interface RawFundamentalFact {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly periodId: string;
  readonly scopeId: string;
  readonly value: unknown;
  readonly mappingId: string;
  readonly mappingVersion: string;
  readonly sourceRef: string;
  readonly unit?: string;
  readonly scale?: string | number | null;
  readonly sign?: string | null;
  readonly dimensions?: Readonly<Record<string, string>>;
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface SanitizedFundamentalFact {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly periodId: string;
  readonly scopeId: string;
  readonly valueDecimal: DecimalString;
  readonly rawValue: string;
  readonly mappingId: string;
  readonly mappingVersion: string;
  readonly sourceRef: string;
  readonly unit?: string;
  readonly scale?: string | number | null;
  readonly sign?: string | null;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly provenance: Readonly<Record<string, unknown>>;
}

export interface InvalidFactValueIssue {
  readonly code: 'invalid_fact_value';
  readonly pipelineState: 'partial';
  readonly blockedOperations: readonly ['normalization'];
  readonly preservedCapabilities: readonly [
    'issuer_identity',
    'filings',
    'definitions',
    'mappings',
    'evidence',
    'local_snapshot',
  ];
  readonly recoveryActions: readonly ['review_source_fact', 'continue_with_compatible_metrics'];
  readonly factId: string;
  readonly sourceRef: string;
}

export type FactSanitizationResult =
  | Readonly<{
      state: 'sanitized';
      fact: SanitizedFundamentalFact;
      fingerprintEligible: true;
    }>
  | Readonly<{
      state: 'excluded';
      issue: InvalidFactValueIssue;
      rawProvenance: Readonly<Record<string, unknown>>;
      fingerprintEligible: false;
    }>;

const BLOCKED_OPERATIONS = Object.freeze(['normalization'] as const);
const PRESERVED_CAPABILITIES = Object.freeze([
  'issuer_identity',
  'filings',
  'definitions',
  'mappings',
  'evidence',
  'local_snapshot',
] as const);
const RECOVERY_ACTIONS = Object.freeze([
  'review_source_fact',
  'continue_with_compatible_metrics',
] as const);

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) throw new TypeError(`EMPTY_${field.toUpperCase()}`);
}

function rawProvenance(input: RawFundamentalFact): Readonly<Record<string, unknown>> {
  return cloneAndFreezeDomainRecord({
    factId: input.factId,
    canonicalConceptId: input.canonicalConceptId,
    periodId: input.periodId,
    scopeId: input.scopeId,
    value: input.value,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
    sourceRef: input.sourceRef,
    ...(input.unit === undefined ? {} : { unit: input.unit }),
    ...(input.scale === undefined ? {} : { scale: input.scale }),
    ...(input.sign === undefined ? {} : { sign: input.sign }),
    dimensions: input.dimensions ?? {},
    provenance: input.provenance ?? {},
  });
}

/** Invalid numeric tokens are excluded before any fingerprint candidate exists. */
export function sanitizeFundamentalFact(input: RawFundamentalFact): FactSanitizationResult {
  assertNonEmpty(input.factId, 'fact_id');
  assertNonEmpty(input.canonicalConceptId, 'canonical_concept_id');
  assertNonEmpty(input.periodId, 'period_id');
  assertNonEmpty(input.scopeId, 'scope_id');
  assertNonEmpty(input.mappingId, 'mapping_id');
  assertNonEmpty(input.mappingVersion, 'mapping_version');
  assertNonEmpty(input.sourceRef, 'source_ref');

  const provenance = rawProvenance(input);
  if (typeof input.value !== 'string') {
    return Object.freeze({
      state: 'excluded' as const,
      issue: Object.freeze({
        code: 'invalid_fact_value' as const,
        pipelineState: 'partial' as const,
        blockedOperations: BLOCKED_OPERATIONS,
        preservedCapabilities: PRESERVED_CAPABILITIES,
        recoveryActions: RECOVERY_ACTIONS,
        factId: input.factId,
        sourceRef: input.sourceRef,
      }),
      rawProvenance: provenance,
      fingerprintEligible: false as const,
    });
  }

  try {
    const valueDecimal = canonicalizeDecimalString(input.value);
    const fact = cloneAndFreezeDomainRecord({
      factId: input.factId,
      canonicalConceptId: input.canonicalConceptId,
      periodId: input.periodId,
      scopeId: input.scopeId,
      valueDecimal,
      rawValue: input.value,
      mappingId: input.mappingId,
      mappingVersion: input.mappingVersion,
      sourceRef: input.sourceRef,
      ...(input.unit === undefined ? {} : { unit: input.unit }),
      ...(input.scale === undefined ? {} : { scale: input.scale }),
      ...(input.sign === undefined ? {} : { sign: input.sign }),
      dimensions: input.dimensions ?? {},
      provenance: input.provenance ?? {},
    });
    return Object.freeze({ state: 'sanitized' as const, fact, fingerprintEligible: true as const });
  } catch {
    return Object.freeze({
      state: 'excluded' as const,
      issue: Object.freeze({
        code: 'invalid_fact_value' as const,
        pipelineState: 'partial' as const,
        blockedOperations: BLOCKED_OPERATIONS,
        preservedCapabilities: PRESERVED_CAPABILITIES,
        recoveryActions: RECOVERY_ACTIONS,
        factId: input.factId,
        sourceRef: input.sourceRef,
      }),
      rawProvenance: provenance,
      fingerprintEligible: false as const,
    });
  }
}

export function sanitizeFundamentalFacts(inputs: readonly RawFundamentalFact[]): Readonly<{
  facts: readonly SanitizedFundamentalFact[];
  issues: readonly InvalidFactValueIssue[];
}> {
  const facts: SanitizedFundamentalFact[] = [];
  const issues: InvalidFactValueIssue[] = [];
  for (const input of inputs) {
    const result = sanitizeFundamentalFact(input);
    if (result.state === 'sanitized') facts.push(result.fact);
    else issues.push(result.issue);
  }
  facts.sort((left, right) => left.canonicalConceptId.localeCompare(right.canonicalConceptId, 'en')
    || left.periodId.localeCompare(right.periodId, 'en')
    || left.scopeId.localeCompare(right.scopeId, 'en')
    || left.factId.localeCompare(right.factId, 'en'));
  issues.sort((left, right) => left.factId.localeCompare(right.factId, 'en'));
  return Object.freeze({ facts: Object.freeze(facts), issues: Object.freeze(issues) });
}
