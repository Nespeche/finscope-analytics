import { describe, expect, it } from 'vitest';
import insightRuleCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/insight-rule-catalog.json';
import ruleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/rules/rule-test-vectors.json';
import { canonicalizeDecimalString } from '../../../src/core/decimal';
import {
  ACTIVE_INSIGHT_RULES,
  evaluateInsightRule,
  getInsightRuleDefinition,
  validateRuleNode,
  type RuleMetricContext,
  type RuleMetricObservation,
  type RuleMetricSeries,
} from '../../../src/domain/analytics/rule-engine';

interface RuleFixture {
  readonly fixtureId: string;
  readonly ruleId: string;
  readonly case: 'triggered' | 'not_triggered' | 'not_evaluable';
  readonly metricContext: Readonly<Record<string, Readonly<{
    state: string;
    qualityClassification: string;
    valueDecimal?: string;
  }>>>;
  readonly expected: Readonly<{
    state: 'triggered' | 'not_triggered' | 'not_evaluable';
    reasonCode?: string;
    polarity?: 'favorable' | 'unfavorable';
  }>;
}

const fixtures = ruleVectorsJson.fixtures as readonly RuleFixture[];

function observation(value: string): RuleMetricObservation {
  return Object.freeze({
    state: 'available',
    qualityClassification: 'usable_with_caveats',
    valueDecimal: canonicalizeDecimalString(value),
  });
}

function series(
  current: string,
  priorYear: string,
  window?: readonly string[],
): RuleMetricSeries {
  return Object.freeze({
    current: observation(current),
    prior_year: observation(priorYear),
    ...(window === undefined ? {} : { window: Object.freeze(window.map(observation)) }),
  });
}

const TRIGGERED_CONTEXTS: Readonly<Record<string, RuleMetricContext>> = Object.freeze({
  INS_GROWTH_MARGIN_DETERIORATION: Object.freeze({
    FND_REVENUE_GROWTH_YOY: observation('0.1'),
    FND_OPERATING_MARGIN: series('0.1', '0.2'),
  }),
  INS_EARNINGS_WITHOUT_CASH_CONVERSION: Object.freeze({
    FND_NET_MARGIN: observation('0.1'),
    FND_EARNINGS_QUALITY: observation('0.5'),
  }),
  INS_DEBT_FUNDED_GROWTH: Object.freeze({
    FND_REVENUE_GROWTH_YOY: observation('0.1'),
    FND_BORROWINGS_DEBT: series('2', '1'),
    FND_CFO: series('1', '2'),
  }),
  INS_LIQUIDITY_IMPROVEMENT: Object.freeze({
    FND_CURRENT_RATIO: series('2', '1'),
    FND_WORKING_CAPITAL: series('2', '1'),
  }),
  INS_DELEVERAGING: Object.freeze({
    FND_BORROWINGS_DEBT: series('1', '2'),
    FND_DEBT_EQUITY: series('2', '1'),
  }),
  INS_PERSISTENT_NEGATIVE_FCF: Object.freeze({
    FND_FCF: Object.freeze({
      current: observation('-1'),
      window: Object.freeze(['-1', '-2', '-3', '1'].map(observation)),
    }),
  }),
  INS_DILUTION: Object.freeze({
    FND_DILUTED_SHARES_EVOLUTION: observation('0.04'),
  }),
  INS_INTEREST_COVERAGE_DETERIORATION: Object.freeze({
    FND_INTEREST_COVERAGE: series('1', '3'),
  }),
  INS_EBITDA_CASH_DIVERGENCE: Object.freeze({
    FND_DERIVED_EBITDA: series('2', '1'),
    FND_CFO: series('1', '2'),
  }),
});

const NOT_TRIGGERED_CONTEXTS: Readonly<Record<string, RuleMetricContext>> = Object.freeze({
  INS_GROWTH_MARGIN_DETERIORATION: Object.freeze({
    FND_REVENUE_GROWTH_YOY: observation('0.1'),
    FND_OPERATING_MARGIN: series('0.3', '0.2'),
  }),
  INS_EARNINGS_WITHOUT_CASH_CONVERSION: Object.freeze({
    FND_NET_MARGIN: observation('0.1'),
    FND_EARNINGS_QUALITY: observation('0.8'),
  }),
  INS_DEBT_FUNDED_GROWTH: Object.freeze({
    FND_REVENUE_GROWTH_YOY: observation('-0.1'),
    FND_BORROWINGS_DEBT: series('2', '1'),
    FND_CFO: series('1', '2'),
  }),
  INS_LIQUIDITY_IMPROVEMENT: Object.freeze({
    FND_CURRENT_RATIO: series('1', '2'),
    FND_WORKING_CAPITAL: series('2', '1'),
  }),
  INS_DELEVERAGING: Object.freeze({
    FND_BORROWINGS_DEBT: series('2', '1'),
    FND_DEBT_EQUITY: series('2', '1'),
  }),
  INS_PERSISTENT_NEGATIVE_FCF: Object.freeze({
    FND_FCF: Object.freeze({
      current: observation('-1'),
      window: Object.freeze(['-1', '-2', '1', '2'].map(observation)),
    }),
  }),
  INS_DILUTION: Object.freeze({
    FND_DILUTED_SHARES_EVOLUTION: observation('0.03'),
  }),
  INS_INTEREST_COVERAGE_DETERIORATION: Object.freeze({
    FND_INTEREST_COVERAGE: series('3', '2'),
  }),
  INS_EBITDA_CASH_DIVERGENCE: Object.freeze({
    FND_DERIVED_EBITDA: series('1', '2'),
    FND_CFO: series('1', '2'),
  }),
});

function fixtureContext(fixture: RuleFixture): RuleMetricContext {
  if (fixture.case === 'triggered') {
    const context = TRIGGERED_CONTEXTS[fixture.ruleId];
    if (context === undefined) throw new Error(`Missing triggered context: ${fixture.ruleId}`);
    return context;
  }
  if (fixture.case === 'not_triggered') {
    const context = NOT_TRIGGERED_CONTEXTS[fixture.ruleId];
    if (context === undefined) throw new Error(`Missing negative context: ${fixture.ruleId}`);
    return context;
  }
  return fixture.metricContext as unknown as RuleMetricContext;
}

describe('closed insight AST and nine active rules', () => {
  it('loads exactly nine schema-valid active fundamental rules', () => {
    expect(ACTIVE_INSIGHT_RULES).toHaveLength(9);
    expect(insightRuleCatalogJson.rules).toHaveLength(9);
    expect(new Set(ACTIVE_INSIGHT_RULES.map((rule) => rule.ruleId)).size).toBe(9);
    expect(ACTIVE_INSIGHT_RULES.every((rule) => (
      rule.inputMetricIds.every((metricId) => metricId.startsWith('FND_'))
      && rule.consumers.includes('synthesis')
    ))).toBe(true);
    for (const rule of insightRuleCatalogJson.rules) {
      expect(validateRuleNode(rule.ast)).toEqual(rule.ast);
    }
  });

  it('rejects an unknown operation instead of executing it', () => {
    expect(() => validateRuleNode({ op: 'script', source: 'return true' })).toThrow(/closed schema/u);
  });

  it.each(fixtures)('$fixtureId yields its normative three-state outcome', (fixture: RuleFixture) => {
    expect(fixtures).toHaveLength(27);
    const definition = getInsightRuleDefinition(fixture.ruleId);
    const result = evaluateInsightRule({
      ruleId: fixture.ruleId,
      profileId: definition.profileAllowlist[0] ?? 'unsupported_profile',
      metricContext: fixtureContext(fixture),
    });
    expect(result.state).toBe(fixture.expected.state);
    if (fixture.expected.reasonCode !== undefined) {
      expect(result.reasonCodes).toContain(fixture.expected.reasonCode);
    }
    if (fixture.expected.polarity !== undefined) {
      expect(definition.polarity).toBe(fixture.expected.polarity);
    }
    expect(['triggered', 'not_triggered', 'not_evaluable']).toContain(result.state);
  });

  it('gates an otherwise true rule when the profile is not allowlisted', () => {
    const result = evaluateInsightRule({
      ruleId: 'INS_EARNINGS_WITHOUT_CASH_CONVERSION',
      profileId: 'financial_institution_limited',
      metricContext: TRIGGERED_CONTEXTS.INS_EARNINGS_WITHOUT_CASH_CONVERSION ?? {},
    });
    expect(result).toEqual({
      ruleId: 'INS_EARNINGS_WITHOUT_CASH_CONVERSION',
      state: 'not_evaluable',
      reasonCodes: ['profile_not_allowlisted'],
    });
  });
});
