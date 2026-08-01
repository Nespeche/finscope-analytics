import { describe, expect, it } from 'vitest';
import { canonicalizeDecimalString } from '../../../src/core/decimal';
import metricVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/metrics/metric-test-vectors.json';
import {
  PRICE_METRIC_DEFINITIONS,
  evaluatePriceMetric,
  evaluatePriceMetrics,
} from '../../../src/domain/price/price-metrics';

interface PriceMetricVector {
  readonly fixtureId: string;
  readonly metricId: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly profileId: string;
  readonly qualityClassification: 'verified' | 'usable_with_caveats' | 'insufficient';
  readonly expected: Readonly<{
    state: string;
    valueDecimal?: string;
    valueEnum?: string;
    reasonCode?: string;
  }>;
}

const vectors = (metricVectorsJson.fixtures as readonly PriceMetricVector[]).filter(
  (fixture) => fixture.metricId.startsWith('MKT_'),
);

describe('eight descriptive historical price metrics', () => {
  it('exposes exactly the eight active catalog definitions', () => {
    expect(PRICE_METRIC_DEFINITIONS).toHaveLength(8);
    expect(PRICE_METRIC_DEFINITIONS.map((definition) => definition.metricId)).toEqual([
      'MKT_LAST_OBSERVATION',
      'MKT_MIN',
      'MKT_MAX',
      'MKT_MEAN',
      'MKT_MEDIAN',
      'MKT_SIMPLE_RETURN',
      'MKT_MAX_DRAWDOWN',
      'MKT_TREND_DIRECTION',
    ]);
  });

  it.each(vectors)('$fixtureId matches its 24-vector oracle', (vector: PriceMetricVector) => {
    expect(vectors).toHaveLength(24);
    const actual = evaluatePriceMetric({
      metricId: vector.metricId,
      inputs: vector.inputs,
      profileId: vector.profileId,
      quality: vector.qualityClassification,
    });
    expect(actual.state).toBe(vector.expected.state);
    if (vector.expected.valueDecimal !== undefined) {
      expect(actual.valueDecimal).toBe(vector.expected.valueDecimal);
      expect(actual).not.toHaveProperty('valueEnum');
    } else if (vector.expected.valueEnum !== undefined) {
      expect(actual.valueEnum).toBe(vector.expected.valueEnum);
      expect(actual).not.toHaveProperty('valueDecimal');
    } else {
      expect(actual.reasonCodes).toEqual([vector.expected.reasonCode]);
      expect(actual).not.toHaveProperty('valueDecimal');
      expect(actual).not.toHaveProperty('valueEnum');
    }
  });

  it('batch evaluation remains price-only and returns eight results in catalog order', () => {
    const observations = [
      { date: '2025-01-31', priceDecimal: canonicalizeDecimalString('10') },
      { date: '2025-02-28', priceDecimal: canonicalizeDecimalString('12') },
      { date: '2025-03-31', priceDecimal: canonicalizeDecimalString('11') },
      { date: '2025-04-30', priceDecimal: canonicalizeDecimalString('15') },
    ];
    const results = evaluatePriceMetrics({
      observations,
      profileId: 'local_csv_manual_v1',
      quality: 'usable_with_caveats',
    });
    expect(results).toHaveLength(8);
    expect(results.every((result) => result.state === 'available')).toBe(true);
    expect(results).not.toHaveProperty('fundamentalInputFingerprint');
  });
});
