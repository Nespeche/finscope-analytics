import { assertDecimalString } from '../../core/decimal';
import {
  fundamentalInputFingerprint,
  sourceEvidenceFingerprint,
} from '../fingerprints/fingerprint-service';
import type { SourceEvidenceReferenceInput } from '../fingerprints/projections';
import type { IssuerIdentity } from '../model';
import {
  parseFundamentalBundle,
  type FundamentalBundle,
  type FundamentalConceptResolution,
  type FundamentalCoverage,
  type FundamentalFact,
  type ReportingPeriod,
} from './types';

const FORBIDDEN_PRICE_FIELDS = new Set([
  'historicalPriceOverlay',
  'historicalPriceOverlayFingerprint',
  'priceAnalysisFingerprint',
  'priceMetricResults',
  'priceQuality',
  'priceUse',
  'observations',
  'instrument',
  'overlayId',
  'overlayVersion',
]);

const FORBIDDEN_LOCAL_CLOCK_FIELDS = new Set([
  'asOfLocalDate',
  'localDate',
  'localTime',
  'localTimezone',
  'localTimestamp',
]);

const GENERATED_FINGERPRINT_FIELDS = new Set([
  'fundamentalInputFingerprint',
  'sourceEvidenceFingerprint',
]);

export interface FundamentalMappingLineage {
  readonly mappingId: string;
  readonly mappingVersion: string;
}

export interface FundamentalFingerprintLineage {
  readonly mappings: readonly FundamentalMappingLineage[];
  readonly currencies: readonly string[];
  readonly units: readonly string[];
  readonly scopes: readonly string[];
}

export interface FundamentalBundleBuilderInput {
  readonly bundleId: string;
  readonly contractVersion: '5.0.0';
  readonly issuer: IssuerIdentity;
  readonly sourceAcquisition: FundamentalBundle['sourceAcquisition'];
  readonly reportingPeriods: readonly ReportingPeriod[];
  readonly facts: readonly FundamentalFact[];
  readonly conceptResolutions: readonly FundamentalConceptResolution[];
  readonly coverage: readonly FundamentalCoverage[];
  readonly versions: FundamentalBundle['versions'];
  readonly fingerprintLineage: FundamentalFingerprintLineage;
  readonly sourceEvidenceReferences: readonly SourceEvidenceReferenceInput[];
  readonly filings?: FundamentalBundle['filings'];
  readonly createdAt?: string;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'en');
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort(compareText));
}

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) throw new TypeError(`EMPTY_${field.toUpperCase()}`);
}

function assertNoForbiddenFields(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenFields(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (
      FORBIDDEN_PRICE_FIELDS.has(key)
      || FORBIDDEN_LOCAL_CLOCK_FIELDS.has(key)
      || GENERATED_FINGERPRINT_FIELDS.has(key)
    ) {
      throw new TypeError(`FORBIDDEN_FUNDAMENTAL_BUNDLE_FIELD:${path}.${key}`);
    }
    assertNoForbiddenFields(child, `${path}.${key}`);
  }
}

function assertExactSet(
  declared: readonly string[],
  derived: readonly string[],
  field: string,
): readonly string[] {
  const normalizedDeclared = uniqueSorted(declared);
  const normalizedDerived = uniqueSorted(derived);
  if (JSON.stringify(normalizedDeclared) !== JSON.stringify(normalizedDerived)) {
    throw new TypeError(
      `INCOMPLETE_${field.toUpperCase()}_LINEAGE:${JSON.stringify({ declared: normalizedDeclared, derived: normalizedDerived })}`,
    );
  }
  return normalizedDeclared;
}

function sortedFilings(
  filings: FundamentalBundle['filings'] | undefined,
): FundamentalBundle['filings'] | undefined {
  if (filings === undefined) return undefined;
  return Object.freeze([...filings]
    .map((filing) => Object.freeze({ ...filing }))
    .sort((left, right) => compareText(left.filedDate, right.filedDate)
      || compareText(left.accessionNumber, right.accessionNumber)
      || compareText(left.form, right.form)));
}

function sortedPeriods(periods: readonly ReportingPeriod[]): readonly ReportingPeriod[] {
  return Object.freeze([...periods]
    .map((period) => Object.freeze({ ...period }))
    .sort((left, right) => compareText(left.endDate, right.endDate)
      || compareText(left.startDate ?? '', right.startDate ?? '')
      || compareText(left.periodId, right.periodId)
      || compareText(left.scopeId, right.scopeId)));
}

function sortedFacts(facts: readonly FundamentalFact[]): readonly FundamentalFact[] {
  for (const fact of facts) {
    assertNonEmpty(fact.factId, 'fact_id');
    assertNonEmpty(fact.canonicalConceptId, 'canonical_concept_id');
    assertNonEmpty(fact.periodId, 'period_id');
    assertNonEmpty(fact.scopeId, 'scope_id');
    assertNonEmpty(fact.mappingId, 'mapping_id');
    assertNonEmpty(fact.mappingVersion, 'mapping_version');
    assertNonEmpty(fact.sourceRef, 'source_ref');
    assertDecimalString(fact.valueDecimal);
  }
  return Object.freeze([...facts]
    .map((fact) => Object.freeze({ ...fact }))
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.periodId, right.periodId)
      || compareText(left.scopeId, right.scopeId)
      || compareText(left.factId, right.factId)));
}

function sortedResolutions(
  resolutions: readonly FundamentalConceptResolution[],
): readonly FundamentalConceptResolution[] {
  return Object.freeze([...resolutions]
    .map((resolution) => Object.freeze({ ...resolution }))
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.periodId, right.periodId)
      || compareText(left.scopeId, right.scopeId)
      || compareText(left.factId ?? '', right.factId ?? '')));
}

function sortedCoverage(coverage: readonly FundamentalCoverage[]): readonly FundamentalCoverage[] {
  return Object.freeze([...coverage]
    .map((item) => Object.freeze({
      ...item,
      resolvedMappingIds: uniqueSorted(item.resolvedMappingIds),
    }))
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.profileId, right.profileId)));
}

function normalizedMappings(
  mappings: readonly FundamentalMappingLineage[],
): readonly FundamentalMappingLineage[] {
  const byKey = new Map<string, FundamentalMappingLineage>();
  for (const mapping of mappings) {
    assertNonEmpty(mapping.mappingId, 'mapping_id');
    assertNonEmpty(mapping.mappingVersion, 'mapping_version');
    const key = `${mapping.mappingId}\u0000${mapping.mappingVersion}`;
    if (byKey.has(key)) throw new TypeError(`DUPLICATE_MAPPING_LINEAGE:${mapping.mappingId}`);
    byKey.set(key, Object.freeze({ ...mapping }));
  }
  return Object.freeze([...byKey.values()].sort((left, right) => compareText(left.mappingId, right.mappingId)
    || compareText(left.mappingVersion, right.mappingVersion)));
}

function validateMappingLineage(
  facts: readonly FundamentalFact[],
  coverage: readonly FundamentalCoverage[],
  mappings: readonly FundamentalMappingLineage[],
): void {
  const mappingIds = new Set(mappings.map((mapping) => mapping.mappingId));
  const mappingPairs = new Set(mappings.map((mapping) => `${mapping.mappingId}\u0000${mapping.mappingVersion}`));
  for (const fact of facts) {
    if (!mappingPairs.has(`${fact.mappingId}\u0000${fact.mappingVersion}`)) {
      throw new TypeError(`MISSING_FACT_MAPPING_LINEAGE:${fact.factId}:${fact.mappingId}`);
    }
  }
  for (const item of coverage) {
    for (const mappingId of item.resolvedMappingIds) {
      if (!mappingIds.has(mappingId)) {
        throw new TypeError(`MISSING_COVERAGE_MAPPING_LINEAGE:${item.canonicalConceptId}:${mappingId}`);
      }
    }
  }
}

/**
 * Builds one immutable, schema-valid fundamental bundle candidate. Fingerprints are
 * always produced by the shared T046 service; the builder never reads a local clock.
 */
export async function buildFundamentalBundle(
  input: FundamentalBundleBuilderInput,
): Promise<FundamentalBundle> {
  assertNoForbiddenFields(input);
  if (input.sourceEvidenceReferences.length === 0) {
    throw new TypeError('MISSING_SOURCE_EVIDENCE_LINEAGE');
  }

  const filings = sortedFilings(input.filings);
  const reportingPeriods = sortedPeriods(input.reportingPeriods);
  const facts = sortedFacts(input.facts);
  const conceptResolutions = sortedResolutions(input.conceptResolutions);
  const coverage = sortedCoverage(input.coverage);
  const mappings = normalizedMappings(input.fingerprintLineage.mappings);
  validateMappingLineage(facts, coverage, mappings);

  const currencies = assertExactSet(
    input.fingerprintLineage.currencies,
    reportingPeriods.flatMap((period) => period.currency === undefined ? [] : [period.currency]),
    'currency',
  );
  const units = assertExactSet(
    input.fingerprintLineage.units,
    facts.flatMap((fact) => fact.unit === undefined ? [] : [fact.unit]),
    'unit',
  );
  const scopes = assertExactSet(
    input.fingerprintLineage.scopes,
    [
      ...reportingPeriods.map((period) => period.scopeId),
      ...facts.map((fact) => fact.scopeId),
      ...conceptResolutions.map((resolution) => resolution.scopeId),
    ],
    'scope',
  );

  const fingerprintProjection = {
    contractVersion: input.contractVersion,
    issuer: input.issuer,
    filings: filings ?? Object.freeze([]),
    reportingPeriods,
    facts,
    conceptResolutions,
    mappings,
    coverage,
    currencies,
    units,
    scopes,
    versions: input.versions,
  };

  const [inputFingerprint, evidenceFingerprint] = await Promise.all([
    fundamentalInputFingerprint(fingerprintProjection),
    sourceEvidenceFingerprint(input.sourceEvidenceReferences),
  ]);

  const candidate = {
    bundleId: input.bundleId,
    contractVersion: input.contractVersion,
    issuer: input.issuer,
    sourceAcquisition: Object.freeze({
      ...input.sourceAcquisition,
      companyConceptFallbacks: uniqueSorted(input.sourceAcquisition.companyConceptFallbacks),
    }),
    reportingPeriods,
    facts,
    conceptResolutions,
    coverage,
    versions: Object.freeze({ ...input.versions }),
    fundamentalInputFingerprint: inputFingerprint,
    ...(filings === undefined ? {} : { filings }),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    sourceEvidenceFingerprint: evidenceFingerprint,
  };

  return parseFundamentalBundle(candidate);
}
