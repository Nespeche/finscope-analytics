import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import metricCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import metricFixtureJson from '../../../specs/001-fundamental-analysis-platform/fixtures/metrics/metric-test-vectors.json';
import { FORMULA_DEFINITIONS, isFormulaId } from '../../../src/domain/analytics/formula-engine';
import {
  DEFERRED_METRIC_IDS,
  FUNDAMENTAL_METRIC_DEFINITIONS,
  evaluateFundamentalMetric,
  evaluateFundamentalMetrics,
} from '../../../src/domain/analytics/fundamental-metrics';
import type { FundamentalQualityAxes } from '../../../src/domain/analytics/quality-classifier';
import type { QualityClassification } from '../../../src/domain/model';

interface MetricFixture {
  readonly fixtureId: string;
  readonly metricId: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly profileId: string;
  readonly qualityClassification: QualityClassification;
  readonly expected: Readonly<{
    state: string;
    valueDecimal?: string;
    reasonCode?: string;
  }>;
}

const fixtures = (metricFixtureJson as unknown as {
  readonly expectedCount: number;
  readonly fixtures: readonly MetricFixture[];
}).fixtures.filter((fixture) => fixture.metricId.startsWith('FND_'));

const REPRESENTATIVE_AXES: Readonly<Record<QualityClassification, FundamentalQualityAxes>> = Object.freeze({
  verified: Object.freeze({
    mappingQuality: 'exact', completeness: 'complete', comparability: 'comparable', revisionState: 'current',
  }),
  usable_with_caveats: Object.freeze({
    mappingQuality: 'derived', completeness: 'complete', comparability: 'comparable', revisionState: 'current',
  }),
  insufficient: Object.freeze({
    mappingQuality: 'ambiguous', completeness: 'missing', comparability: 'incompatible', revisionState: 'conflicted',
  }),
});

const USABLE = REPRESENTATIVE_AXES.usable_with_caveats;

describe('fundamental metric catalog executor', () => {
  it('exposes exactly 24 fundamental metrics and one formula per active catalog metric', () => {
    expect(FUNDAMENTAL_METRIC_DEFINITIONS).toHaveLength(24);
    expect(new Set(FUNDAMENTAL_METRIC_DEFINITIONS.map((metric) => metric.metricId)).size).toBe(24);
    expect(FUNDAMENTAL_METRIC_DEFINITIONS.every((metric) => metric.metricId.startsWith('FND_'))).toBe(true);
    expect(FUNDAMENTAL_METRIC_DEFINITIONS.every((metric) => isFormulaId(metric.formulaId))).toBe(true);
    expect(metricCatalogJson.metrics).toHaveLength(32);
    expect(FORMULA_DEFINITIONS).toHaveLength(15);
    expect(metricCatalogJson.metrics.every((metric) => isFormulaId(metric.formulaId))).toBe(true);
    expect(DEFERRED_METRIC_IDS.every((metricId) =>
      !FUNDAMENTAL_METRIC_DEFINITIONS.some((metric) => metric.metricId === metricId))).toBe(true);
    expect(FUNDAMENTAL_METRIC_DEFINITIONS.some((metric) =>
      /valuation|price[_-]?to|enterprise[_-]?value|target[_-]?price/i.test(metric.metricId))).toBe(false);
  });

  it.each(fixtures)('$fixtureId matches the metric oracle', (fixture) => {
    expect(fixtures).toHaveLength(72);
    const evaluation = evaluateFundamentalMetric({
      metricId: fixture.metricId,
      inputs: fixture.inputs,
      profileId: fixture.profileId,
      quality: REPRESENTATIVE_AXES[fixture.qualityClassification],
    });
    expect(evaluation.state).toBe(fixture.expected.state);
    expect(evaluation.qualityClassification).toBe(fixture.qualityClassification);
    if (fixture.expected.valueDecimal !== undefined) {
      expect(evaluation.valueDecimal).toBe(fixture.expected.valueDecimal);
      expect(evaluation.reasonCodes).toBeUndefined();
    } else {
      expect(evaluation.valueDecimal).toBeUndefined();
      expect(evaluation.reasonCodes).toEqual([fixture.expected.reasonCode]);
    }
  });

  it('attempts all 24 metrics in priority order and reuses derived metric values', () => {
    const inputs = {
      revenue: '100',
      'revenue.current': '120',
      'revenue.prior_year': '100',
      'revenue.current_quarter': '120',
      'revenue.previous_quarter': '100',
      grossProfit: '40',
      operatingIncome: '20',
      netIncome: '10',
      cashFlowFromOperations: '15',
      capitalExpenditures: '5',
      cashAndEquivalents: '30',
      shortTermBorrowings: '10',
      currentPortionLongTermDebt: '5',
      longTermDebtNoncurrent: '20',
      commercialPaper: '0',
      otherApprovedInterestBearingBorrowings: '0',
      currentAssets: '80',
      currentLiabilities: '40',
      depreciationAndAmortization: '5',
      equity: '100',
      interestExpense: '4',
      'assets.opening': '90',
      'assets.closing': '110',
      'equity.opening': '90',
      'equity.closing': '110',
      'dilutedShares.current': '110',
      'dilutedShares.prior_year': '100',
    } as const;
    const qualityByMetric = Object.fromEntries(
      FUNDAMENTAL_METRIC_DEFINITIONS.map((metric) => [metric.metricId, USABLE]),
    );
    const results = evaluateFundamentalMetrics({
      inputs,
      profileId: 'general_operating_us_gaap',
      qualityByMetric,
    });
    expect(results).toHaveLength(24);
    expect(results.map((result) => result.metricId)).toEqual(
      FUNDAMENTAL_METRIC_DEFINITIONS.map((metric) => metric.metricId),
    );
    expect(results.every((result) => result.state === 'available')).toBe(true);
    expect(results.find((result) => result.metricId === 'FND_BORROWINGS_DEBT')?.valueDecimal).toBe('35');
    expect(results.find((result) => result.metricId === 'FND_NET_DEBT')?.valueDecimal).toBe('5');
    expect(results.find((result) => result.metricId === 'FND_DERIVED_EBITDA')?.valueDecimal).toBe('25');
    expect(results.find((result) => result.metricId === 'FND_EBITDA_MARGIN')?.valueDecimal).toBe('0.25');
  });

  it('blocks debt-dependent metrics when bucket overlap leaves debt partial', () => {
    const qualityByMetric = Object.fromEntries(
      FUNDAMENTAL_METRIC_DEFINITIONS.map((metric) => [metric.metricId, USABLE]),
    );
    const results = evaluateFundamentalMetrics({
      inputs: {
        shortTermBorrowings: '10',
        currentPortionLongTermDebt: '5',
        longTermDebtNoncurrent: '20',
        commercialPaper: '0',
        cashAndEquivalents: '30',
        equity: '100',
      },
      profileId: 'general_operating_us_gaap',
      qualityByMetric,
      formulaContextByMetric: { FND_BORROWINGS_DEBT: { overlap: true } },
    });
    const debt = results.find((result) => result.metricId === 'FND_BORROWINGS_DEBT');
    const netDebt = results.find((result) => result.metricId === 'FND_NET_DEBT');
    const debtEquity = results.find((result) => result.metricId === 'FND_DEBT_EQUITY');
    expect(debt).toMatchObject({ state: 'partial', reasonCodes: ['overlapping_debt_buckets'] });
    expect(netDebt).toMatchObject({ state: 'insufficient', reasonCodes: ['required_input_missing'] });
    expect(debtEquity).toMatchObject({ state: 'insufficient', reasonCodes: ['required_input_missing'] });
  });

  it('applies period and quality gates without inventing a value', () => {
    const periodBlocked = evaluateFundamentalMetric({
      metricId: 'FND_DERIVED_EBITDA',
      inputs: { operatingIncome: '100', depreciationAndAmortization: '20' },
      profileId: 'general_operating_us_gaap',
      quality: USABLE,
      periodCompatible: false,
      periodReasonCode: 'lineage_mismatch',
    });
    expect(periodBlocked).toMatchObject({
      state: 'insufficient', reasonCodes: ['lineage_mismatch'],
    });
    expect(periodBlocked).not.toHaveProperty('valueDecimal');

    const qualityBlocked = evaluateFundamentalMetric({
      metricId: 'FND_REVENUE',
      inputs: { revenue: '100' },
      profileId: 'general_operating_us_gaap',
      quality: REPRESENTATIVE_AXES.insufficient,
    });
    expect(qualityBlocked).toMatchObject({
      state: 'insufficient', reasonCodes: ['quality_below_minimum'],
    });
    expect(qualityBlocked).not.toHaveProperty('valueDecimal');
  });

  it('contains no duplicated decimal arithmetic in the metric layer', () => {
    const source = readFileSync(
      new URL('../../../src/domain/analytics/fundamental-metrics.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('evaluateFormula(');
    expect(source).not.toMatch(/new\s+(?:Decimal|FinScopeDecimal)|\.plus\(|\.minus\(|\.times\(|\.dividedBy\(/u);
  });
});
