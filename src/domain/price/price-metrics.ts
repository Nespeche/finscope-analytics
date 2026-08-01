import metricCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import { FinScopeDecimal, type DecimalString } from '../../core/decimal';
import {
  evaluateFormula,
  isFormulaId,
  type FormulaId,
} from '../analytics/formula-engine';
import {
  classifyHistoricalPriceQuality,
  type HistoricalPriceQualityAxes,
} from '../analytics/quality-classifier';
import { priceAnalysisFingerprint } from '../fingerprints/fingerprint-service';
import { freezeDomainRecord, type MetricState, type QualityClassification } from '../model';
import {
  parsePriceAnalysis,
  type HistoricalPriceOverlay,
  type PriceAnalysis,
  type PriceMetricResult,
} from './types';

export type PriceMetricId = `MKT_${string}`;

export interface PriceMetricDefinition {
  readonly metricId: PriceMetricId;
  readonly class: 'market_descriptive';
  readonly definitionVersion: string;
  readonly metricPriority: number;
  readonly formulaId: FormulaId;
  readonly inputIds: readonly ['observations'];
  readonly profileAllowlist: readonly string[];
  readonly minimumQuality: 'usable_with_caveats' | 'verified';
  readonly periodPolicy: string;
  readonly unit: string;
  readonly qualityModel: 'historical_price';
  readonly fingerprintDomain: 'price_analysis';
  readonly allowedStates: readonly MetricState[];
}

interface MetricCatalog {
  readonly metrics: readonly (PriceMetricDefinition | Readonly<{
    class: string;
    metricId: string;
    formulaId: string;
    metricPriority: number;
  }>)[];
}

const catalog = metricCatalogJson as unknown as MetricCatalog;

function isPriceDefinition(
  definition: MetricCatalog['metrics'][number],
): definition is PriceMetricDefinition {
  return definition.class === 'market_descriptive'
    && definition.metricId.startsWith('MKT_')
    && isFormulaId(definition.formulaId);
}

export const PRICE_METRIC_DEFINITIONS = Object.freeze(
  catalog.metrics
    .filter(isPriceDefinition)
    .sort((left, right) => left.metricPriority - right.metricPriority),
);

const DEFINITION_BY_ID = new Map(
  PRICE_METRIC_DEFINITIONS.map((definition) => [definition.metricId, definition] as const),
);

const QUALITY_ORDINAL: Readonly<Record<QualityClassification, number>> = Object.freeze({
  insufficient: 0,
  usable_with_caveats: 1,
  verified: 2,
});

const MINIMUM_OBSERVATIONS: Readonly<Record<string, number>> = Object.freeze({
  MKT_LAST_OBSERVATION: 1,
  MKT_MIN: 1,
  MKT_MAX: 1,
  MKT_MEAN: 1,
  MKT_MEDIAN: 1,
  MKT_SIMPLE_RETURN: 2,
  MKT_MAX_DRAWDOWN: 2,
  MKT_TREND_DIRECTION: 3,
});

export interface PriceMetricEvaluationInput {
  readonly metricId: PriceMetricId | string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly profileId: string;
  readonly quality: HistoricalPriceQualityAxes | QualityClassification;
  readonly periodKey?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface PriceMetricBatchInput {
  readonly observations?: readonly Readonly<{ date: string; priceDecimal: DecimalString }>[];
  readonly profileId: string;
  readonly quality: HistoricalPriceQualityAxes | QualityClassification;
  readonly periodKey?: string;
  readonly evidenceRefs?: readonly string[];
}

function definitionFor(metricId: PriceMetricId | string): PriceMetricDefinition {
  const definition = DEFINITION_BY_ID.get(metricId as PriceMetricId);
  if (definition === undefined) throw new RangeError(`UNKNOWN_PRICE_METRIC_ID:${metricId}`);
  return definition;
}

function qualityClassification(
  quality: HistoricalPriceQualityAxes | QualityClassification,
): QualityClassification {
  return typeof quality === 'string' ? quality : classifyHistoricalPriceQuality(quality);
}

function result(
  definition: PriceMetricDefinition,
  state: MetricState,
  quality: QualityClassification,
  optional: Readonly<{
    valueDecimal?: DecimalString;
    valueEnum?: string;
    reasonCode?: string;
    periodKey?: string;
    evidenceRefs?: readonly string[];
  }> = {},
): PriceMetricResult {
  return freezeDomainRecord({
    metricId: definition.metricId,
    state,
    qualityClassification: quality,
    unit: definition.unit,
    ...(optional.valueDecimal === undefined ? {} : { valueDecimal: optional.valueDecimal }),
    ...(optional.valueEnum === undefined ? {} : { valueEnum: optional.valueEnum }),
    ...(optional.reasonCode === undefined ? {} : { reasonCodes: [optional.reasonCode] }),
    ...(optional.periodKey === undefined ? {} : { periodKey: optional.periodKey }),
    ...(optional.evidenceRefs === undefined ? {} : { evidenceRefs: [...optional.evidenceRefs] }),
  });
}

function observationValues(input: unknown, minimum: number): readonly unknown[] {
  if (input === undefined || input === null) return Object.freeze(Array.from({ length: minimum }, () => undefined));
  if (!Array.isArray(input)) return Object.freeze(Array.from({ length: minimum }, () => input));
  if (input.length === 0) return Object.freeze(Array.from({ length: minimum }, () => undefined));
  return Object.freeze(input.map((observation) => (
    typeof observation === 'object' && observation !== null
      ? (observation as Readonly<Record<string, unknown>>).priceDecimal
      : observation
  )));
}

function trendDirection(value: DecimalString): 'up' | 'flat' | 'down' {
  const slope = new FinScopeDecimal(value);
  const threshold = new FinScopeDecimal('0.001');
  if (slope.greaterThan(threshold)) return 'up';
  if (slope.lessThan(threshold.negated())) return 'down';
  return 'flat';
}

/** Evaluates one price metric and delegates all arithmetic to the shared formula engine. */
export function evaluatePriceMetric(input: PriceMetricEvaluationInput): PriceMetricResult {
  const definition = definitionFor(input.metricId);
  const quality = qualityClassification(input.quality);
  if (!definition.profileAllowlist.includes(input.profileId)) {
    return result(definition, 'insufficient', quality, {
      reasonCode: 'source_profile_not_active',
      ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
      ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
    });
  }

  const minimumObservations = MINIMUM_OBSERVATIONS[definition.metricId];
  if (minimumObservations === undefined) throw new TypeError(`MISSING_PRICE_PERIOD_POLICY:${definition.metricId}`);
  const values = observationValues(input.inputs.observations, minimumObservations);
  const formula = evaluateFormula(definition.formulaId, values, { minimumObservations });
  if (formula.state !== 'available') {
    return result(definition, formula.state, quality, {
      reasonCode: formula.reasonCode,
      ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
      ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
    });
  }

  if (QUALITY_ORDINAL[quality] < QUALITY_ORDINAL[definition.minimumQuality]) {
    return result(definition, 'insufficient', quality, {
      reasonCode: 'quality_below_minimum',
      ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
      ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
    });
  }

  if (definition.metricId === 'MKT_TREND_DIRECTION') {
    return result(definition, 'available', quality, {
      valueEnum: trendDirection(formula.value),
      ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
      ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
    });
  }
  return result(definition, 'available', quality, {
    valueDecimal: formula.value,
    ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
    ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
  });
}

export function evaluatePriceMetrics(input: PriceMetricBatchInput): readonly PriceMetricResult[] {
  return freezeDomainRecord(PRICE_METRIC_DEFINITIONS.map((definition) => evaluatePriceMetric({
    metricId: definition.metricId,
    inputs: input.observations === undefined ? {} : { observations: input.observations },
    profileId: input.profileId,
    quality: input.quality,
    ...(input.periodKey === undefined ? {} : { periodKey: input.periodKey }),
    ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
  })));
}

export interface PriceAnalysisBuilderInput {
  readonly analysisId: string;
  readonly overlay: HistoricalPriceOverlay;
  readonly versions: Readonly<Record<string, string>>;
  readonly createdAt?: string;
  readonly evidenceRefs?: readonly string[];
}

export async function buildPriceAnalysis(input: PriceAnalysisBuilderInput): Promise<PriceAnalysis> {
  if (input.analysisId.trim().length === 0) throw new TypeError('PRICE_ANALYSIS_ID_REQUIRED');
  if (input.overlay.priceQuality === undefined) throw new TypeError('PRICE_QUALITY_REQUIRED');
  const priceMetricResults = evaluatePriceMetrics({
    observations: input.overlay.observations,
    profileId: input.overlay.origin.profileId,
    quality: input.overlay.priceQuality.axes as HistoricalPriceQualityAxes,
    periodKey: `overlay-v${input.overlay.overlayVersion}`,
    ...(input.evidenceRefs === undefined ? {} : { evidenceRefs: input.evidenceRefs }),
  });
  const fingerprintInput = {
    historicalPriceOverlayFingerprint: input.overlay.historicalPriceOverlayFingerprint,
    priceQuality: input.overlay.priceQuality,
    priceMetricResults,
    versions: input.versions,
  };
  const fingerprint = await priceAnalysisFingerprint(fingerprintInput);
  return parsePriceAnalysis({
    analysisKind: 'historical_price_descriptive',
    analysisId: input.analysisId,
    issuerCik: input.overlay.issuerCik,
    historicalPriceOverlayFingerprint: input.overlay.historicalPriceOverlayFingerprint,
    priceQuality: input.overlay.priceQuality,
    priceMetricResults,
    versions: input.versions,
    priceAnalysisFingerprint: fingerprint,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  });
}

export function isPriceMetricId(value: unknown): value is PriceMetricId {
  return typeof value === 'string' && DEFINITION_BY_ID.has(value as PriceMetricId);
}
