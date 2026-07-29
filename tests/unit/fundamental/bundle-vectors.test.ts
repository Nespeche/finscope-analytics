import { describe, expect, it } from 'vitest';
import { createProductSchemaValidator } from '../../../src/core/schema-validator';
import { fundamentalAnalysisFingerprint } from '../../../src/domain/fingerprints/fingerprint-service';
import {
  buildFundamentalAnalysis,
  type FundamentalAnalysisBuilderInput,
} from '../../../src/domain/fundamental/analysis-builder';
import {
  buildFundamentalBundle,
  type FundamentalBundleBuilderInput,
} from '../../../src/domain/fundamental/bundle-builder';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
  type FundamentalAnalysis,
  type FundamentalBundle,
  type FundamentalMetricResult,
} from '../../../src/domain/fundamental/types';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import fundamentalBundleSchemaJson from '../../../specs/001-fundamental-analysis-platform/schemas/fundamental-bundle.schema.json';
import analysisResultsSchemaJson from '../../../specs/001-fundamental-analysis-platform/schemas/analysis-results.schema.json';

interface SchemaFixture {
  readonly fixtureId: string;
  readonly expectedValid: boolean;
  readonly input: unknown;
}

interface SchemaFixtureSet {
  readonly validFixtures: readonly SchemaFixture[];
  readonly negativeFixtures: readonly SchemaFixture[];
}

const bundleVectors = bundleVectorsJson as unknown as SchemaFixtureSet;
const analysisVectors = analysisVectorsJson as unknown as SchemaFixtureSet;
const validBundle = parseFundamentalBundle(bundleVectors.validFixtures[0]?.input);
const validAnalysis = parseFundamentalAnalysis(
  analysisVectors.validFixtures.find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeepFrozen);
}

function bundleBuilderInput(bundle: FundamentalBundle = validBundle): FundamentalBundleBuilderInput {
  const mappings = bundle.facts.map((fact) => ({
    mappingId: fact.mappingId,
    mappingVersion: fact.mappingVersion,
  }));
  const currencies = bundle.reportingPeriods.flatMap((period) => (
    period.currency === undefined ? [] : [period.currency]
  ));
  const units = bundle.facts.flatMap((fact) => fact.unit === undefined ? [] : [fact.unit]);
  const scopes = [
    ...bundle.reportingPeriods.map((period) => period.scopeId),
    ...bundle.facts.map((fact) => fact.scopeId),
    ...bundle.conceptResolutions.map((resolution) => resolution.scopeId),
  ];
  return {
    bundleId: bundle.bundleId,
    contractVersion: bundle.contractVersion,
    issuer: bundle.issuer,
    sourceAcquisition: bundle.sourceAcquisition,
    reportingPeriods: bundle.reportingPeriods,
    facts: bundle.facts,
    conceptResolutions: bundle.conceptResolutions,
    coverage: bundle.coverage,
    versions: bundle.versions,
    fingerprintLineage: { mappings, currencies, units, scopes },
    sourceEvidenceReferences: [{
      sourceKind: 'sec_company_facts',
      sourceId: 'sec-companyfacts-0000320193',
      payloadSha256: 'e'.repeat(64),
      retrievedVersion: 'companyfacts-v1',
    }],
    ...(bundle.filings === undefined ? {} : { filings: bundle.filings }),
    ...(bundle.createdAt === undefined ? {} : { createdAt: bundle.createdAt }),
  };
}

function analysisBuilderInput(
  analysis: FundamentalAnalysis = validAnalysis,
): FundamentalAnalysisBuilderInput {
  return {
    analysisId: analysis.analysisId,
    issuerCik: analysis.issuerCik,
    fundamentalInputFingerprint: analysis.fundamentalInputFingerprint,
    metricResults: analysis.metricResults,
    ruleEvaluations: analysis.ruleEvaluations,
    versions: analysis.versions,
    additionalLimitations: analysis.synthesis.limitations ?? [],
    ...(analysis.createdAt === undefined ? {} : { createdAt: analysis.createdAt }),
  };
}

describe('fundamental bundle and analysis builders', () => {
  it('passes every positive and negative normative bundle/analysis schema vector', () => {
    const validator = createProductSchemaValidator();
    const bundleSchemaId = (fundamentalBundleSchemaJson as { readonly $id: string }).$id;
    const analysisSchemaId = (analysisResultsSchemaJson as { readonly $id: string }).$id;

    for (const fixture of bundleVectors.validFixtures) {
      expect(validator.validate(bundleSchemaId, fixture.input).valid, fixture.fixtureId).toBe(true);
    }
    for (const fixture of bundleVectors.negativeFixtures) {
      expect(validator.validate(bundleSchemaId, fixture.input).valid, fixture.fixtureId).toBe(false);
    }
    for (const fixture of analysisVectors.validFixtures) {
      expect(validator.validate(analysisSchemaId, fixture.input).valid, fixture.fixtureId).toBe(true);
    }
    for (const fixture of analysisVectors.negativeFixtures) {
      expect(validator.validate(analysisSchemaId, fixture.input).valid, fixture.fixtureId).toBe(false);
    }
  });

  it('builds deterministic immutable candidates with complete lineage and no price fields', async () => {
    const bundleInput = bundleBuilderInput();
    const bundle = await buildFundamentalBundle(bundleInput);
    const reorderedBundle = await buildFundamentalBundle({
      ...bundleInput,
      reportingPeriods: [...bundleInput.reportingPeriods].reverse(),
      facts: [...bundleInput.facts].reverse(),
      conceptResolutions: [...bundleInput.conceptResolutions].reverse(),
      coverage: [...bundleInput.coverage].reverse(),
      fingerprintLineage: {
        mappings: [...bundleInput.fingerprintLineage.mappings].reverse(),
        currencies: [...bundleInput.fingerprintLineage.currencies].reverse(),
        units: [...bundleInput.fingerprintLineage.units].reverse(),
        scopes: [...bundleInput.fingerprintLineage.scopes].reverse(),
      },
      sourceEvidenceReferences: [...bundleInput.sourceEvidenceReferences].reverse(),
    });

    expect(bundle.fundamentalInputFingerprint).toBe(reorderedBundle.fundamentalInputFingerprint);
    expect(bundle.sourceEvidenceFingerprint).toBe(reorderedBundle.sourceEvidenceFingerprint);
    expect(bundle).toEqual(reorderedBundle);
    expect(isDeepFrozen(bundle)).toBe(true);
    expect(bundle).not.toHaveProperty('historicalPriceOverlay');
    expect(bundle).not.toHaveProperty('priceAnalysisFingerprint');

    const analysisInput = analysisBuilderInput();
    const analysis = await buildFundamentalAnalysis(analysisInput);
    const reorderedAnalysis = await buildFundamentalAnalysis({
      ...analysisInput,
      metricResults: [...analysisInput.metricResults].reverse(),
      ruleEvaluations: [...analysisInput.ruleEvaluations].reverse(),
      additionalLimitations: [...(analysisInput.additionalLimitations ?? [])].reverse(),
      versions: Object.fromEntries(Object.entries(analysisInput.versions).reverse()),
    });

    expect(analysis).toEqual(reorderedAnalysis);
    expect(analysis.fundamentalAnalysisFingerprint).toBe(
      await fundamentalAnalysisFingerprint(analysis),
    );
    expect(isDeepFrozen(analysis)).toBe(true);
    expect(analysis).not.toHaveProperty('priceMetricResults');
    expect(analysis).not.toHaveProperty('priceAnalysisFingerprint');
    expect(analysis.synthesis.limitations).toContain(
      'INS_GROWTH_MARGIN_DETERIORATION: prior period missing (prior_period_missing)',
    );
  });

  it('keeps absent or ambiguous concepts descriptive instead of guessing or failing globally', async () => {
    const input = bundleBuilderInput();
    const partial = await buildFundamentalBundle({
      ...input,
      facts: [],
      conceptResolutions: [{
        canonicalConceptId: 'revenue',
        periodId: 'FY2025',
        scopeId: 'consolidated',
        state: 'ambiguous',
        reasonCode: 'multiple_equally_valid_mappings',
      }],
      coverage: [{
        canonicalConceptId: 'revenue',
        profileId: 'general_operating_us_gaap',
        state: 'partial',
        resolvedMappingIds: [],
        reasonCode: 'ambiguous_mapping',
      }],
      fingerprintLineage: {
        mappings: [],
        currencies: input.fingerprintLineage.currencies,
        units: [],
        scopes: ['consolidated'],
      },
    });

    expect(partial.facts).toEqual([]);
    expect(partial.conceptResolutions[0]).toMatchObject({
      state: 'ambiguous', reasonCode: 'multiple_equally_valid_mappings',
    });
    expect(partial.coverage[0]).toMatchObject({ state: 'partial', reasonCode: 'ambiguous_mapping' });
  });

  it('rejects non-canonical decimals, incomplete lineage, generated fingerprints and price contamination', async () => {
    const input = bundleBuilderInput();
    const invalidFact = {
      ...input.facts[0],
      valueDecimal: '1000.00',
    } as unknown as FundamentalBundle['facts'][number];

    await expect(buildFundamentalBundle({ ...input, facts: [invalidFact] }))
      .rejects.toMatchObject({
        name: 'DecimalStringError',
        code: 'NON_CANONICAL_DECIMAL',
      });
    await expect(buildFundamentalBundle({
      ...input,
      fingerprintLineage: { ...input.fingerprintLineage, mappings: [] },
    })).rejects.toThrow('MISSING_FACT_MAPPING_LINEAGE');
    await expect(buildFundamentalBundle({ ...input, sourceEvidenceReferences: [] }))
      .rejects.toThrow('MISSING_SOURCE_EVIDENCE_LINEAGE');
    await expect(buildFundamentalBundle({
      ...input,
      historicalPriceOverlay: {},
    } as unknown as FundamentalBundleBuilderInput)).rejects.toThrow('FORBIDDEN_FUNDAMENTAL_BUNDLE_FIELD');

    const analysisInput = analysisBuilderInput();
    const marketMetric = {
      ...analysisInput.metricResults[0],
      metricId: 'MKT_SIMPLE_RETURN',
    } as FundamentalMetricResult;
    await expect(buildFundamentalAnalysis({ ...analysisInput, metricResults: [marketMetric] }))
      .rejects.toThrow('PRICE_OR_UNKNOWN_METRIC');
    await expect(buildFundamentalAnalysis({
      ...analysisInput,
      fundamentalAnalysisFingerprint: `sha256:${'a'.repeat(64)}`,
    } as unknown as FundamentalAnalysisBuilderInput))
      .rejects.toThrow('FORBIDDEN_FUNDAMENTAL_ANALYSIS_FIELD');
  });
});
