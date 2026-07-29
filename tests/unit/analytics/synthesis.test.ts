import { describe, expect, it } from 'vitest';
import type { FundamentalRuleEvaluation } from '../../../src/domain/fundamental/types';
import {
  ACTIVE_SYNTHESIS_RULE_IDS,
  ACTIVE_SYNTHESIS_STATES,
  synthesizeRuleEvaluations,
} from '../../../src/domain/analytics/synthesis';

function evaluations(
  stateByRule: Readonly<Record<string, FundamentalRuleEvaluation['state']>>,
): readonly FundamentalRuleEvaluation[] {
  return ACTIVE_SYNTHESIS_RULE_IDS.map((ruleId) => {
    const state = stateByRule[ruleId] ?? 'not_triggered';
    return Object.freeze({
      ruleId,
      state,
      ...(state === 'not_evaluable'
        ? { reasonCodes: Object.freeze(['required_metric_unavailable_or_below_quality']) }
        : {}),
    });
  });
}

describe('deterministic five-state synthesis', () => {
  it('matches all five exact synthesis states', () => {
    const cases = [
      {
        expected: 'insufficient_information',
        input: evaluations(Object.fromEntries(
          ACTIVE_SYNTHESIS_RULE_IDS.map((ruleId) => [ruleId, 'not_evaluable']),
        )),
      },
      { expected: 'neutral', input: evaluations({}) },
      { expected: 'favorable', input: evaluations({ INS_LIQUIDITY_IMPROVEMENT: 'triggered' }) },
      { expected: 'unfavorable', input: evaluations({ INS_DILUTION: 'triggered' }) },
      {
        expected: 'mixed',
        input: evaluations({ INS_LIQUIDITY_IMPROVEMENT: 'triggered', INS_DILUTION: 'triggered' }),
      },
    ] as const;

    expect(ACTIVE_SYNTHESIS_STATES).toEqual([
      'insufficient_information', 'neutral', 'favorable', 'unfavorable', 'mixed',
    ]);
    for (const item of cases) {
      expect(synthesizeRuleEvaluations(item.input).state).toBe(item.expected);
    }
  });

  it('sorts triggered IDs and preserves every not-evaluable reason descriptively', () => {
    const input: readonly FundamentalRuleEvaluation[] = [
      { ruleId: 'INS_DILUTION', state: 'triggered' },
      {
        ruleId: 'INS_GROWTH_MARGIN_DETERIORATION',
        state: 'not_evaluable',
        reasonCodes: ['required_metric_unavailable_or_below_quality', 'prior_period_missing'],
      },
      { ruleId: 'INS_LIQUIDITY_IMPROVEMENT', state: 'triggered' },
    ];
    const result = synthesizeRuleEvaluations(input);
    expect(result.state).toBe('mixed');
    expect(result.triggeredRuleIds).toEqual(['INS_DILUTION', 'INS_LIQUIDITY_IMPROVEMENT']);
    expect(result.limitations).toEqual([
      'INS_GROWTH_MARGIN_DETERIORATION: prior period missing (prior_period_missing)',
      'INS_GROWTH_MARGIN_DETERIORATION: required metric unavailable or below minimum quality (required_metric_unavailable_or_below_quality)',
    ]);
  });

  it('emits only descriptive synthesis fields', () => {
    const result = synthesizeRuleEvaluations(evaluations({ INS_DILUTION: 'triggered' }));
    expect(Object.keys(result).sort()).toEqual(['state', 'triggeredRuleIds']);
    expect(result).not.toHaveProperty('recommendation');
    expect(result).not.toHaveProperty('targetPrice');
    expect(result).not.toHaveProperty('probability');
    expect(result).not.toHaveProperty('confidenceScore');
  });

  it('rejects duplicate or unknown rule outcomes', () => {
    expect(() => synthesizeRuleEvaluations([
      { ruleId: 'INS_DILUTION', state: 'triggered' },
      { ruleId: 'INS_DILUTION', state: 'not_triggered' },
    ])).toThrow(/Duplicate rule evaluation/u);
    expect(() => synthesizeRuleEvaluations([
      { ruleId: 'INS_UNKNOWN', state: 'not_triggered' },
    ])).toThrow(/Unknown rule evaluation/u);
  });
});
