import { describe, expect, it } from 'vitest';
import qualityCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/quality-model-catalog.json';
import {
  FUNDAMENTAL_QUALITY_AXES,
  HISTORICAL_PRICE_QUALITY_AXES,
  classifyFundamentalQuality,
  classifyHistoricalPriceQuality,
  type FundamentalQualityAxes,
  type HistoricalPriceQualityAxes,
} from '../../../src/domain/analytics/quality-classifier';
import type { QualityClassification } from '../../../src/domain/model';

function increment(
  counts: Record<QualityClassification, number>,
  classification: QualityClassification,
): void {
  counts[classification] += 1;
}

describe('categorical quality classifiers', () => {
  it('maps all 144 fundamental combinations exactly once with catalog counts', () => {
    const counts: Record<QualityClassification, number> = {
      verified: 0,
      usable_with_caveats: 0,
      insufficient: 0,
    };
    const combinations = new Set<string>();

    for (const mappingQuality of FUNDAMENTAL_QUALITY_AXES.mappingQuality) {
      for (const completeness of FUNDAMENTAL_QUALITY_AXES.completeness) {
        for (const comparability of FUNDAMENTAL_QUALITY_AXES.comparability) {
          for (const revisionState of FUNDAMENTAL_QUALITY_AXES.revisionState) {
            const axes: FundamentalQualityAxes = {
              mappingQuality, completeness, comparability, revisionState,
            };
            const key = JSON.stringify(axes);
            expect(combinations.has(key)).toBe(false);
            combinations.add(key);
            const classification = classifyFundamentalQuality(axes);
            expect(typeof classification).toBe('string');
            increment(counts, classification);
          }
        }
      }
    }

    expect(combinations.size).toBe(144);
    expect(combinations.size).toBe(qualityCatalogJson.fundamental.cardinality);
    expect(counts).toEqual(qualityCatalogJson.fundamental.expectedCounts);
  });

  it('applies blocking, verified and caveat predicates without overlap', () => {
    expect(classifyFundamentalQuality({
      mappingQuality: 'ambiguous', completeness: 'complete', comparability: 'comparable', revisionState: 'current',
    })).toBe('insufficient');
    expect(classifyFundamentalQuality({
      mappingQuality: 'exact', completeness: 'complete', comparability: 'comparable', revisionState: 'restated',
    })).toBe('verified');
    expect(classifyFundamentalQuality({
      mappingQuality: 'derived', completeness: 'complete', comparability: 'comparable', revisionState: 'current',
    })).toBe('usable_with_caveats');
  });

  it('keeps the independent 54-combination price model categorical', () => {
    const counts: Record<QualityClassification, number> = {
      verified: 0,
      usable_with_caveats: 0,
      insufficient: 0,
    };
    let combinationCount = 0;
    for (const rowValidity of HISTORICAL_PRICE_QUALITY_AXES.rowValidity) {
      for (const dateIntegrity of HISTORICAL_PRICE_QUALITY_AXES.dateIntegrity) {
        for (const currencyIntegrity of HISTORICAL_PRICE_QUALITY_AXES.currencyIntegrity) {
          for (const adjustmentDisclosure of HISTORICAL_PRICE_QUALITY_AXES.adjustmentDisclosure) {
            const axes: HistoricalPriceQualityAxes = {
              rowValidity, dateIntegrity, currencyIntegrity, adjustmentDisclosure,
            };
            increment(counts, classifyHistoricalPriceQuality(axes));
            combinationCount += 1;
          }
        }
      }
    }
    expect(combinationCount).toBe(54);
    expect(combinationCount).toBe(qualityCatalogJson.historicalPrice.cardinality);
    expect(counts).toEqual(qualityCatalogJson.historicalPrice.expectedCounts);
    expect(Object.keys(FUNDAMENTAL_QUALITY_AXES).sort()).not.toEqual(
      Object.keys(HISTORICAL_PRICE_QUALITY_AXES).sort(),
    );
  });
});
