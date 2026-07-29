import { describe, expect, it } from 'vitest';
import {
  buildTtmWindow,
  classifyFiscalPeriod,
  findComparablePrior,
  resolveFiscalPeriods,
  type FiscalFactPeriod,
} from '../../../src/domain/fundamental/period-resolver';

function period(overrides: Partial<FiscalFactPeriod> = {}): FiscalFactPeriod {
  return {
    factId: 'FY2025',
    canonicalConceptId: 'revenue',
    kind: 'duration',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    fiscalYear: 2025,
    fiscalPeriod: 'FY',
    scopeId: 'consolidated',
    currency: 'USD',
    restatementLineageId: 'lineage-1',
    ...overrides,
  };
}

function quarter(fiscalYear: number, fiscalPeriod: 'Q1' | 'Q2' | 'Q3' | 'Q4', startDate: string, endDate: string): FiscalFactPeriod {
  return period({
    factId: `${fiscalYear}-${fiscalPeriod}`,
    fiscalYear,
    fiscalPeriod,
    startDate,
    endDate,
  });
}

describe('fiscal period resolver', () => {
  it('classifies only explicit FY and quarter metadata and never infers from calendar dates', () => {
    expect(classifyFiscalPeriod(period()).classification).toBe('fy');
    expect(classifyFiscalPeriod(quarter(2025, 'Q1', '2025-01-01', '2025-03-31'))).toMatchObject({
      classification: 'quarter', quarterNumber: 1,
    });
    const explicitMetadataMissing = period();
    const { fiscalPeriod: _removed, ...withoutFiscalPeriod } = explicitMetadataMissing;
    expect(classifyFiscalPeriod(withoutFiscalPeriod)).toMatchObject({
      classification: 'unclassified',
    });
  });

  it('finds a comparable prior only with the same fiscal basis and compatible duration', () => {
    const current = quarter(2025, 'Q2', '2025-04-01', '2025-06-30');
    const result = findComparablePrior(current, [
      quarter(2024, 'Q2', '2024-04-01', '2024-06-30'),
      period({ factId: 'annual-2024', fiscalYear: 2024, fiscalPeriod: 'FY' }),
    ]);
    expect(result).toMatchObject({ state: 'available', prior: { factId: '2024-Q2' } });

    const mixed = findComparablePrior(current, [period({ factId: 'annual-2024', fiscalYear: 2024 })]);
    expect(mixed).toMatchObject({ state: 'insufficient', reasonCode: 'compatible_prior_period_missing' });
  });

  it('builds TTM only from four consecutive compatible explicit quarters', () => {
    const available = buildTtmWindow([
      quarter(2024, 'Q3', '2024-07-01', '2024-09-30'),
      quarter(2024, 'Q4', '2024-10-01', '2024-12-31'),
      quarter(2025, 'Q1', '2025-01-01', '2025-03-31'),
      quarter(2025, 'Q2', '2025-04-01', '2025-06-30'),
    ]);
    expect(available).toMatchObject({ state: 'available' });
    expect(available.periods.map((item) => item.factId)).toEqual(['2024-Q3', '2024-Q4', '2025-Q1', '2025-Q2']);

    const mixedDuration = buildTtmWindow([
      quarter(2024, 'Q3', '2024-07-01', '2024-09-30'),
      quarter(2024, 'Q4', '2024-10-01', '2024-12-31'),
      quarter(2025, 'Q1', '2025-01-01', '2025-03-31'),
      period({ factId: 'FY2025', fiscalYear: 2025, fiscalPeriod: 'FY' }),
    ]);
    expect(mixedDuration).toMatchObject({ state: 'insufficient', reasonCode: 'four_explicit_quarters_required' });
  });

  it('exposes FY, quarter and TTM without fabricating annual-plus-quarter sums', () => {
    const result = resolveFiscalPeriods([
      period(),
      quarter(2025, 'Q1', '2025-01-01', '2025-03-31'),
    ]);
    expect(result.latestFy?.factId).toBe('FY2025');
    expect(result.latestQuarter?.factId).toBe('2025-Q1');
    expect(result.ttm).toMatchObject({ state: 'insufficient', reasonCode: 'four_explicit_quarters_required' });
  });
});
