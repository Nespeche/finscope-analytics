import insightRuleCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/insight-rule-catalog.json';
import type { DecimalString } from '../../core/decimal';
import { parseDecimalString } from '../../core/decimal';
import { createProductSchemaValidator } from '../../core/schema-validator';
import type { FundamentalRuleEvaluation } from '../fundamental/types';
import type {
  MetricState,
  QualityClassification,
  RuleState,
} from '../model';

const RULE_NODE_SCHEMA = 'https://finscope.local/schemas/rule-node.schema.json#/$defs/RuleNode';
const REQUIRED_ACTIVE_RULE_COUNT = 9;
const NOT_EVALUABLE_REASON = 'required_metric_unavailable_or_below_quality';

export type PeriodSelector = 'current' | 'prior_year' | 'previous_quarter' | 'window_item';
export type RuleComparator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
export type RulePolarity = 'favorable' | 'unfavorable';

export interface MetricOperand {
  readonly kind: 'metric';
  readonly metricId: string;
  readonly periodSelector: PeriodSelector;
}

export interface DecimalOperand {
  readonly kind: 'decimal';
  readonly valueDecimal: DecimalString;
}

export type RuleOperand = MetricOperand | DecimalOperand;

export type RuleNode =
  | Readonly<{ op: 'all'; children: readonly RuleNode[] }>
  | Readonly<{ op: 'any'; children: readonly RuleNode[] }>
  | Readonly<{
    op: 'count_at_least';
    minimum: number;
    window: Readonly<{ periodSet: 'latest_annual' | 'latest_quarterly'; count: number }>;
    child: RuleNode;
  }>
  | Readonly<{
    op: 'comparison';
    left: RuleOperand;
    comparator: RuleComparator;
    right: RuleOperand;
  }>
  | Readonly<{
    op: 'metric_state_is';
    metricId: string;
    states: readonly MetricState[];
    periodSelector: PeriodSelector;
  }>
  | Readonly<{
    op: 'quality_is_at_least';
    targetId: string;
    minimumQuality: QualityClassification;
    periodSelector: PeriodSelector;
  }>;

export interface InsightRuleDefinition {
  readonly ruleId: string;
  readonly version: string;
  readonly polarity: RulePolarity;
  readonly inputMetricIds: readonly string[];
  readonly profileAllowlist: readonly string[];
  readonly minimumQuality: 'usable_with_caveats' | 'verified';
  readonly consumers: readonly string[];
  readonly ast: RuleNode;
}

export interface RuleMetricObservation {
  readonly state: MetricState;
  readonly qualityClassification: QualityClassification;
  readonly valueDecimal?: DecimalString;
  readonly evidenceRefs?: readonly string[];
}

export interface RuleMetricSeries {
  readonly current?: RuleMetricObservation;
  readonly prior_year?: RuleMetricObservation;
  readonly previous_quarter?: RuleMetricObservation;
  readonly window?: readonly RuleMetricObservation[];
}

export type RuleMetricContextEntry = RuleMetricObservation | RuleMetricSeries;
export type RuleMetricContext = Readonly<Record<string, RuleMetricContextEntry>>;

export interface InsightRuleEvaluationInput {
  readonly ruleId: string;
  readonly profileId: string;
  readonly metricContext: RuleMetricContext;
}

export class RuleDefinitionError extends TypeError {
  constructor(
    readonly code:
      | 'INVALID_RULE_AST'
      | 'INVALID_RULE_CATALOG'
      | 'UNKNOWN_RULE_ID'
      | 'INVALID_RULE_CONTEXT',
    message: string,
  ) {
    super(message);
    this.name = 'RuleDefinitionError';
  }
}

interface CatalogRuleDocument {
  readonly ruleId: string;
  readonly version: string;
  readonly polarity: RulePolarity;
  readonly inputMetricIds: readonly string[];
  readonly profileAllowlist: readonly string[];
  readonly minimumQuality: 'usable_with_caveats' | 'verified';
  readonly consumers: readonly string[];
  readonly ast: unknown;
}

interface InsightRuleCatalogDocument {
  readonly catalogId: string;
  readonly version: string;
  readonly status: string;
  readonly rules: readonly CatalogRuleDocument[];
}

type NodeOutcome =
  | Readonly<{ state: 'true'; evidenceRefs: readonly string[] }>
  | Readonly<{ state: 'false'; evidenceRefs: readonly string[] }>
  | Readonly<{ state: 'not_evaluable'; evidenceRefs: readonly string[] }>;

const QUALITY_ORDINAL: Readonly<Record<QualityClassification, number>> = Object.freeze({
  insufficient: 0,
  usable_with_caveats: 1,
  verified: 2,
});

const schemaValidator = createProductSchemaValidator();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObservation(value: RuleMetricContextEntry): value is RuleMetricObservation {
  return isRecord(value) && typeof value.state === 'string';
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, 'en')));
}

function mergeEvidence(...groups: (readonly string[])[]): readonly string[] {
  return uniqueSorted(groups.flat());
}

export function validateRuleNode(input: unknown): RuleNode {
  const validation = schemaValidator.validate<RuleNode>(RULE_NODE_SCHEMA, input);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new RuleDefinitionError(
      'INVALID_RULE_AST',
      `Rule AST is outside the closed schema at ${first?.instancePath ?? ''}: ${first?.message ?? 'invalid'}`,
    );
  }
  return validation.value;
}

function collectMetricIds(node: RuleNode, target = new Set<string>()): ReadonlySet<string> {
  switch (node.op) {
    case 'all':
    case 'any':
      for (const child of node.children) collectMetricIds(child, target);
      break;
    case 'count_at_least':
      collectMetricIds(node.child, target);
      break;
    case 'comparison':
      if (node.left.kind === 'metric') target.add(node.left.metricId);
      if (node.right.kind === 'metric') target.add(node.right.metricId);
      break;
    case 'metric_state_is':
      target.add(node.metricId);
      break;
    case 'quality_is_at_least':
      target.add(node.targetId);
      break;
  }
  return target;
}

function parseCatalog(): readonly InsightRuleDefinition[] {
  const catalog = insightRuleCatalogJson as unknown as InsightRuleCatalogDocument;
  if (
    catalog.catalogId !== 'insight-rule-catalog'
    || catalog.status !== 'ACTIVE_AUTHORITY'
    || catalog.rules.length !== REQUIRED_ACTIVE_RULE_COUNT
  ) {
    throw new RuleDefinitionError('INVALID_RULE_CATALOG', 'Active insight rule catalog is inconsistent.');
  }

  const ruleIds = new Set<string>();
  const parsed = catalog.rules.map((rule): InsightRuleDefinition => {
    if (ruleIds.has(rule.ruleId)) {
      throw new RuleDefinitionError('INVALID_RULE_CATALOG', `Duplicate active rule: ${rule.ruleId}`);
    }
    ruleIds.add(rule.ruleId);
    if (
      rule.inputMetricIds.length === 0
      || rule.inputMetricIds.some((metricId) => !metricId.startsWith('FND_'))
      || !rule.consumers.includes('synthesis')
    ) {
      throw new RuleDefinitionError('INVALID_RULE_CATALOG', `Invalid active rule metadata: ${rule.ruleId}`);
    }
    const ast = validateRuleNode(rule.ast);
    const astMetricIds = [...collectMetricIds(ast)].sort();
    const declaredMetricIds = [...new Set(rule.inputMetricIds)].sort();
    if (JSON.stringify(astMetricIds) !== JSON.stringify(declaredMetricIds)) {
      throw new RuleDefinitionError(
        'INVALID_RULE_CATALOG',
        `Rule inputMetricIds do not match the AST: ${rule.ruleId}`,
      );
    }
    return Object.freeze({
      ruleId: rule.ruleId,
      version: rule.version,
      polarity: rule.polarity,
      inputMetricIds: Object.freeze([...rule.inputMetricIds]),
      profileAllowlist: Object.freeze([...rule.profileAllowlist]),
      minimumQuality: rule.minimumQuality,
      consumers: Object.freeze([...rule.consumers]),
      ast,
    });
  });
  return Object.freeze(parsed);
}

export const ACTIVE_INSIGHT_RULES = parseCatalog();
const RULE_BY_ID = new Map(ACTIVE_INSIGHT_RULES.map((rule) => [rule.ruleId, rule] as const));

export function getInsightRuleDefinition(ruleId: string): InsightRuleDefinition {
  const rule = RULE_BY_ID.get(ruleId);
  if (rule === undefined) {
    throw new RuleDefinitionError('UNKNOWN_RULE_ID', `Unknown active insight rule: ${ruleId}`);
  }
  return rule;
}

function resolveObservation(
  metricContext: RuleMetricContext,
  metricId: string,
  periodSelector: PeriodSelector,
  windowIndex?: number,
): RuleMetricObservation | undefined {
  const entry = metricContext[metricId];
  if (entry === undefined) return undefined;
  if (isObservation(entry)) {
    return periodSelector === 'current' ? entry : undefined;
  }
  if (periodSelector === 'window_item') {
    return windowIndex === undefined ? undefined : entry.window?.[windowIndex];
  }
  return entry[periodSelector];
}

function meetsQuality(
  observation: RuleMetricObservation,
  minimum: InsightRuleDefinition['minimumQuality'] | QualityClassification,
): boolean {
  return QUALITY_ORDINAL[observation.qualityClassification] >= QUALITY_ORDINAL[minimum];
}

function usableObservation(
  rule: InsightRuleDefinition,
  metricContext: RuleMetricContext,
  metricId: string,
  periodSelector: PeriodSelector,
  windowIndex?: number,
): RuleMetricObservation | undefined {
  const observation = resolveObservation(metricContext, metricId, periodSelector, windowIndex);
  if (
    observation === undefined
    || observation.state !== 'available'
    || !meetsQuality(observation, rule.minimumQuality)
  ) {
    return undefined;
  }
  return observation;
}

function resolveOperand(
  rule: InsightRuleDefinition,
  operand: RuleOperand,
  metricContext: RuleMetricContext,
  windowIndex?: number,
): Readonly<{ value: ReturnType<typeof parseDecimalString>; evidenceRefs: readonly string[] }> | undefined {
  if (operand.kind === 'decimal') {
    return Object.freeze({ value: parseDecimalString(operand.valueDecimal), evidenceRefs: Object.freeze([]) });
  }
  const observation = usableObservation(
    rule,
    metricContext,
    operand.metricId,
    operand.periodSelector,
    windowIndex,
  );
  if (observation?.valueDecimal === undefined) return undefined;
  return Object.freeze({
    value: parseDecimalString(observation.valueDecimal),
    evidenceRefs: uniqueSorted(observation.evidenceRefs ?? []),
  });
}

function compare(comparator: RuleComparator, comparison: number): boolean {
  switch (comparator) {
    case 'gt': return comparison > 0;
    case 'gte': return comparison >= 0;
    case 'lt': return comparison < 0;
    case 'lte': return comparison <= 0;
    case 'eq': return comparison === 0;
    case 'neq': return comparison !== 0;
  }
}

function booleanOutcome(state: boolean, evidenceRefs: readonly string[]): NodeOutcome {
  return Object.freeze({ state: state ? 'true' : 'false', evidenceRefs: uniqueSorted(evidenceRefs) });
}

function evaluateNode(
  rule: InsightRuleDefinition,
  node: RuleNode,
  metricContext: RuleMetricContext,
  windowIndex?: number,
): NodeOutcome {
  switch (node.op) {
    case 'comparison': {
      const left = resolveOperand(rule, node.left, metricContext, windowIndex);
      const right = resolveOperand(rule, node.right, metricContext, windowIndex);
      if (left === undefined || right === undefined) {
        return Object.freeze({ state: 'not_evaluable', evidenceRefs: Object.freeze([]) });
      }
      return booleanOutcome(
        compare(node.comparator, left.value.comparedTo(right.value)),
        mergeEvidence(left.evidenceRefs, right.evidenceRefs),
      );
    }
    case 'metric_state_is': {
      const observation = resolveObservation(
        metricContext,
        node.metricId,
        node.periodSelector,
        windowIndex,
      );
      if (observation === undefined || !meetsQuality(observation, rule.minimumQuality)) {
        return Object.freeze({ state: 'not_evaluable', evidenceRefs: Object.freeze([]) });
      }
      return booleanOutcome(
        node.states.includes(observation.state),
        observation.evidenceRefs ?? [],
      );
    }
    case 'quality_is_at_least': {
      const observation = resolveObservation(
        metricContext,
        node.targetId,
        node.periodSelector,
        windowIndex,
      );
      if (observation === undefined || observation.state !== 'available') {
        return Object.freeze({ state: 'not_evaluable', evidenceRefs: Object.freeze([]) });
      }
      return booleanOutcome(
        meetsQuality(observation, node.minimumQuality),
        observation.evidenceRefs ?? [],
      );
    }
    case 'all': {
      const results = node.children.map((child) => evaluateNode(rule, child, metricContext, windowIndex));
      const evidenceRefs = mergeEvidence(...results.map((item) => item.evidenceRefs));
      if (results.some((item) => item.state === 'false')) return booleanOutcome(false, evidenceRefs);
      if (results.some((item) => item.state === 'not_evaluable')) {
        return Object.freeze({ state: 'not_evaluable', evidenceRefs });
      }
      return booleanOutcome(true, evidenceRefs);
    }
    case 'any': {
      const results = node.children.map((child) => evaluateNode(rule, child, metricContext, windowIndex));
      const evidenceRefs = mergeEvidence(...results.map((item) => item.evidenceRefs));
      if (results.some((item) => item.state === 'true')) return booleanOutcome(true, evidenceRefs);
      if (results.some((item) => item.state === 'not_evaluable')) {
        return Object.freeze({ state: 'not_evaluable', evidenceRefs });
      }
      return booleanOutcome(false, evidenceRefs);
    }
    case 'count_at_least': {
      if (node.minimum > node.window.count) {
        throw new RuleDefinitionError(
          'INVALID_RULE_AST',
          'count_at_least minimum cannot exceed the declared window count.',
        );
      }
      const results = Array.from({ length: node.window.count }, (_, index) => (
        evaluateNode(rule, node.child, metricContext, index)
      ));
      const evidenceRefs = mergeEvidence(...results.map((item) => item.evidenceRefs));
      const trueCount = results.filter((item) => item.state === 'true').length;
      const unknownCount = results.filter((item) => item.state === 'not_evaluable').length;
      if (trueCount >= node.minimum) return booleanOutcome(true, evidenceRefs);
      if (trueCount + unknownCount < node.minimum) return booleanOutcome(false, evidenceRefs);
      return Object.freeze({ state: 'not_evaluable', evidenceRefs });
    }
  }
}

function evaluation(
  ruleId: string,
  state: RuleState,
  reasonCodes: readonly string[] = [],
  evidenceRefs: readonly string[] = [],
): FundamentalRuleEvaluation {
  return Object.freeze({
    ruleId,
    state,
    ...(reasonCodes.length === 0 ? {} : { reasonCodes: uniqueSorted(reasonCodes) }),
    ...(evidenceRefs.length === 0 ? {} : { evidenceRefs: uniqueSorted(evidenceRefs) }),
  });
}

/** Evaluates one active rule using only the closed catalog AST and categorical metric inputs. */
export function evaluateInsightRule(input: InsightRuleEvaluationInput): FundamentalRuleEvaluation {
  const rule = getInsightRuleDefinition(input.ruleId);
  if (!rule.profileAllowlist.includes(input.profileId)) {
    return evaluation(rule.ruleId, 'not_evaluable', ['profile_not_allowlisted']);
  }

  const outcome = evaluateNode(rule, rule.ast, input.metricContext);
  if (outcome.state === 'not_evaluable') {
    return evaluation(rule.ruleId, 'not_evaluable', [NOT_EVALUABLE_REASON], outcome.evidenceRefs);
  }
  return evaluation(
    rule.ruleId,
    outcome.state === 'true' ? 'triggered' : 'not_triggered',
    [],
    outcome.evidenceRefs,
  );
}

/** Evaluates all nine active rules in catalog order. */
export function evaluateAllInsightRules(
  profileId: string,
  metricContext: RuleMetricContext,
): readonly FundamentalRuleEvaluation[] {
  return Object.freeze(ACTIVE_INSIGHT_RULES.map((rule) => evaluateInsightRule({
    ruleId: rule.ruleId,
    profileId,
    metricContext,
  })));
}
