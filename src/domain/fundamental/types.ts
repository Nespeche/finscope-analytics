import type { DecimalString } from '../../core/decimal';
import { createProductSchemaValidator } from '../../core/schema-validator';
import type { Sha256Digest } from '../../core/sha256';
import {
  cloneAndFreezeDomainRecord,
  type Cik,
  type CoverageState,
  type FactResolutionState,
  type IssuerIdentity,
  type MetricState,
  type QualityClassification,
  type RuleState,
  type SynthesisState,
} from '../model';

const FUNDAMENTAL_BUNDLE_SCHEMA =
  'https://finscope.local/schemas/fundamental-bundle.schema.json';
const ANALYSIS_RESULTS_SCHEMA =
  'https://finscope.local/schemas/analysis-results.schema.json#/$defs/FundamentalAnalysis';

export type PriceDomainField =
  | 'historicalPriceOverlay'
  | 'historicalPriceOverlayFingerprint'
  | 'priceAnalysisFingerprint'
  | 'priceMetricResults'
  | 'priceQuality'
  | 'priceUse'
  | 'observations'
  | 'instrument'
  | 'overlayId'
  | 'overlayVersion';

export type WithoutPriceDomain = {
  readonly [Key in PriceDomainField]?: never;
};

export interface FundamentalFact {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly periodId: string;
  readonly scopeId: string;
  readonly valueDecimal: DecimalString;
  readonly mappingId: string;
  readonly mappingVersion: string;
  readonly sourceRef: string;
  readonly unit?: string;
}

export interface FundamentalConceptResolution {
  readonly canonicalConceptId: string;
  readonly periodId: string;
  readonly scopeId: string;
  readonly state: FactResolutionState;
  readonly factId?: string;
  readonly reasonCode?: string;
}

export interface FundamentalCoverage {
  readonly canonicalConceptId: string;
  readonly profileId: string;
  readonly state: CoverageState;
  readonly resolvedMappingIds: readonly string[];
  readonly reasonCode?: string;
}

export interface ReportingPeriod {
  readonly periodId: string;
  readonly kind: 'instant' | 'duration';
  readonly endDate: string;
  readonly scopeId: string;
  readonly startDate?: string;
  readonly fiscalYear?: number;
  readonly fiscalPeriod?: string;
  readonly classification?: string;
  readonly currency?: string;
  readonly durationDays?: number;
  readonly restatementLineageId?: string;
}

export interface FundamentalBundle extends WithoutPriceDomain {
  readonly bundleId: string;
  readonly contractVersion: '5.0.0';
  readonly issuer: IssuerIdentity;
  readonly sourceAcquisition: Readonly<{
    operationId: string;
    primarySource: string;
    companyFactsUsed: boolean;
    companyConceptFallbacks: readonly string[];
    secCallCount: number;
    callBudget: number;
  }>;
  readonly reportingPeriods: readonly ReportingPeriod[];
  readonly facts: readonly FundamentalFact[];
  readonly conceptResolutions: readonly FundamentalConceptResolution[];
  readonly coverage: readonly FundamentalCoverage[];
  readonly versions: Readonly<{
    contract: string;
    mappingCatalog: string;
    profileCatalog: string;
    normalizer: string;
  }>;
  readonly fundamentalInputFingerprint: Sha256Digest;
  readonly filings?: readonly Readonly<{
    accessionNumber: string;
    filedDate: string;
    form: string;
  }>[];
  readonly createdAt?: string;
  readonly sourceEvidenceFingerprint?: Sha256Digest;
}

export interface FundamentalMetricResult {
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

export interface FundamentalRuleEvaluation {
  readonly ruleId: string;
  readonly state: RuleState;
  readonly reasonCodes?: readonly string[];
  readonly evidenceRefs?: readonly string[];
}

export interface FundamentalAnalysis extends WithoutPriceDomain {
  readonly analysisKind: 'fundamental';
  readonly analysisId: string;
  readonly issuerCik: Cik;
  readonly fundamentalInputFingerprint: Sha256Digest;
  readonly metricResults: readonly FundamentalMetricResult[];
  readonly ruleEvaluations: readonly FundamentalRuleEvaluation[];
  readonly synthesis: Readonly<{
    state: SynthesisState;
    triggeredRuleIds: readonly string[];
    limitations?: readonly string[];
  }>;
  readonly versions: Readonly<Record<string, string>>;
  readonly fundamentalAnalysisFingerprint: Sha256Digest;
  readonly createdAt?: string;
}

const validator = createProductSchemaValidator();

export function parseFundamentalBundle(input: unknown): FundamentalBundle {
  const result = validator.validate<FundamentalBundle>(FUNDAMENTAL_BUNDLE_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_FUNDAMENTAL_BUNDLE:${JSON.stringify(result.errors)}`);
  }
  return cloneAndFreezeDomainRecord(result.value);
}

export function parseFundamentalAnalysis(input: unknown): FundamentalAnalysis {
  const result = validator.validate<FundamentalAnalysis>(ANALYSIS_RESULTS_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_FUNDAMENTAL_ANALYSIS:${JSON.stringify(result.errors)}`);
  }
  return cloneAndFreezeDomainRecord(result.value);
}

type IsForbidden<T> = [Exclude<T, undefined>] extends [never] ? true : false;
type Assert<T extends true> = T;
type _FundamentalOverlayForbidden = Assert<IsForbidden<FundamentalBundle['historicalPriceOverlay']>>;
type _FundamentalPriceFingerprintForbidden = Assert<
  IsForbidden<FundamentalAnalysis['priceAnalysisFingerprint']>
>;
