import { describe, expect, it } from 'vitest';
import {
  sanitizeFundamentalFact,
  sanitizeFundamentalFacts,
  type RawFundamentalFact,
} from '../../../src/domain/fundamental/fact-sanitizer';

function raw(overrides: Partial<RawFundamentalFact> = {}): RawFundamentalFact {
  return {
    factId: 'fact-1',
    canonicalConceptId: 'revenue',
    periodId: 'FY2025',
    scopeId: 'consolidated',
    value: '1.2300',
    mappingId: 'map-usgaap-revenue-primary',
    mappingVersion: '5.0.0',
    sourceRef: 'sec-companyfacts-0000320193',
    unit: 'USD',
    scale: -6,
    sign: '-',
    dimensions: { LegalEntityAxis: 'ConsolidatedGroupMember' },
    provenance: { accessionNumber: '0000320193-25-000001', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax' },
    ...overrides,
  };
}

describe('fundamental fact sanitizer', () => {
  it('canonicalizes decimal strings and preserves provenance, unit, scale, sign, dimensions and sourceRef', () => {
    const first = sanitizeFundamentalFact(raw());
    expect(first).toMatchObject({
      state: 'sanitized',
      fingerprintEligible: true,
      fact: {
        valueDecimal: '1.23',
        rawValue: '1.2300',
        unit: 'USD',
        scale: -6,
        sign: '-',
        dimensions: { LegalEntityAxis: 'ConsolidatedGroupMember' },
        sourceRef: 'sec-companyfacts-0000320193',
      },
    });

    const negativeZero = sanitizeFundamentalFact(raw({ factId: 'fact-zero', value: '-0' }));
    expect(negativeZero).toMatchObject({ state: 'sanitized', fact: { valueDecimal: '0', rawValue: '-0' } });
  });

  it.each(['NaN', '+Infinity', '-Infinity', '1e3', '01', ''])('excludes invalid token %s before fingerprinting', (value: string) => {
    const result = sanitizeFundamentalFact(raw({ value }));
    expect(result).toMatchObject({
      state: 'excluded',
      fingerprintEligible: false,
      issue: { code: 'invalid_fact_value', pipelineState: 'partial' },
    });
    expect('fact' in result).toBe(false);
  });

  it('returns the authority-ordered deterministic batch with invalid values excluded', () => {
    const result = sanitizeFundamentalFacts([
      raw({ factId: 'z', canonicalConceptId: 'netIncome', value: '5.00' }),
      raw({ factId: 'bad', value: Number.NaN }),
      raw({ factId: 'a', value: '2.500' }),
    ]);
    expect(result.facts.map((fact) => [fact.factId, fact.valueDecimal])).toEqual([
      ['z', '5'],
      ['a', '2.5'],
    ]);
    expect(result.issues.map((issue) => issue.factId)).toEqual(['bad']);
  });
});
