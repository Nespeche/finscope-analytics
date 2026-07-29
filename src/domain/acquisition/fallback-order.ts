export interface FallbackMappingCandidate {
  readonly canonicalConceptId: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly status: 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';
  readonly mappingQuality: 'exact' | 'approved_alias';
  readonly precedence: number;
  readonly profileIds: readonly string[];
}

export interface FallbackMetricDefinition {
  readonly metricId: string;
  readonly metricPriority: number;
  readonly inputIds: readonly string[];
  readonly profileAllowlist: readonly string[];
}

export interface OrderedFallback extends FallbackMappingCandidate {
  readonly profileOrder: number;
  readonly metricPriority: number;
  readonly requestKey: string;
}

export interface FallbackOrderInput {
  readonly profileId: string;
  readonly profileConceptAllowlist: readonly string[];
  readonly unresolvedConceptIds: readonly string[];
  readonly mappings: readonly FallbackMappingCandidate[];
  readonly metrics: readonly FallbackMetricDefinition[];
}

function minimumMetricPriority(
  canonicalConceptId: string,
  profileId: string,
  metrics: readonly FallbackMetricDefinition[],
): number {
  let selected = Number.MAX_SAFE_INTEGER;
  for (const metric of metrics) {
    if (
      metric.profileAllowlist.includes(profileId)
      && metric.inputIds.includes(canonicalConceptId)
      && Number.isSafeInteger(metric.metricPriority)
      && metric.metricPriority >= 0
    ) {
      selected = Math.min(selected, metric.metricPriority);
    }
  }
  return selected;
}

export function orderEligibleFallbacks(input: FallbackOrderInput): readonly OrderedFallback[] {
  const unresolved = new Set(input.unresolvedConceptIds);
  const profileOrder = new Map(
    input.profileConceptAllowlist.map((conceptId, index) => [conceptId, index] as const),
  );
  const ordered = input.mappings.flatMap((mapping): OrderedFallback[] => {
    const conceptOrder = profileOrder.get(mapping.canonicalConceptId);
    if (
      conceptOrder === undefined
      || !unresolved.has(mapping.canonicalConceptId)
      || mapping.status !== 'ACTIVE'
      || mapping.mappingQuality !== 'exact'
      || !mapping.profileIds.includes(input.profileId)
      || !Number.isSafeInteger(mapping.precedence)
    ) {
      return [];
    }
    const requestKey = `${mapping.taxonomy}:${mapping.tag}`;
    return [{
      ...mapping,
      profileOrder: conceptOrder,
      metricPriority: minimumMetricPriority(mapping.canonicalConceptId, input.profileId, input.metrics),
      requestKey,
    }];
  });

  ordered.sort((left, right) => left.profileOrder - right.profileOrder
    || left.metricPriority - right.metricPriority
    || left.precedence - right.precedence
    || left.canonicalConceptId.localeCompare(right.canonicalConceptId, 'en')
    || left.requestKey.localeCompare(right.requestKey, 'en'));
  const seenRequests = new Set<string>();
  return Object.freeze(ordered.flatMap((fallback) => {
    if (seenRequests.has(fallback.requestKey)) return [];
    seenRequests.add(fallback.requestKey);
    return [Object.freeze(fallback)];
  }));
}
