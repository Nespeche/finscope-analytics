import metricCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import type { DecimalString } from '../../core/decimal';
import type { FundamentalMetricResult } from '../fundamental/types';
import type { MetricState, QualityClassification } from '../model';
import {
  evaluateFormula,
  isFormulaId,
  type FormulaEvaluationContext,
  type FormulaId,
} from './formula-engine';
import {
  classifyFundamentalQuality,
  type FundamentalQualityAxes,
} from './quality-classifier';

export type FundamentalMetricId = `FND_${string}`;

export interface FundamentalMetricDefinition {
  readonly metricId: FundamentalMetricId;
  readonly class: 'fundamental';
  readonly definitionVersion: string;
  readonly metricPriority: number;
  readonly formulaId: FormulaId;
  readonly inputIds: readonly string[];
  readonly requiredInputIds?: readonly string[];
  readonly optionalInputIds?: readonly string[];
  readonly profileAllowlist: readonly string[];
  readonly minimumQuality: 'usable_with_caveats' | 'verified';
  readonly periodPolicy: string;
  readonly roundingPolicy: string;
  readonly unit: string;
  readonly qualityModel: 'fundamental';
  readonly fingerprintDomain: 'fundamental_analysis';
  readonly allowedStates: readonly MetricState[];
  readonly consumers: readonly string[];
}

interface MetricCatalog {
  readonly metrics: readonly (FundamentalMetricDefinition | Readonly<{
    class: string;
    metricId: string;
    formulaId: string;
    metricPriority: number;
  }>)[];
  readonly deferredMetricIds: readonly string[];
}

const metricCatalog = metricCatalogJson as unknown as MetricCatalog;

function isFundamentalDefinition(
  definition: MetricCatalog['metrics'][number],
): definition is FundamentalMetricDefinition {
  return definition.class === 'fundamental'
    && definition.metricId.startsWith('FND_')
    && isFormulaId(definition.formulaId);
}

export const FUNDAMENTAL_METRIC_DEFINITIONS = Object.freeze(
  metricCatalog.metrics
    .filter(isFundamentalDefinition)
    .sort((left, right) => left.metricPriority - right.metricPriority),
);

const DEFINITION_BY_ID = new Map(
  FUNDAMENTAL_METRIC_DEFINITIONS.map((definition) => [definition.metricId, definition] as const),
);

const QUALITY_ORDINAL: Readonly<Record<QualityClassification, number>> = Object.freeze({
  insufficient: 0,
  usable_with_caveats: 1,
  verified: 2,
});

export interface FundamentalMetricEvaluationInput {
  readonly metricId: FundamentalMetricId | string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly profileId: string;
  readonly quality: FundamentalQualityAxes;
  readonly periodCompatible?: boolean;
  readonly periodReasonCode?: string;
  readonly periodKey?: string;
  readonly evidenceRefs?: readonly string[];
  readonly formulaContext?: FormulaEvaluationContext;
}

export interface FundamentalMetricBatchInput {
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly profileId: string;
  readonly qualityByMetric: Readonly<Record<string, FundamentalQualityAxes>>;
  readonly periodCompatibilityByMetric?: Readonly<Record<string, boolean>>;
  readonly periodReasonCodeByMetric?: Readonly<Record<string, string>>;
  readonly formulaContextByMetric?: Readonly<Record<string, FormulaEvaluationContext>>;
}

function definitionFor(metricId: FundamentalMetricId | string): FundamentalMetricDefinition {
  const definition = DEFINITION_BY_ID.get(metricId as FundamentalMetricId);
  if (definition === undefined) throw new RangeError(`UNKNOWN_FUNDAMENTAL_METRIC_ID:${metricId}`);
  return definition;
}

function result(
  definition: FundamentalMetricDefinition,
  state: MetricState,
  qualityClassification: QualityClassification,
  optional: Readonly<{
    valueDecimal?: DecimalString;
    reasonCode?: string;
    periodKey?: string | undefined;
    evidenceRefs?: readonly string[] | undefined;
  }> = {},
): FundamentalMetricResult {
  return Object.freeze({
    metricId: definition.metricId,
    state,
    qualityClassification,
    unit: definition.unit,
    ...(optional.valueDecimal === undefined ? {} : { valueDecimal: optional.valueDecimal }),
    ...(optional.reasonCode === undefined ? {} : { reasonCodes: Object.freeze([optional.reasonCode]) }),
    ...(optional.periodKey === undefined ? {} : { periodKey: optional.periodKey }),
    ...(optional.evidenceRefs === undefined
      ? {}
      : { evidenceRefs: Object.freeze([...optional.evidenceRefs]) }),
  });
}

function inputValues(
  definition: FundamentalMetricDefinition,
  inputs: Readonly<Record<string, unknown>>,
): readonly unknown[] {
  if (definition.formulaId !== 'debt_bucket_sum') {
    return Object.freeze(definition.inputIds.map((inputId) => inputs[inputId]));
  }
  const requiredIds = definition.requiredInputIds ?? definition.inputIds;
  const optionalIds = definition.optionalInputIds ?? [];
  const values = requiredIds.map((inputId) => inputs[inputId]);
  for (const inputId of optionalIds) {
    if (Object.hasOwn(inputs, inputId)) values.push(inputs[inputId]);
  }
  return Object.freeze(values);
}

function meetsMinimumQuality(
  actual: QualityClassification,
  minimum: FundamentalMetricDefinition['minimumQuality'],
): boolean {
  return QUALITY_ORDINAL[actual] >= QUALITY_ORDINAL[minimum];
}

/**
 * Evaluates one active fundamental metric. Formula arithmetic is delegated
 * exclusively to evaluateFormula; this layer only applies catalog gates.
 */
export function evaluateFundamentalMetric(
  input: FundamentalMetricEvaluationInput,
): FundamentalMetricResult {
  const definition = definitionFor(input.metricId);
  const qualityClassification = classifyFundamentalQuality(input.quality);

  if (!definition.profileAllowlist.includes(input.profileId)) {
    return result(definition, 'not_applicable', qualityClassification, {
      reasonCode: 'metric_not_allowlisted',
      periodKey: input.periodKey,
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (input.periodCompatible === false) {
    return result(definition, 'insufficient', qualityClassification, {
      reasonCode: input.periodReasonCode ?? 'incompatible_periods',
      periodKey: input.periodKey,
      evidenceRefs: input.evidenceRefs,
    });
  }

  const formula = evaluateFormula(
    definition.formulaId,
    inputValues(definition, input.inputs),
    input.formulaContext,
  );
  if (formula.state !== 'available') {
    return result(definition, formula.state, qualityClassification, {
      reasonCode: formula.reasonCode,
      periodKey: input.periodKey,
      evidenceRefs: input.evidenceRefs,
    });
  }

  if (!meetsMinimumQuality(qualityClassification, definition.minimumQuality)) {
    return result(definition, 'insufficient', qualityClassification, {
      reasonCode: 'quality_below_minimum',
      periodKey: input.periodKey,
      evidenceRefs: input.evidenceRefs,
    });
  }

  return result(definition, 'available', qualityClassification, {
    valueDecimal: formula.value,
    periodKey: input.periodKey,
    evidenceRefs: input.evidenceRefs,
  });
}

/** Attempts all 24 metrics in catalog priority order and reuses available derived values. */
export function evaluateFundamentalMetrics(
  input: FundamentalMetricBatchInput,
): readonly FundamentalMetricResult[] {
  const workingInputs: Record<string, unknown> = { ...input.inputs };
  const evaluations: FundamentalMetricResult[] = [];
  for (const definition of FUNDAMENTAL_METRIC_DEFINITIONS) {
    const quality = input.qualityByMetric[definition.metricId];
    if (quality === undefined) {
      throw new TypeError(`MISSING_QUALITY_AXES:${definition.metricId}`);
    }
    const evaluation = evaluateFundamentalMetric({
      metricId: definition.metricId,
      inputs: workingInputs,
      profileId: input.profileId,
      quality,
      ...(input.periodCompatibilityByMetric?.[definition.metricId] === undefined
        ? {}
        : { periodCompatible: input.periodCompatibilityByMetric[definition.metricId] }),
      ...(input.periodReasonCodeByMetric?.[definition.metricId] === undefined
        ? {}
        : { periodReasonCode: input.periodReasonCodeByMetric[definition.metricId] }),
      ...(input.formulaContextByMetric?.[definition.metricId] === undefined
        ? {}
        : { formulaContext: input.formulaContextByMetric[definition.metricId] }),
    });
    evaluations.push(evaluation);
    if (evaluation.state === 'available' && evaluation.valueDecimal !== undefined) {
      workingInputs[definition.metricId] = evaluation.valueDecimal;
    }
  }
  return Object.freeze(evaluations);
}

export function isFundamentalMetricId(value: unknown): value is FundamentalMetricId {
  return typeof value === 'string' && DEFINITION_BY_ID.has(value as FundamentalMetricId);
}

export const DEFERRED_METRIC_IDS = Object.freeze([...metricCatalog.deferredMetricIds]);
