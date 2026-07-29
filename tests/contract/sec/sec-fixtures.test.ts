import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import acquisitionPolicy from '../../../specs/001-fundamental-analysis-platform/contracts/sec-acquisition-policy.json';
import selectionPolicy from '../../../specs/001-fundamental-analysis-platform/contracts/sec-filing-fact-selection-policy.json';
import acquisitionVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-acquisition-test-vectors.json';
import rawManifest from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/raw/manifest.json';
import schemaExamples from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-schema-examples.json';
import selectionVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/sec/sec-selection-test-vectors.json';
import { createProductSchemaValidator } from '../../../src/core/schema-validator';
import { createAcquisitionPlan } from '../../../src/domain/acquisition/acquisition-plan';
import type { OrderedFallback } from '../../../src/domain/acquisition/fallback-order';
import { selectFilingFact, type SecFactCandidate } from '../../../src/domain/fundamental/filing-selection';

const SEC_ACQUISITION_SCHEMA = 'https://finscope.local/schemas/sec-acquisition.schema.json';
const rawRoot = 'specs/001-fundamental-analysis-platform/fixtures/sec/raw';

function fallback(canonicalConceptId: string, tag: string, profileOrder: number): OrderedFallback {
  return Object.freeze({
    canonicalConceptId,
    taxonomy: 'us-gaap',
    tag,
    status: 'ACTIVE' as const,
    mappingQuality: 'exact' as const,
    precedence: 10,
    profileIds: Object.freeze(['general_operating_us_gaap']),
    profileOrder,
    metricPriority: 10 + profileOrder,
    requestKey: `us-gaap:${tag}`,
  });
}

function selectionCandidate(overrides: Partial<SecFactCandidate> = {}): SecFactCandidate {
  return {
    factId: 'fact-revenue-2025',
    canonicalConceptId: 'revenue', taxonomy: 'us-gaap', tag: 'Revenues', unit: 'USD',
    start: '2025-01-01', end: '2025-12-31', scope: 'consolidated', source: 'company_facts',
    form: '10-K', filed: '2026-01-30', accessionNumber: 'A', value: '10.000000000000',
    mappingStatus: 'ACTIVE', mappingQuality: 'exact', mappingVersion: '5.0.0',
    profileCompatible: true, scopeCompatible: true, ...overrides,
  };
}

describe('frozen SEC contract fixtures', () => {
  it('authenticates every frozen raw fixture byte-for-byte', async () => {
    expect(rawManifest.status).toBe('ACTIVE_TEST_AUTHORITY');
    for (const entry of rawManifest.entries) {
      const bytes = await readFile(`${rawRoot}/${entry.file}`);
      expect(createHash('sha256').update(bytes).digest('hex'), entry.file).toBe(entry.sha256);
    }
  });

  it('accepts every positive schema oracle and rejects every negative oracle without coercion', () => {
    const validator = createProductSchemaValidator();
    for (const fixture of schemaExamples.validFixtures) {
      expect(validator.validate(SEC_ACQUISITION_SCHEMA, fixture.input), fixture.fixtureId).toMatchObject({ valid: true });
    }
    for (const fixture of schemaExamples.negativeFixtures) {
      expect(validator.validate(SEC_ACQUISITION_SCHEMA, fixture.input), fixture.fixtureId).toMatchObject({ valid: false });
    }
  });

  it('enforces Company Facts first, selective exact fallbacks, zero-call cache and the hard 14-call stop', () => {
    expect(acquisitionPolicy.maxExternalCallsPerOperation).toBe(14);
    expect(acquisitionPolicy.primarySource).toBe('company_facts');
    expect(acquisitionPolicy.fallbackSource).toBe('company_concept');
    expect(acquisitionVectors.fixtures).toHaveLength(4);

    const primary = createAcquisitionPlan({
      cik: '0000320193', maxExternalCalls: 14,
      requestedConceptIds: ['revenue', 'netIncome'], cacheState: 'miss',
      companyFactsResolvedConceptIds: ['revenue', 'netIncome'], eligibleFallbacks: [],
    });
    expect(primary.attempts.map((attempt) => attempt.sourceKind)).toEqual(['submissions', 'company_facts']);

    const selective = createAcquisitionPlan({
      cik: '0000320193', maxExternalCalls: 14,
      requestedConceptIds: ['revenue', 'netIncome', 'cashFlowFromOperations'], cacheState: 'miss',
      companyFactsResolvedConceptIds: ['revenue'],
      eligibleFallbacks: [
        fallback('netIncome', 'NetIncomeLoss', 1),
        fallback('cashFlowFromOperations', 'NetCashProvidedByUsedInOperatingActivities', 2),
      ],
    });
    expect(selective.attempts.map((attempt) => attempt.requestKey)).toEqual([
      'submissions:0000320193',
      'companyfacts:0000320193',
      'company_concept:us-gaap:NetIncomeLoss',
      'company_concept:us-gaap:NetCashProvidedByUsedInOperatingActivities',
    ]);
    expect(selective.status).toBe('complete');

    const twenty = Array.from({ length: 20 }, (_, index) => `concept-${index.toString().padStart(2, '0')}`);
    const hardStop = createAcquisitionPlan({
      cik: '0000320193', maxExternalCalls: 14, requestedConceptIds: twenty, cacheState: 'miss',
      companyFactsResolvedConceptIds: [],
      eligibleFallbacks: twenty.map((concept, index) => fallback(concept, `Concept${index}`, index)),
    });
    expect(hardStop).toMatchObject({ externalCallCount: 14, budgetRemaining: 0, status: 'partial' });
    expect(hardStop.unattemptedFallbacks).toHaveLength(8);

    const cache = createAcquisitionPlan({
      cik: '0000320193', maxExternalCalls: 14, requestedConceptIds: ['revenue'],
      cacheState: 'valid_complete', companyFactsResolvedConceptIds: [], eligibleFallbacks: [],
    });
    expect(cache.attempts).toEqual([]);
  });

  it('enforces every frozen filing-selection oracle category', () => {
    expect(selectionPolicy.evidenceOnlyForms).toEqual(['8-K', '8-K/A']);
    expect(selectionVectors.vectors).toHaveLength(10);

    expect(selectFilingFact([selectionCandidate({ form: '8-K' })])).toMatchObject({ state: 'evidence_only' });
    expect(selectFilingFact([
      selectionCandidate({ accessionNumber: 'A' }),
      selectionCandidate({ accessionNumber: 'B' }),
    ])).toMatchObject({ state: 'selected', fact: { sourceRefs: [{ accessionNumber: 'A' }, { accessionNumber: 'B' }] } });
    expect(selectFilingFact([
      selectionCandidate({ accessionNumber: 'A', value: '10.000000000000' }),
      selectionCandidate({ accessionNumber: 'B', value: '11.000000000000' }),
    ])).toMatchObject({ state: 'ambiguous', reasonCode: 'conflicting_equal_precedence' });
    expect(selectFilingFact([
      selectionCandidate({ unit: 'USD' }),
      selectionCandidate({ unit: 'EUR', accessionNumber: 'B' }),
    ])).toMatchObject({ state: 'incompatible', reasonCode: 'unit_incompatible' });
  });
});
