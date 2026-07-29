import Decimal from 'decimal.js';

const decimalStringBrand: unique symbol = Symbol('DecimalString');

export type DecimalString = string & {
  readonly [decimalStringBrand]: true;
};

export const DECIMAL_STRING_PATTERN = /^(?:0|-?(?:[1-9][0-9]*(?:\.[0-9]*[1-9])?|0\.[0-9]*[1-9]))$/u;
const NORMALIZABLE_DECIMAL_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;

export const FIN_SCOPE_DECIMAL_PRECISION = 20;
export const DEFAULT_DECIMAL_SCALE = 12;

export const FinScopeDecimal = Decimal.clone({
  precision: FIN_SCOPE_DECIMAL_PRECISION,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export class DecimalStringError extends TypeError {
  constructor(
    readonly code: 'INVALID_DECIMAL_TYPE' | 'INVALID_DECIMAL_TOKEN' | 'NON_CANONICAL_DECIMAL',
    message: string,
  ) {
    super(message);
    this.name = 'DecimalStringError';
  }
}

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === 'string' && DECIMAL_STRING_PATTERN.test(value);
}

export function assertDecimalString(value: unknown): asserts value is DecimalString {
  if (typeof value !== 'string') {
    throw new DecimalStringError('INVALID_DECIMAL_TYPE', 'DecimalString input must be a string.');
  }
  if (!DECIMAL_STRING_PATTERN.test(value)) {
    throw new DecimalStringError(
      'NON_CANONICAL_DECIMAL',
      `Decimal string is not canonical: ${JSON.stringify(value)}`,
    );
  }
}

export function parseDecimalString(value: unknown): Decimal {
  assertDecimalString(value);
  const parsed = new FinScopeDecimal(value);
  if (!parsed.isFinite()) {
    throw new DecimalStringError('INVALID_DECIMAL_TOKEN', 'DecimalString must be finite.');
  }
  return parsed;
}

export function canonicalizeDecimalString(value: string): DecimalString {
  if (!NORMALIZABLE_DECIMAL_PATTERN.test(value)) {
    throw new DecimalStringError(
      'INVALID_DECIMAL_TOKEN',
      `Decimal token is not a finite plain base-10 value: ${JSON.stringify(value)}`,
    );
  }
  const normalized = new FinScopeDecimal(value).toString();
  if (!DECIMAL_STRING_PATTERN.test(normalized)) {
    throw new DecimalStringError(
      'INVALID_DECIMAL_TOKEN',
      `Decimal token cannot be represented canonically: ${JSON.stringify(value)}`,
    );
  }
  return normalized as DecimalString;
}

function assertScale(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    throw new RangeError('Decimal scale must be a non-negative safe integer.');
  }
}

export type DecimalOperand = DecimalString | Decimal;

function toFiniteDecimal(value: DecimalOperand): Decimal {
  if (typeof value === 'string') {
    return parseDecimalString(value);
  }
  const decimal = new FinScopeDecimal(value);
  if (!decimal.isFinite()) {
    throw new DecimalStringError('INVALID_DECIMAL_TOKEN', 'Decimal arithmetic input must be finite.');
  }
  return decimal;
}

export function roundHalfEven(value: DecimalOperand, scale = DEFAULT_DECIMAL_SCALE): Decimal {
  assertScale(scale);
  const decimal = toFiniteDecimal(value);
  if (!decimal.isFinite()) {
    throw new DecimalStringError('INVALID_DECIMAL_TOKEN', 'Decimal arithmetic input must be finite.');
  }
  return decimal.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN);
}

export function toDecimalString(
  value: DecimalOperand,
  scale = DEFAULT_DECIMAL_SCALE,
): DecimalString {
  const serialized = roundHalfEven(value, scale).toString();
  if (!DECIMAL_STRING_PATTERN.test(serialized)) {
    throw new DecimalStringError(
      'INVALID_DECIMAL_TOKEN',
      `Decimal result is not canonical: ${JSON.stringify(serialized)}`,
    );
  }
  return serialized as DecimalString;
}

export function addDecimalStrings(
  left: DecimalString,
  right: DecimalString,
  scale = DEFAULT_DECIMAL_SCALE,
): DecimalString {
  return toDecimalString(parseDecimalString(left).plus(parseDecimalString(right)), scale);
}

export function subtractDecimalStrings(
  left: DecimalString,
  right: DecimalString,
  scale = DEFAULT_DECIMAL_SCALE,
): DecimalString {
  return toDecimalString(parseDecimalString(left).minus(parseDecimalString(right)), scale);
}

export function multiplyDecimalStrings(
  left: DecimalString,
  right: DecimalString,
  scale = DEFAULT_DECIMAL_SCALE,
): DecimalString {
  return toDecimalString(parseDecimalString(left).times(parseDecimalString(right)), scale);
}

export function divideDecimalStrings(
  numerator: DecimalString,
  denominator: DecimalString,
  scale = DEFAULT_DECIMAL_SCALE,
): DecimalString {
  const divisor = parseDecimalString(denominator);
  if (divisor.isZero()) {
    throw new DecimalStringError('INVALID_DECIMAL_TOKEN', 'Decimal division by zero is forbidden.');
  }
  return toDecimalString(parseDecimalString(numerator).dividedBy(divisor), scale);
}
