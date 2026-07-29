import profileCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json';
import mappingCatalogJson from '../../../specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json';

export type MappingQuality = 'exact' | 'approved_alias';
export type MappingStatus = 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';

export interface XbrlMappingDefinition {
  readonly canonicalConceptId: string;
  readonly inferenceAllowed: false;
  readonly mappingId: string;
  readonly mappingQuality: MappingQuality;
  readonly mappingVersion: string;
  readonly periodKind: 'instant' | 'duration';
  readonly precedence: number;
  readonly profileIds: readonly string[];
  readonly scopePolicy: string;
  readonly signPolicy: string;
  readonly status: MappingStatus;
  readonly tag: string;
  readonly taxonomy: string;
  readonly unitKind: string;
}

export interface AvailableXbrlFact {
  readonly factId: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly valueToken?: string;
  readonly periodKey?: string;
  readonly scopeId?: string;
  readonly unit?: string;
}

export interface MappingResolutionInput {
  readonly profileId: string;
  readonly canonicalConceptId: string;
  readonly availableFacts: readonly AvailableXbrlFact[];
  readonly mappings?: readonly XbrlMappingDefinition[];
}

export type MappingResolution =
  | Readonly<{
      state: 'resolved';
      mapping: XbrlMappingDefinition;
      factIds: readonly string[];
      mappingQuality: MappingQuality;
    }>
  | Readonly<{
      state: 'ambiguous';
      reasonCode: 'conflicting_equal_precedence';
      mapping: XbrlMappingDefinition;
      factIds: readonly string[];
      mappingQuality: 'ambiguous';
    }>
  | Readonly<{
      state: 'absent';
      reasonCode: 'no_active_exact_tag_match';
      fallbackEligible: false;
    }>
  | Readonly<{
      state: 'not_applicable';
      reasonCode: 'unsupported_profile' | 'concept_not_allowlisted';
      fallbackEligible: false;
    }>;

const mappingCatalog = mappingCatalogJson as unknown as {
  readonly mappings: readonly XbrlMappingDefinition[];
};
const profileCatalog = profileCatalogJson as unknown as {
  readonly profiles: readonly {
    readonly profileId: string;
    readonly conceptAllowlist: readonly string[];
  }[];
};

export const ACTIVE_XBRL_MAPPINGS = Object.freeze([...mappingCatalog.mappings]);

function compareMappings(left: XbrlMappingDefinition, right: XbrlMappingDefinition): number {
  return left.precedence - right.precedence
    || left.mappingId.localeCompare(right.mappingId, 'en');
}

function sameConflictGroup(left: AvailableXbrlFact, right: AvailableXbrlFact): boolean {
  return left.periodKey === right.periodKey
    && left.scopeId === right.scopeId
    && left.unit === right.unit;
}

function hasConflictingValues(facts: readonly AvailableXbrlFact[]): boolean {
  for (let index = 0; index < facts.length; index += 1) {
    const reference = facts[index];
    if (reference === undefined || reference.valueToken === undefined) continue;
    const group = facts.filter((candidate) => sameConflictGroup(reference, candidate));
    const values = new Set(group.flatMap((candidate) =>
      candidate.valueToken === undefined ? [] : [candidate.valueToken]));
    if (values.size > 1) return true;
  }
  return false;
}

function profileConceptState(
  profileId: string,
  canonicalConceptId: string,
  mappings: readonly XbrlMappingDefinition[],
): 'allowed' | 'unsupported_profile' | 'concept_not_allowlisted' | 'derived_or_unmapped' {
  const profile = profileCatalog.profiles.find((candidate) => candidate.profileId === profileId);
  if (profile === undefined || profile.profileId === 'unsupported_profile') return 'unsupported_profile';
  if (profile.conceptAllowlist.includes(canonicalConceptId)) return 'allowed';
  const hasCatalogMapping = mappings.some((mapping) => mapping.canonicalConceptId === canonicalConceptId);
  return hasCatalogMapping ? 'concept_not_allowlisted' : 'derived_or_unmapped';
}

/**
 * Resolves only exact taxonomy+tag catalog entries. It never performs fuzzy,
 * taxonomy-wide, label, suffix, extension, or source-order inference.
 */
export function resolveXbrlMapping(input: MappingResolutionInput): MappingResolution {
  const mappings = input.mappings ?? ACTIVE_XBRL_MAPPINGS;
  const profileState = profileConceptState(input.profileId, input.canonicalConceptId, mappings);
  if (profileState === 'unsupported_profile' || profileState === 'concept_not_allowlisted') {
    return Object.freeze({
      state: 'not_applicable' as const,
      reasonCode: profileState,
      fallbackEligible: false as const,
    });
  }

  const observedKeys = new Set(input.availableFacts.map((fact) => `${fact.taxonomy}\u0000${fact.tag}`));
  const eligible = mappings.filter((mapping) =>
    mapping.canonicalConceptId === input.canonicalConceptId
    && mapping.status === 'ACTIVE'
    && mapping.inferenceAllowed === false
    && mapping.profileIds.includes(input.profileId)
    && observedKeys.has(`${mapping.taxonomy}\u0000${mapping.tag}`),
  ).sort(compareMappings);

  const selected = eligible[0];
  if (selected === undefined) {
    return Object.freeze({
      state: 'absent' as const,
      reasonCode: 'no_active_exact_tag_match' as const,
      fallbackEligible: false as const,
    });
  }

  const matchingFacts = input.availableFacts
    .filter((fact) => fact.taxonomy === selected.taxonomy && fact.tag === selected.tag)
    .sort((left, right) => left.factId.localeCompare(right.factId, 'en'));
  const factIds = Object.freeze(matchingFacts.map((fact) => fact.factId));

  if (hasConflictingValues(matchingFacts)) {
    return Object.freeze({
      state: 'ambiguous' as const,
      reasonCode: 'conflicting_equal_precedence' as const,
      mapping: Object.freeze({ ...selected }),
      factIds,
      mappingQuality: 'ambiguous' as const,
    });
  }

  return Object.freeze({
    state: 'resolved' as const,
    mapping: Object.freeze({ ...selected }),
    factIds,
    mappingQuality: selected.mappingQuality,
  });
}
