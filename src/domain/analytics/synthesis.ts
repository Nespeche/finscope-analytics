import insightRuleCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/insight-rule-catalog.json';
import type { FundamentalRuleEvaluation } from '../fundamental/types';
import type { SynthesisState } from '../model';
import {
  ACTIVE_INSIGHT_RULES,
  getInsightRuleDefinition,
  type RulePolarity,
} from './rule-engine';

export interface FundamentalSynthesis {
  readonly state: SynthesisState;
  readonly triggeredRuleIds: readonly string[];
  readonly limitations?: readonly string[];
}

interface SynthesisTableEntry {
  readonly condition: string;
  readonly result: SynthesisState;
}

interface SynthesisCatalogDocument {
  readonly synthesisTable: readonly SynthesisTableEntry[];
}

export class SynthesisError extends TypeError {
  constructor(
    readonly code: 'INVALID_SYNTHESIS_TABLE' | 'DUPLICATE_RULE_RESULT' | 'UNKNOWN_RULE_RESULT',
    message: string,
  ) {
    super(message);
    this.name = 'SynthesisError';
  }
}

const EXPECTED_STATES: readonly SynthesisState[] = Object.freeze([
  'insufficient_information',
  'neutral',
  'favorable',
  'unfavorable',
  'mixed',
]);

const catalog = insightRuleCatalogJson as unknown as SynthesisCatalogDocument;
const synthesisStates = catalog.synthesisTable.map((entry) => entry.result);
if (
  synthesisStates.length !== EXPECTED_STATES.length
  || JSON.stringify(synthesisStates) !== JSON.stringify(EXPECTED_STATES)
) {
  throw new SynthesisError('INVALID_SYNTHESIS_TABLE', 'The active five-state synthesis table is inconsistent.');
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, 'en')));
}

function descriptiveReason(reasonCode: string): string {
  switch (reasonCode) {
    case 'required_metric_unavailable_or_below_quality':
      return 'required metric unavailable or below minimum quality';
    case 'profile_not_allowlisted':
      return 'rule is not applicable to the active accounting profile';
    default:
      return reasonCode.replaceAll('_', ' ');
  }
}

function buildLimitations(evaluations: readonly FundamentalRuleEvaluation[]): readonly string[] {
  const limitations: string[] = [];
  for (const evaluation of evaluations) {
    if (evaluation.state !== 'not_evaluable') continue;
    const reasons = evaluation.reasonCodes?.length === 0 || evaluation.reasonCodes === undefined
      ? ['not_evaluable_reason_unspecified']
      : evaluation.reasonCodes;
    for (const reasonCode of reasons) {
      limitations.push(`${evaluation.ruleId}: ${descriptiveReason(reasonCode)} (${reasonCode})`);
    }
  }
  return uniqueSorted(limitations);
}

function triggeredPolarities(
  evaluations: readonly FundamentalRuleEvaluation[],
): ReadonlySet<RulePolarity> {
  const polarities = new Set<RulePolarity>();
  for (const evaluation of evaluations) {
    if (evaluation.state === 'triggered') {
      polarities.add(getInsightRuleDefinition(evaluation.ruleId).polarity);
    }
  }
  return polarities;
}

function deriveState(evaluations: readonly FundamentalRuleEvaluation[]): SynthesisState {
  const evaluable = evaluations.filter((evaluation) => evaluation.state !== 'not_evaluable');
  if (evaluable.length === 0) return 'insufficient_information';

  const triggered = evaluable.filter((evaluation) => evaluation.state === 'triggered');
  if (triggered.length === 0) return 'neutral';

  const polarities = triggeredPolarities(triggered);
  if (polarities.size === 2) return 'mixed';
  return polarities.has('favorable') ? 'favorable' : 'unfavorable';
}

function validateEvaluations(evaluations: readonly FundamentalRuleEvaluation[]): void {
  const seen = new Set<string>();
  for (const evaluation of evaluations) {
    if (seen.has(evaluation.ruleId)) {
      throw new SynthesisError('DUPLICATE_RULE_RESULT', `Duplicate rule evaluation: ${evaluation.ruleId}`);
    }
    seen.add(evaluation.ruleId);
    try {
      getInsightRuleDefinition(evaluation.ruleId);
    } catch {
      throw new SynthesisError('UNKNOWN_RULE_RESULT', `Unknown rule evaluation: ${evaluation.ruleId}`);
    }
  }
}

/**
 * Produces the total, descriptive-only five-state synthesis from completed rule outcomes.
 * The result contains no investment action, valuation, probability or numeric quality score.
 */
export function synthesizeRuleEvaluations(
  evaluations: readonly FundamentalRuleEvaluation[],
): FundamentalSynthesis {
  validateEvaluations(evaluations);
  const state = deriveState(evaluations);
  const triggeredRuleIds = uniqueSorted(
    evaluations
      .filter((evaluation) => evaluation.state === 'triggered')
      .map((evaluation) => evaluation.ruleId),
  );
  const limitations = buildLimitations(evaluations);
  return Object.freeze({
    state,
    triggeredRuleIds,
    ...(limitations.length === 0 ? {} : { limitations }),
  });
}

export const ACTIVE_SYNTHESIS_STATES = Object.freeze([...EXPECTED_STATES]);
export const ACTIVE_SYNTHESIS_RULE_IDS = Object.freeze(
  ACTIVE_INSIGHT_RULES.map((rule) => rule.ruleId),
);
