import formulaCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/formula-catalog.json';
import {
  FinScopeDecimal,
  isDecimalString,
  parseDecimalString,
  toDecimalString,
  type DecimalString,
} from '../../core/decimal';
import type { MetricState } from '../model';

export const FORMULA_IDS = Object.freeze([
  'identity',
  'add',
  'subtract',
  'divide',
  'ratio_change',
  'divide_average_balance',
  'debt_bucket_sum',
  'last',
  'min',
  'max',
  'mean',
  'median',
  'simple_return',
  'max_drawdown',
  'normalized_ols_ordinal',
] as const);

export type FormulaId = (typeof FORMULA_IDS)[number];

export type FormulaReasonCode =
  | 'invalid_arity'
  | 'required_input_missing'
  | 'invalid_input'
  | 'non_canonical_decimal'
  | 'insufficient_observations'
  | 'zero_denominator'
  | 'non_finite_result'
  | 'invalid_price_observation'
  | 'incomplete_debt_buckets'
  | 'overlapping_debt_buckets';

export interface FormulaDefinition {
  readonly formulaId: FormulaId;
  readonly formulaVersion: string;
  readonly priority: number;
  readonly arity: Readonly<{
    minimum: number;
    maximum: number | null;
  }>;
  readonly inputKind:
    | 'scalar'
    | 'ordered_scalars'
    | 'named_buckets'
    | 'ordered_series'
    | 'price_series';
  readonly expression: string;
}

export interface FormulaEvaluationContext {
  readonly incomplete?: boolean;
  readonly overlap?: boolean;
  readonly minimumObservations?: number;
}

export type FormulaEvaluation =
  | Readonly<{
      state: 'available';
      value: DecimalString;
    }>
  | Readonly<{
      state: Exclude<MetricState, 'available' | 'not_applicable'>;
      reasonCode: FormulaReasonCode;
    }>;

const formulaCatalog = formulaCatalogJson as unknown as {
  readonly formulas: readonly FormulaDefinition[];
};

export const FORMULA_DEFINITIONS = Object.freeze(
  [...formulaCatalog.formulas].sort((left, right) => left.priority - right.priority),
);

const DEFINITION_BY_ID = new Map(
  FORMULA_DEFINITIONS.map((definition) => [definition.formulaId, definition] as const),
);

function unavailable(
  state: Exclude<MetricState, 'available' | 'not_applicable'>,
  reasonCode: FormulaReasonCode,
): FormulaEvaluation {
  return Object.freeze({ state, reasonCode });
}

function available(value: ReturnType<typeof parseDecimalString>): FormulaEvaluation {
  if (!value.isFinite()) return unavailable('insufficient', 'non_finite_result');
  try {
    return Object.freeze({ state: 'available' as const, value: toDecimalString(value) });
  } catch {
    return unavailable('insufficient', 'non_finite_result');
  }
}

export function isFormulaId(value: unknown): value is FormulaId {
  return typeof value === 'string' && DEFINITION_BY_ID.has(value as FormulaId);
}

function definitionFor(formulaId: FormulaId | string): FormulaDefinition {
  const definition = DEFINITION_BY_ID.get(formulaId as FormulaId);
  if (definition === undefined) throw new RangeError(`UNKNOWN_FORMULA_ID:${formulaId}`);
  return definition;
}

function arityIsValid(definition: FormulaDefinition, inputCount: number): boolean {
  return inputCount >= definition.arity.minimum
    && (definition.arity.maximum === null || inputCount <= definition.arity.maximum);
}

function parseInputs(inputs: readonly unknown[]):
  | Readonly<{ state: 'valid'; values: readonly ReturnType<typeof parseDecimalString>[] }>
  | FormulaEvaluation {
  const values: ReturnType<typeof parseDecimalString>[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (input === null || input === undefined) {
      return unavailable('insufficient', 'required_input_missing');
    }
    if (typeof input !== 'string') {
      return unavailable('insufficient', 'invalid_input');
    }
    let parsed: ReturnType<typeof parseDecimalString>;
    try {
      parsed = new FinScopeDecimal(input);
    } catch {
      return unavailable('insufficient', 'invalid_input');
    }
    if (!parsed.isFinite()) return unavailable('insufficient', 'invalid_input');
    if (!isDecimalString(input)) {
      return unavailable('insufficient', 'non_canonical_decimal');
    }
    values.push(parseDecimalString(input));
  }
  return Object.freeze({ state: 'valid' as const, values: Object.freeze(values) });
}

function requirePositivePrices(
  definition: FormulaDefinition,
  values: readonly ReturnType<typeof parseDecimalString>[],
): FormulaEvaluation | undefined {
  if (definition.inputKind !== 'price_series') return undefined;
  if (values.some((value) => value.lessThanOrEqualTo(0))) {
    return unavailable('insufficient', 'invalid_price_observation');
  }
  return undefined;
}

function sum(values: readonly ReturnType<typeof parseDecimalString>[]) {
  return values.reduce((total, value) => total.plus(value), new FinScopeDecimal(0));
}

function evaluateKnownFormula(
  formulaId: FormulaId,
  values: readonly ReturnType<typeof parseDecimalString>[],
): FormulaEvaluation {
  const first = values[0];
  if (first === undefined) return unavailable('insufficient', 'invalid_arity');

  switch (formulaId) {
    case 'identity':
      return available(first);
    case 'add':
    case 'debt_bucket_sum':
      return available(sum(values));
    case 'subtract': {
      const second = values[1];
      return second === undefined
        ? unavailable('insufficient', 'invalid_arity')
        : available(first.minus(second));
    }
    case 'divide': {
      const denominator = values[1];
      if (denominator === undefined) return unavailable('insufficient', 'invalid_arity');
      if (denominator.isZero()) return unavailable('not_meaningful', 'zero_denominator');
      return available(first.dividedBy(denominator));
    }
    case 'ratio_change': {
      const prior = values[1];
      if (prior === undefined) return unavailable('insufficient', 'invalid_arity');
      if (prior.isZero()) return unavailable('not_meaningful', 'zero_denominator');
      return available(first.dividedBy(prior).minus(1));
    }
    case 'divide_average_balance': {
      const opening = values[1];
      const closing = values[2];
      if (opening === undefined || closing === undefined) {
        return unavailable('insufficient', 'invalid_arity');
      }
      const average = opening.plus(closing).dividedBy(2);
      if (average.isZero()) return unavailable('not_meaningful', 'zero_denominator');
      return available(first.dividedBy(average));
    }
    case 'last': {
      const lastValue = values.at(-1);
      return lastValue === undefined
        ? unavailable('insufficient', 'invalid_arity')
        : available(lastValue);
    }
    case 'min': {
      const minimum = values.reduce((current, value) => value.lessThan(current) ? value : current);
      return available(minimum);
    }
    case 'max': {
      const maximum = values.reduce((current, value) => value.greaterThan(current) ? value : current);
      return available(maximum);
    }
    case 'mean':
      return available(sum(values).dividedBy(values.length));
    case 'median': {
      const sorted = [...values].sort((left, right) => left.comparedTo(right));
      const middle = Math.floor(sorted.length / 2);
      const upper = sorted[middle];
      if (upper === undefined) return unavailable('insufficient', 'invalid_arity');
      if (sorted.length % 2 === 1) return available(upper);
      const lower = sorted[middle - 1];
      return lower === undefined
        ? unavailable('insufficient', 'invalid_arity')
        : available(lower.plus(upper).dividedBy(2));
    }
    case 'simple_return': {
      const lastValue = values.at(-1);
      if (lastValue === undefined) return unavailable('insufficient', 'invalid_arity');
      return available(lastValue.dividedBy(first).minus(1));
    }
    case 'max_drawdown': {
      let runningMaximum = first;
      let maximumDrawdown = new FinScopeDecimal(0);
      for (const value of values) {
        if (value.greaterThan(runningMaximum)) runningMaximum = value;
        const drawdown = value.dividedBy(runningMaximum).minus(1);
        if (drawdown.lessThan(maximumDrawdown)) maximumDrawdown = drawdown;
      }
      return available(maximumDrawdown);
    }
    case 'normalized_ols_ordinal': {
      const normalized = values.map((value) => value.dividedBy(first));
      const count = new FinScopeDecimal(normalized.length);
      const meanX = new FinScopeDecimal(normalized.length - 1).dividedBy(2);
      const meanY = sum(normalized).dividedBy(count);
      let numerator = new FinScopeDecimal(0);
      let denominator = new FinScopeDecimal(0);
      for (let index = 0; index < normalized.length; index += 1) {
        const value = normalized[index];
        if (value === undefined) return unavailable('insufficient', 'non_finite_result');
        const centeredX = new FinScopeDecimal(index).minus(meanX);
        numerator = numerator.plus(centeredX.times(value.minus(meanY)));
        denominator = denominator.plus(centeredX.times(centeredX));
      }
      if (denominator.isZero()) return unavailable('not_meaningful', 'zero_denominator');
      return available(numerator.dividedBy(denominator));
    }
  }
}

/**
 * Evaluates one closed catalog formula using canonical DecimalString inputs.
 * Checks follow the catalog precedence: arity, missing input, invalid input,
 * non-canonical input, formula-specific data gates, denominator, result.
 */
export function evaluateFormula(
  formulaId: FormulaId | string,
  inputs: readonly unknown[],
  context: FormulaEvaluationContext = {},
): FormulaEvaluation {
  const definition = definitionFor(formulaId);
  if (!arityIsValid(definition, inputs.length)) {
    return unavailable('insufficient', 'invalid_arity');
  }

  const parsed = parseInputs(inputs);
  if (parsed.state !== 'valid') return parsed;

  if (
    context.minimumObservations !== undefined
    && parsed.values.length < context.minimumObservations
  ) {
    return unavailable('insufficient', 'insufficient_observations');
  }

  const priceFailure = requirePositivePrices(definition, parsed.values);
  if (priceFailure !== undefined) return priceFailure;

  if (formulaId === 'debt_bucket_sum') {
    if (context.incomplete === true) return unavailable('partial', 'incomplete_debt_buckets');
    if (context.overlap === true) return unavailable('partial', 'overlapping_debt_buckets');
  }

  return evaluateKnownFormula(definition.formulaId, parsed.values);
}
