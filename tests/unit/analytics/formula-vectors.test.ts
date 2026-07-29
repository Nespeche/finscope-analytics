import { describe, expect, it } from 'vitest';
import { createProductSchemaValidator } from '../../../src/core/schema-validator';
import formulaCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/formula-catalog.json';
import negativeFixtureJson from '../../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-vectors-negative.json';
import positiveFixtureJson from '../../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json';
import formulaVectorSchemaJson from '../../../specs/001-fundamental-analysis-platform/schemas/formula-vectors.schema.json';
import {
  FORMULA_DEFINITIONS,
  FORMULA_IDS,
  evaluateFormula,
  isFormulaId,
  type FormulaEvaluationContext,
} from '../../../src/domain/analytics/formula-engine';

interface FormulaVector {
  readonly vectorId: string;
  readonly formulaId: string;
  readonly inputs: readonly unknown[];
  readonly context?: FormulaEvaluationContext;
  readonly expected: Readonly<{
    state: string;
    value?: string;
    reasonCode?: string;
    valueAbsent?: boolean;
  }>;
}

const positiveFixture = positiveFixtureJson as unknown as {
  readonly formulaCount: number;
  readonly vectorCount: number;
  readonly vectors: readonly FormulaVector[];
};
const negativeFixture = negativeFixtureJson as unknown as {
  readonly caseCount: number;
  readonly cases: readonly Readonly<{
    caseId: string;
    instance: unknown;
    expectedValid: false;
  }>[];
};

describe('closed formula engine', () => {
  it('exposes exactly the 15 active catalog definitions in priority order', () => {
    const catalogIds = formulaCatalogJson.formulas.map((formula) => formula.formulaId);
    expect(FORMULA_IDS).toHaveLength(15);
    expect(FORMULA_DEFINITIONS).toHaveLength(15);
    expect(FORMULA_DEFINITIONS.map((formula) => formula.formulaId)).toEqual(catalogIds);
    expect(new Set(FORMULA_IDS).size).toBe(15);
    expect(FORMULA_IDS.every(isFormulaId)).toBe(true);
  });

  it.each(positiveFixture.vectors)('$vectorId matches its exact oracle', (vector) => {
    expect(positiveFixture.formulaCount).toBe(15);
    expect(positiveFixture.vectorCount).toBe(36);
    expect(isFormulaId(vector.formulaId)).toBe(true);
    const result = evaluateFormula(vector.formulaId, vector.inputs, vector.context);
    expect(result.state).toBe(vector.expected.state);
    if (vector.expected.value !== undefined) {
      expect(result).toEqual({ state: 'available', value: vector.expected.value });
    } else {
      expect(result).toMatchObject({ reasonCode: vector.expected.reasonCode });
      expect(result).not.toHaveProperty('value');
    }
  });

  it('rejects all seven normative negative vector instances through the closed schema', () => {
    const schema = formulaVectorSchemaJson as { readonly $id: string };
    const validator = createProductSchemaValidator();
    const vectorSchemaReference = `${schema.$id}#/$defs/vector`;
    expect(negativeFixture.caseCount).toBe(7);
    for (const negativeCase of negativeFixture.cases) {
      expect(negativeCase.expectedValid).toBe(false);
      const result = validator.validate(vectorSchemaReference, negativeCase.instance);
      expect(result.valid, negativeCase.caseId).toBe(false);
      if (!result.valid) {
        expect(result.errors.length, negativeCase.caseId).toBeGreaterThan(0);
      }
    }
  });

  it('preserves catalog reason precedence before denominator and debt-context checks', () => {
    expect(evaluateFormula('divide', [])).toEqual({ state: 'insufficient', reasonCode: 'invalid_arity' });
    expect(evaluateFormula('divide', [null, '0'])).toEqual({
      state: 'insufficient', reasonCode: 'required_input_missing',
    });
    expect(evaluateFormula('divide', [1, '0'])).toEqual({
      state: 'insufficient', reasonCode: 'invalid_input',
    });
    expect(evaluateFormula('divide', ['1.0', '0'])).toEqual({
      state: 'insufficient', reasonCode: 'non_canonical_decimal',
    });
    expect(evaluateFormula('divide', ['1', '0'])).toEqual({
      state: 'not_meaningful', reasonCode: 'zero_denominator',
    });
    expect(evaluateFormula('debt_bucket_sum', ['1'], { incomplete: true, overlap: true })).toEqual({
      state: 'partial', reasonCode: 'incomplete_debt_buckets',
    });
  });

  it('rejects unknown formulas instead of falling back to inferred arithmetic', () => {
    expect(() => evaluateFormula('unknown_formula', ['1'])).toThrow('UNKNOWN_FORMULA_ID');
  });
});
