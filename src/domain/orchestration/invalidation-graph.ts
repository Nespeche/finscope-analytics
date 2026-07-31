export type AuthorityInvalidationEvent =
  | 'new_filing_detected'
  | 'mapping_catalog_changed'
  | 'metric_catalog_changed'
  | 'rule_catalog_changed'
  | 'historical_price_imported'
  | 'historical_price_deleted'
  | 'app_opened_or_resumed'
  | 'visual_preference_changed';

export type AcceptanceInvalidationAlias =
  | 'mapping_version_changed'
  | 'metric_definition_changed'
  | 'insight_rule_changed';

export type InvalidationEvent = AuthorityInvalidationEvent | AcceptanceInvalidationAlias;

export type InvalidationStage =
  | 'refresh_check'
  | 'sec_acquisition'
  | 'normalization'
  | 'fundamental_metrics'
  | 'rules'
  | 'synthesis'
  | 'fundamental_persistence'
  | 'price_overlay'
  | 'price_quality'
  | 'price_metrics'
  | 'price_persistence'
  | 'render';

export interface InvalidationDependencies {
  readonly conceptToMetrics?: Readonly<Record<string, readonly string[]>>;
  readonly metricToMetrics?: Readonly<Record<string, readonly string[]>>;
  readonly metricToRules?: Readonly<Record<string, readonly string[]>>;
}

export interface InvalidationPlanInput {
  readonly event: InvalidationEvent;
  readonly refreshConsent?: boolean;
  readonly changedConceptIds?: readonly string[];
  readonly changedMetricIds?: readonly string[];
  readonly changedRuleIds?: readonly string[];
  readonly dependencies?: InvalidationDependencies;
}

export interface InvalidationPlan {
  readonly event: AuthorityInvalidationEvent;
  readonly affectedStages: readonly InvalidationStage[];
  readonly domainWorkStarted: boolean;
  readonly networkWorkStarted: boolean;
  readonly affectedConceptIds: readonly string[];
  readonly affectedMetricIds: readonly string[];
  readonly affectedRuleIds: readonly string[];
}

const stageOrder: readonly InvalidationStage[] = Object.freeze([
  'refresh_check',
  'sec_acquisition',
  'normalization',
  'fundamental_metrics',
  'rules',
  'synthesis',
  'fundamental_persistence',
  'price_overlay',
  'price_quality',
  'price_metrics',
  'price_persistence',
  'render',
]);

const aliases: Readonly<Record<AcceptanceInvalidationAlias, AuthorityInvalidationEvent>> = Object.freeze({
  mapping_version_changed: 'mapping_catalog_changed',
  metric_definition_changed: 'metric_catalog_changed',
  insight_rule_changed: 'rule_catalog_changed',
});

function normalizedEvent(event: InvalidationEvent): AuthorityInvalidationEvent {
  return event in aliases
    ? aliases[event as AcceptanceInvalidationAlias]
    : event as AuthorityInvalidationEvent;
}

function uniqueSorted(values: Iterable<string>): readonly string[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right, 'en')));
}

function nonEmpty(values: readonly string[] | undefined): readonly string[] {
  if (values === undefined) return Object.freeze([]);
  if (values.some((value) => value.length === 0)) throw new TypeError('EMPTY_INVALIDATION_DEPENDENCY_ID');
  return uniqueSorted(values);
}

function transitiveMetrics(
  seeds: readonly string[],
  dependencies: InvalidationDependencies | undefined,
): readonly string[] {
  const selected = new Set(seeds);
  const queue = [...seeds];
  while (queue.length > 0) {
    const metricId = queue.shift();
    if (metricId === undefined) break;
    for (const dependent of dependencies?.metricToMetrics?.[metricId] ?? []) {
      if (dependent.length === 0) throw new TypeError('EMPTY_INVALIDATION_DEPENDENCY_ID');
      if (!selected.has(dependent)) {
        selected.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return uniqueSorted(selected);
}

function dependentRules(
  metricIds: readonly string[],
  dependencies: InvalidationDependencies | undefined,
): readonly string[] {
  const rules = new Set<string>();
  for (const metricId of metricIds) {
    for (const ruleId of dependencies?.metricToRules?.[metricId] ?? []) {
      if (ruleId.length === 0) throw new TypeError('EMPTY_INVALIDATION_DEPENDENCY_ID');
      rules.add(ruleId);
    }
  }
  return uniqueSorted(rules);
}

function orderedStages(values: readonly InvalidationStage[]): readonly InvalidationStage[] {
  const selected = new Set(values);
  return Object.freeze(stageOrder.filter((stage) => selected.has(stage)));
}

function plan(
  event: AuthorityInvalidationEvent,
  stages: readonly InvalidationStage[],
  conceptIds: readonly string[] = Object.freeze([]),
  metricIds: readonly string[] = Object.freeze([]),
  ruleIds: readonly string[] = Object.freeze([]),
): InvalidationPlan {
  const affectedStages = orderedStages(stages);
  return Object.freeze({
    event,
    affectedStages,
    domainWorkStarted: affectedStages.some((stage) => stage !== 'render' && stage !== 'refresh_check'),
    networkWorkStarted: affectedStages.includes('sec_acquisition'),
    affectedConceptIds: conceptIds,
    affectedMetricIds: metricIds,
    affectedRuleIds: ruleIds,
  });
}

/** Builds the minimum dependency-directed work plan for one authoritative event. */
export function buildInvalidationPlan(input: InvalidationPlanInput): InvalidationPlan {
  const event = normalizedEvent(input.event);
  const concepts = nonEmpty(input.changedConceptIds);
  const explicitMetrics = nonEmpty(input.changedMetricIds);
  const explicitRules = nonEmpty(input.changedRuleIds);

  switch (event) {
    case 'new_filing_detected':
      return plan(event, [
        'sec_acquisition',
        'normalization',
        'fundamental_metrics',
        'rules',
        'synthesis',
        'fundamental_persistence',
      ]);
    case 'mapping_catalog_changed': {
      const directMetrics = concepts.flatMap((conceptId) => input.dependencies?.conceptToMetrics?.[conceptId] ?? []);
      const metrics = transitiveMetrics([...explicitMetrics, ...directMetrics], input.dependencies);
      const rules = uniqueSorted([...explicitRules, ...dependentRules(metrics, input.dependencies)]);
      return plan(event, [
        'normalization',
        'fundamental_metrics',
        'rules',
        'synthesis',
        'fundamental_persistence',
      ], concepts, metrics, rules);
    }
    case 'metric_catalog_changed': {
      const metrics = transitiveMetrics(explicitMetrics, input.dependencies);
      const rules = uniqueSorted([...explicitRules, ...dependentRules(metrics, input.dependencies)]);
      return plan(event, [
        'fundamental_metrics',
        'rules',
        'synthesis',
        'fundamental_persistence',
      ], Object.freeze([]), metrics, rules);
    }
    case 'rule_catalog_changed':
      return plan(event, ['rules', 'synthesis', 'fundamental_persistence'], Object.freeze([]), Object.freeze([]), explicitRules);
    case 'historical_price_imported':
      return plan(event, ['price_overlay', 'price_quality', 'price_metrics', 'price_persistence']);
    case 'historical_price_deleted':
      return plan(event, ['price_overlay', 'price_quality', 'price_metrics', 'price_persistence']);
    case 'app_opened_or_resumed':
      return input.refreshConsent === true
        ? plan(event, ['refresh_check'])
        : plan(event, []);
    case 'visual_preference_changed':
      return plan(event, ['render']);
  }
}
