import type { DecimalString } from '../../core/decimal';
import { createProductSchemaValidator } from '../../core/schema-validator';
import type { Sha256Digest } from '../../core/sha256';
import {
  cloneAndFreezeDomainRecord,
  type Cik,
  type MetricState,
  type QualityClassification,
} from '../model';

const HISTORICAL_PRICE_OVERLAY_SCHEMA =
  'https://finscope.local/schemas/historical-price-overlay.schema.json';
const PRICE_ANALYSIS_SCHEMA =
  'https://finscope.local/schemas/analysis-results.schema.json#/$defs/PriceAnalysis';

export type FundamentalDomainField =
  | 'fundamentalInputFingerprint'
  | 'fundamentalAnalysisFingerprint'
  | 'metricResults'
  | 'ruleEvaluations'
  | 'synthesis'
  | 'facts'
  | 'conceptResolutions'
  | 'coverage'
  | 'reportingPeriods'
  | 'sourceAcquisition'
  | 'bundleId';

export type WithoutFundamentalDomain = {
  readonly [Key in FundamentalDomainField]?: never;
};

export interface HistoricalPriceObservation {
  readonly date: string;
  readonly priceDecimal: DecimalString;
}

export interface HistoricalPriceOverlay extends WithoutFundamentalDomain {
  readonly overlayId: string;
  readonly overlayVersion: number;
  readonly contractVersion: '5.0.0';
  readonly issuerCik: Cik;
  readonly instrument: Readonly<{
    symbol: string;
    venueMic: string;
    instrumentId?: string;
  }>;
  readonly currency: string;
  readonly frequency: string;
  readonly observations: readonly HistoricalPriceObservation[];
  readonly adjustmentStatus: string;
  readonly origin: Readonly<{
    profileId: string;
    method: string;
    sourceFileSha256?: string;
  }>;
  readonly warnings: readonly string[];
  readonly priceUse: 'historical_descriptive_only';
  readonly historicalPriceOverlayFingerprint: Sha256Digest;
  readonly priceQuality?: Readonly<{
    classification: QualityClassification;
    axes: Readonly<{
      rowValidity: string;
      dateIntegrity: string;
      currencyIntegrity: string;
      adjustmentDisclosure: string;
    }>;
  }>;
  readonly sourceEvidenceFingerprint?: Sha256Digest;
  readonly createdAt?: string;
}

export interface PriceMetricResult {
  readonly metricId: string;
  readonly state: MetricState;
  readonly qualityClassification: QualityClassification;
  readonly periodKey?: string;
  readonly unit?: string;
  readonly valueDecimal?: DecimalString;
  readonly valueEnum?: string;
  readonly reasonCodes?: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface PriceAnalysis extends WithoutFundamentalDomain {
  readonly analysisKind: 'historical_price_descriptive';
  readonly analysisId: string;
  readonly issuerCik: Cik;
  readonly historicalPriceOverlayFingerprint: Sha256Digest;
  readonly priceQuality: Readonly<Record<string, unknown>>;
  readonly priceMetricResults: readonly PriceMetricResult[];
  readonly versions: Readonly<Record<string, string>>;
  readonly priceAnalysisFingerprint: Sha256Digest;
  readonly createdAt?: string;
}

const validator = createProductSchemaValidator();

export function parseHistoricalPriceOverlay(input: unknown): HistoricalPriceOverlay {
  const result = validator.validate<HistoricalPriceOverlay>(HISTORICAL_PRICE_OVERLAY_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_HISTORICAL_PRICE_OVERLAY:${JSON.stringify(result.errors)}`);
  }
  return cloneAndFreezeDomainRecord(result.value);
}

export function parsePriceAnalysis(input: unknown): PriceAnalysis {
  const result = validator.validate<PriceAnalysis>(PRICE_ANALYSIS_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_PRICE_ANALYSIS:${JSON.stringify(result.errors)}`);
  }
  return cloneAndFreezeDomainRecord(result.value);
}

type IsForbidden<T> = [Exclude<T, undefined>] extends [never] ? true : false;
type Assert<T extends true> = T;
type _PriceFundamentalFingerprintForbidden = Assert<
  IsForbidden<HistoricalPriceOverlay['fundamentalInputFingerprint']>
>;
type _PriceRulesForbidden = Assert<IsForbidden<PriceAnalysis['ruleEvaluations']>>;
