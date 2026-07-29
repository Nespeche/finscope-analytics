import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import formulaTestVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json';
import formulaVectorNegativeFixtures from '../../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-vectors-negative.json';
import {
  addDecimalStrings,
  canonicalizeDecimalString,
  divideDecimalStrings,
  isDecimalString,
  multiplyDecimalStrings,
  parseDecimalString,
  subtractDecimalStrings,
  toDecimalString,
  type DecimalString,
} from '../../../src/core/decimal';

function decimal(value: string): DecimalString {
  expect(isDecimalString(value)).toBe(true);
  return value as DecimalString;
}

describe('canonical DecimalString and ROUND_HALF_EVEN helpers', () => {
  it('accepts every decimal input and output published by all 36 positive formula vectors', () => {
    expect(formulaTestVectors.vectorCount).toBe(36);
    for (const vector of formulaTestVectors.vectors) {
      for (const input of vector.inputs) {
        expect(isDecimalString(input), `${vector.vectorId} input ${input}`).toBe(true);
        expect(parseDecimalString(input).toString()).toBe(input);
      }
      if ('value' in vector.expected && vector.expected.value !== undefined) {
        expect(isDecimalString(vector.expected.value), `${vector.vectorId} output`).toBe(true);
        expect(parseDecimalString(vector.expected.value).toString()).toBe(vector.expected.value);
      }
    }
  });

  it('rejects every published negative fixture whose failure targets DecimalString', () => {
    const decimalFixtures = formulaVectorNegativeFixtures.cases.filter(
      (fixture) => fixture.expectedFailure === 'DecimalString',
    );

    expect(decimalFixtures.map((fixture) => fixture.caseId)).toEqual([
      'NEG-TRAILING-ZEROS',
      'NEG-EXPONENT',
      'NEG-NEGATIVE-ZERO',
    ]);

    for (const fixture of decimalFixtures) {
      const input = fixture.instance.inputs[0];
      expect(input, fixture.caseId).toBeDefined();
      expect(isDecimalString(input), fixture.caseId).toBe(false);
      expect(() => parseDecimalString(input)).toThrow(/not canonical/u);
    }
  });

  it('sanitizes trailing zero and negative-zero source tokens without accepting exponent or plus syntax', () => {
    expect(canonicalizeDecimalString('1.2300')).toBe('1.23');
    expect(canonicalizeDecimalString('-0')).toBe('0');
    expect(canonicalizeDecimalString('0.000')).toBe('0');
    expect(() => canonicalizeDecimalString('+1')).toThrow(/plain base-10/u);
    expect(() => canonicalizeDecimalString('1e2')).toThrow(/plain base-10/u);
    expect(() => canonicalizeDecimalString('01')).toThrow(/plain base-10/u);
  });

  it('performs exact decimal arithmetic and banker rounding without IEEE-754 value conversion', () => {
    expect(addDecimalStrings(decimal('0.1'), decimal('0.2'))).toBe('0.3');
    expect(subtractDecimalStrings(decimal('1000000000000000000'), decimal('0.1')))
      .toBe('999999999999999999.9');
    expect(multiplyDecimalStrings(decimal('1.25'), decimal('8'))).toBe('10');
    expect(divideDecimalStrings(decimal('1'), decimal('8'))).toBe('0.125');
    expect(toDecimalString(decimal('2.345'), 2)).toBe('2.34');
    expect(toDecimalString(decimal('2.355'), 2)).toBe('2.36');
    expect(toDecimalString(decimal('-2.345'), 2)).toBe('-2.34');
    expect(toDecimalString(decimal('-2.355'), 2)).toBe('-2.36');
    expect(() => divideDecimalStrings(decimal('1'), decimal('0'))).toThrow(/division by zero/u);
  });

  it('contains no native numeric parsing path for financial values', async () => {
    const source = await readFile('src/core/decimal.ts', 'utf8');
    expect(source).not.toMatch(/parseFloat|parseInt|\bNumber\s*\(/u);
    expect(source).not.toContain('.toNumber(');
    expect(source).not.toContain('Math.round');
  });
});
