import qualityCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/quality-model-catalog.json';
import type { QualityClassification } from '../model';

export type FundamentalComparability = 'comparable' | 'limited' | 'incompatible';
export type FundamentalCompleteness = 'complete' | 'partial' | 'missing';
export type FundamentalMappingQuality = 'exact' | 'approved_alias' | 'derived' | 'ambiguous';
export type FundamentalRevisionState = 'current' | 'amended' | 'restated' | 'conflicted';

export interface FundamentalQualityAxes {
  readonly comparability: FundamentalComparability;
  readonly completeness: FundamentalCompleteness;
  readonly mappingQuality: FundamentalMappingQuality;
  readonly revisionState: FundamentalRevisionState;
}

export type PriceAdjustmentDisclosure = 'declared' | 'unknown';
export type PriceCurrencyIntegrity = 'single_declared' | 'unknown_declared' | 'mixed_or_missing';
export type PriceDateIntegrity = 'unique_sorted' | 'duplicates_resolved' | 'invalid';
export type PriceRowValidity = 'all_valid' | 'rows_discarded' | 'invalid';

export interface HistoricalPriceQualityAxes {
  readonly adjustmentDisclosure: PriceAdjustmentDisclosure;
  readonly currencyIntegrity: PriceCurrencyIntegrity;
  readonly dateIntegrity: PriceDateIntegrity;
  readonly rowValidity: PriceRowValidity;
}

interface QualityCatalog {
  readonly fundamental: {
    readonly axes: {
      readonly comparability: readonly FundamentalComparability[];
      readonly completeness: readonly FundamentalCompleteness[];
      readonly mappingQuality: readonly FundamentalMappingQuality[];
      readonly revisionState: readonly FundamentalRevisionState[];
    };
    readonly cardinality: number;
    readonly expectedCounts: Readonly<Record<QualityClassification, number>>;
  };
  readonly historicalPrice: {
    readonly axes: {
      readonly adjustmentDisclosure: readonly PriceAdjustmentDisclosure[];
      readonly currencyIntegrity: readonly PriceCurrencyIntegrity[];
      readonly dateIntegrity: readonly PriceDateIntegrity[];
      readonly rowValidity: readonly PriceRowValidity[];
    };
    readonly cardinality: number;
    readonly expectedCounts: Readonly<Record<QualityClassification, number>>;
  };
}

export const QUALITY_MODEL_CATALOG = qualityCatalogJson as unknown as QualityCatalog;
export const FUNDAMENTAL_QUALITY_AXES = Object.freeze(QUALITY_MODEL_CATALOG.fundamental.axes);
export const HISTORICAL_PRICE_QUALITY_AXES = Object.freeze(QUALITY_MODEL_CATALOG.historicalPrice.axes);

/** Categorical fundamental quality classifier. It deliberately emits no numeric score. */
export function classifyFundamentalQuality(input: FundamentalQualityAxes): QualityClassification {
  if (
    input.mappingQuality === 'ambiguous'
    || input.completeness === 'missing'
    || input.comparability === 'incompatible'
    || input.revisionState === 'conflicted'
  ) {
    return 'insufficient';
  }
  if (
    input.completeness === 'complete'
    && (input.mappingQuality === 'exact' || input.mappingQuality === 'approved_alias')
    && input.comparability === 'comparable'
    && (
      input.revisionState === 'current'
      || input.revisionState === 'amended'
      || input.revisionState === 'restated'
    )
  ) {
    return 'verified';
  }
  return 'usable_with_caveats';
}

/** Categorical price quality classifier with axes independent from fundamental quality. */
export function classifyHistoricalPriceQuality(
  input: HistoricalPriceQualityAxes,
): QualityClassification {
  if (
    input.rowValidity === 'invalid'
    || input.dateIntegrity === 'invalid'
    || input.currencyIntegrity === 'mixed_or_missing'
  ) {
    return 'insufficient';
  }
  if (
    input.rowValidity === 'all_valid'
    && input.dateIntegrity === 'unique_sorted'
    && input.currencyIntegrity === 'single_declared'
    && input.adjustmentDisclosure === 'declared'
  ) {
    return 'verified';
  }
  return 'usable_with_caveats';
}
