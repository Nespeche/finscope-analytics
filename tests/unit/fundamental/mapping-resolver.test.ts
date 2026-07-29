import { describe, expect, it } from 'vitest';
import mappingVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/mappings/xbrl-mapping-resolution-vectors.json';
import {
  resolveXbrlMapping,
  type AvailableXbrlFact,
  type XbrlMappingDefinition,
} from '../../../src/domain/fundamental/mapping-resolver';

function available(tags: readonly string[]): readonly AvailableXbrlFact[] {
  return tags.map((tag, index) => ({
    factId: `fact-${index + 1}`,
    taxonomy: tag === 'Revenue' ? 'ifrs-full' : 'us-gaap',
    tag,
  }));
}

describe('exact XBRL mapping resolution', () => {
  it('matches every frozen mapping vector without fuzzy or taxonomy-wide inference', () => {
    const results = Object.fromEntries(mappingVectors.fixtures.map((fixture) => [
      fixture.fixtureId,
      resolveXbrlMapping({
        profileId: fixture.profileId,
        canonicalConceptId: fixture.canonicalConceptId,
        availableFacts: available(fixture.availableTags),
      }),
    ]));

    expect(results['MAP-EXACT-PRECEDENCE']).toMatchObject({
      state: 'resolved',
      mapping: { mappingId: 'map-usgaap-revenue-primary', precedence: 10 },
    });
    expect(results['MAP-NO-INFERENCE']).toEqual({
      state: 'absent',
      reasonCode: 'no_active_exact_tag_match',
      fallbackEligible: false,
    });
    expect(results['MAP-DEBT-NO-GENERIC-TOTAL']).toEqual({
      state: 'absent',
      reasonCode: 'no_active_exact_tag_match',
      fallbackEligible: false,
    });
    expect(results['MAP-UNSUPPORTED-PROFILE']).toEqual({
      state: 'not_applicable',
      reasonCode: 'unsupported_profile',
      fallbackEligible: false,
    });
  });

  it('uses precedence then mappingId, never source order, for approved aliases', () => {
    const mappings: readonly XbrlMappingDefinition[] = [
      {
        canonicalConceptId: 'revenue', inferenceAllowed: false,
        mappingId: 'alias-z', mappingQuality: 'approved_alias', mappingVersion: '5.0.0',
        periodKind: 'duration', precedence: 30, profileIds: ['general_operating_us_gaap'],
        scopePolicy: 'consolidated_only', signPolicy: 'as_reported', status: 'ACTIVE',
        tag: 'RevenueAliasZ', taxonomy: 'us-gaap', unitKind: 'currency',
      },
      {
        canonicalConceptId: 'revenue', inferenceAllowed: false,
        mappingId: 'alias-a', mappingQuality: 'approved_alias', mappingVersion: '5.0.0',
        periodKind: 'duration', precedence: 20, profileIds: ['general_operating_us_gaap'],
        scopePolicy: 'consolidated_only', signPolicy: 'as_reported', status: 'ACTIVE',
        tag: 'RevenueAliasA', taxonomy: 'us-gaap', unitKind: 'currency',
      },
    ];
    const result = resolveXbrlMapping({
      profileId: 'general_operating_us_gaap',
      canonicalConceptId: 'revenue',
      availableFacts: [...available(['RevenueAliasZ', 'RevenueAliasA'])].reverse(),
      mappings,
    });
    expect(result).toMatchObject({ state: 'resolved', mapping: { mappingId: 'alias-a' } });
  });

  it('fails closed when equal mapping candidates conflict for the same period/scope/unit', () => {
    const result = resolveXbrlMapping({
      profileId: 'general_operating_us_gaap',
      canonicalConceptId: 'revenue',
      availableFacts: [
        {
          factId: 'A', taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax',
          valueToken: '10', periodKey: 'FY2025', scopeId: 'consolidated', unit: 'USD',
        },
        {
          factId: 'B', taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax',
          valueToken: '11', periodKey: 'FY2025', scopeId: 'consolidated', unit: 'USD',
        },
      ],
    });
    expect(result).toMatchObject({
      state: 'ambiguous',
      reasonCode: 'conflicting_equal_precedence',
      mappingQuality: 'ambiguous',
      factIds: ['A', 'B'],
    });
  });
});
