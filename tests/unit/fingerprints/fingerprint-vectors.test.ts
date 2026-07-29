import { describe, expect, it } from 'vitest';
import fingerprintVectorsJson from '../../../specs/001-fundamental-analysis-platform/contracts/fingerprint-test-vectors.json';
import {
  fingerprint,
  sourceEvidenceFingerprint,
} from '../../../src/domain/fingerprints/fingerprint-service';
import type { FingerprintProjectionId } from '../../../src/domain/fingerprints/projections';

interface PositiveVector {
  readonly id: string;
  readonly projectionId: FingerprintProjectionId;
  readonly expectedFingerprint: `sha256:${string}`;
  readonly input: Readonly<Record<string, unknown>>;
}

interface InvarianceVector {
  readonly id: string;
  readonly baseVector: string;
  readonly expectedFingerprint: `sha256:${string}`;
  readonly mutationsOutsideProjection: readonly Readonly<Record<string, unknown>>[];
}

const positiveVectors = fingerprintVectorsJson.positiveVectors as readonly PositiveVector[];
const invarianceVectors = fingerprintVectorsJson.invarianceVectors as readonly InvarianceVector[];

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function positive(id: string): PositiveVector {
  const vector = positiveVectors.find((item) => item.id === id);
  if (vector === undefined) throw new Error(`Missing fingerprint vector: ${id}`);
  return vector;
}

async function digest(vector: PositiveVector, input: unknown = vector.input): Promise<string> {
  return (await fingerprint(vector.projectionId, input)).fingerprint;
}

describe('separate deterministic fingerprint projections', () => {
  it.each(positiveVectors)('$id matches its exact JCS/SHA-256 oracle', async (vector: PositiveVector) => {
    expect(positiveVectors).toHaveLength(4);
    const result = await fingerprint(vector.projectionId, vector.input);
    expect(result.projectionId).toBe(vector.projectionId);
    expect(result.fingerprint).toBe(vector.expectedFingerprint);
    expect(result.canonicalBytes.length).toBeGreaterThan(0);
  });

  it.each(invarianceVectors)('$id excludes every declared out-of-projection mutation', async (vector: InvarianceVector) => {
    expect(invarianceVectors).toHaveLength(3);
    const base = positive(vector.baseVector);
    expect(await digest(base)).toBe(vector.expectedFingerprint);
    for (const mutation of vector.mutationsOutsideProjection) {
      expect(await digest(base, { ...copy(base.input), ...mutation })).toBe(vector.expectedFingerprint);
    }
  });

  it('normalizes every set-like or keyed array while preserving the overlay series contract', async () => {
    const inputVector = positive('FP-FUND-INPUT-001');
    const expandedInput = copy(inputVector.input) as Record<string, unknown>;
    (expandedInput.filings as Record<string, unknown>[]).push({
      accessionNumber: '0000320193-24-000001', filedDate: '2024-10-31', form: '10-K',
    });
    (expandedInput.reportingPeriods as Record<string, unknown>[]).push({
      periodId: 'FY2024', kind: 'duration', endDate: '2024-09-28', scopeId: 'consolidated',
    });
    (expandedInput.facts as Record<string, unknown>[]).push({
      canonicalConceptId: 'assets', factId: 'fact-assets-fy2025', mappingId: 'map-assets',
      mappingVersion: '5.0.0', periodId: 'FY2025', scopeId: 'consolidated', valueDecimal: '2000',
    });
    (expandedInput.conceptResolutions as Record<string, unknown>[]).push({
      canonicalConceptId: 'assets', factId: 'fact-assets-fy2025', periodId: 'FY2025',
      scopeId: 'consolidated', state: 'resolved',
    });
    (expandedInput.mappings as Record<string, unknown>[]).push({
      mappingId: 'map-assets', mappingVersion: '5.0.0',
    });
    (expandedInput.coverage as Record<string, unknown>[]).push({
      canonicalConceptId: 'assets', profileId: 'general_operating_us_gaap',
      resolvedMappingIds: ['map-assets-secondary', 'map-assets'], state: 'complete',
    });
    expandedInput.currencies = ['USD', 'EUR'];
    expandedInput.units = ['USD', 'shares'];
    expandedInput.scopes = ['consolidated', 'parent'];
    const expandedDigest = await digest(inputVector, expandedInput);
    const reorderedInput = copy(expandedInput) as Record<string, unknown>;
    for (const field of ['filings', 'reportingPeriods', 'facts', 'conceptResolutions', 'mappings', 'coverage', 'currencies', 'units', 'scopes']) {
      const values = reorderedInput[field];
      if (Array.isArray(values)) reorderedInput[field] = [...values].reverse();
    }
    for (const item of reorderedInput.coverage as Record<string, unknown>[]) {
      item.resolvedMappingIds = [...(item.resolvedMappingIds as unknown[])].reverse();
    }
    expect(await digest(inputVector, reorderedInput)).toBe(expandedDigest);

    const analysisVector = positive('FP-FUND-ANALYSIS-001');
    const expandedAnalysis = copy(analysisVector.input) as Record<string, unknown>;
    (expandedAnalysis.metricResults as Record<string, unknown>[]).push({
      metricId: 'FND_ASSETS', qualityClassification: 'verified', state: 'available',
      unit: 'USD', valueDecimal: '2000', reasonCodes: ['z_reason', 'a_reason'],
    });
    (expandedAnalysis.ruleEvaluations as Record<string, unknown>[]).push({
      ruleId: 'INS_DILUTION', state: 'triggered', reasonCodes: ['z_reason', 'a_reason'],
    });
    const expandedSynthesis = expandedAnalysis.synthesis as Record<string, unknown>;
    expandedSynthesis.triggeredRuleIds = ['INS_LIQUIDITY_IMPROVEMENT', 'INS_DILUTION'];
    expandedSynthesis.limitations = ['z limitation', 'a limitation'];
    const analysisDigest = await digest(analysisVector, expandedAnalysis);
    const reorderedAnalysis = copy(expandedAnalysis) as Record<string, unknown>;
    reorderedAnalysis.metricResults = [...(reorderedAnalysis.metricResults as unknown[])].reverse();
    reorderedAnalysis.ruleEvaluations = [...(reorderedAnalysis.ruleEvaluations as unknown[])].reverse();
    for (const field of ['metricResults', 'ruleEvaluations']) {
      for (const item of reorderedAnalysis[field] as Record<string, unknown>[]) {
        if (Array.isArray(item.reasonCodes)) item.reasonCodes = [...item.reasonCodes].reverse();
      }
    }
    const reorderedSynthesis = reorderedAnalysis.synthesis as Record<string, unknown>;
    reorderedSynthesis.triggeredRuleIds = [...(reorderedSynthesis.triggeredRuleIds as unknown[])].reverse();
    reorderedSynthesis.limitations = [...(reorderedSynthesis.limitations as unknown[])].reverse();
    expect(await digest(analysisVector, reorderedAnalysis)).toBe(analysisDigest);

    const overlayVector = positive('FP-OVERLAY-001');
    const overlay = copy(overlayVector.input) as Record<string, unknown>;
    overlay.warnings = ['z_warning', 'a_warning'];
    const overlayDigest = await digest(overlayVector, overlay);
    overlay.warnings = [...(overlay.warnings as unknown[])].reverse();
    expect(await digest(overlayVector, overlay)).toBe(overlayDigest);
  });

  it('keeps source evidence in an independent projection with deterministic order', async () => {
    const references = [
      {
        sourceKind: 'filing',
        accessionNumber: '0000320193-25-000079',
        payloadSha256: 'a'.repeat(64),
        retrievedVersion: 'v1',
      },
      {
        sourceKind: 'company_facts',
        canonicalUrl: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
        payloadSha256: 'b'.repeat(64),
        retrievedVersion: 'v2',
      },
    ] as const;
    const expected = 'sha256:370f40f3f776fbfb4e104a8233f4dfe2730b9308fe16d1d2e71faf47d565b1f5';
    expect(await sourceEvidenceFingerprint(references)).toBe(expected);
    expect(await sourceEvidenceFingerprint([...references].reverse())).toBe(expected);
  });

  it('rejects nested self-reference and price fingerprints inside fundamental members', async () => {
    const vector = positive('FP-FUND-ANALYSIS-001');
    const selfReference = copy(vector.input) as Record<string, unknown>;
    (selfReference.metricResults as Record<string, unknown>[])[0]!.fundamentalAnalysisFingerprint = `sha256:${'1'.repeat(64)}`;
    await expect(fingerprint(vector.projectionId, selfReference)).rejects.toMatchObject({
      code: 'FORBIDDEN_PROJECTION_FIELD',
    });

    const priceLeak = copy(vector.input) as Record<string, unknown>;
    (priceLeak.metricResults as Record<string, unknown>[])[0]!.historicalPriceOverlayFingerprint = `sha256:${'2'.repeat(64)}`;
    await expect(fingerprint(vector.projectionId, priceLeak)).rejects.toMatchObject({
      code: 'FORBIDDEN_PROJECTION_FIELD',
    });
  });

  it('rejects non-canonical decimals, local clocks, nulls and invalid numeric JSON', async () => {
    const vector = positive('FP-FUND-INPUT-001');
    for (const invalidDecimal of ['-0', '1.2300', 'NaN', 'Infinity']) {
      const input = copy(vector.input) as Record<string, unknown>;
      (input.facts as Record<string, unknown>[])[0]!.valueDecimal = invalidDecimal;
      await expect(fingerprint(vector.projectionId, input)).rejects.toMatchObject({
        code: 'INVALID_DECIMAL_STRING',
      });
    }

    const localClock = copy(vector.input) as Record<string, unknown>;
    (localClock.versions as Record<string, unknown>).asOfLocalDate = '2026-07-27';
    await expect(fingerprint(vector.projectionId, localClock)).rejects.toMatchObject({
      code: 'FORBIDDEN_PROJECTION_FIELD',
    });

    const nullOptional = copy(positive('FP-OVERLAY-001').input) as Record<string, unknown>;
    (nullOptional.origin as Record<string, unknown>).sourceFileSha256 = null;
    await expect(fingerprint('historicalPriceOverlayFingerprint', nullOptional)).rejects.toMatchObject({
      code: 'NULL_NOT_ALLOWED',
    });

    const nonFinite = copy(positive('FP-PRICE-ANALYSIS-001').input) as Record<string, unknown>;
    (nonFinite.priceQuality as Record<string, unknown>).invalidNumber = Number.NaN;
    await expect(fingerprint('priceAnalysisFingerprint', nonFinite)).rejects.toMatchObject({
      code: 'INVALID_PROJECTION_INPUT',
    });
  });

  it('rejects unsorted overlay observations and malformed source hashes', async () => {
    const overlay = positive('FP-OVERLAY-001');
    const unsorted = copy(overlay.input) as Record<string, unknown>;
    unsorted.observations = [...(unsorted.observations as unknown[])].reverse();
    await expect(fingerprint(overlay.projectionId, unsorted)).rejects.toMatchObject({
      code: 'UNSORTED_OBSERVATIONS',
    });

    const invalidHash = copy(overlay.input) as Record<string, unknown>;
    (invalidHash.origin as Record<string, unknown>).sourceFileSha256 = 'ABC';
    await expect(fingerprint(overlay.projectionId, invalidHash)).rejects.toMatchObject({
      code: 'INVALID_SHA256',
    });
  });

  it('rejects ambiguous source-evidence identifiers', async () => {
    await expect(fingerprint('sourceEvidenceFingerprint', [{
      sourceKind: 'filing',
      sourceId: 'id-1',
      accessionNumber: '0000320193-25-000079',
      payloadSha256: 'a'.repeat(64),
      retrievedVersion: 'v1',
    }])).rejects.toMatchObject({ code: 'AMBIGUOUS_EVIDENCE_ID' });
  });
});
