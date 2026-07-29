import { describe, expect, it } from 'vitest';
import localIssueVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/problems/local-operation-issue-test-vectors.json';
import problemVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/problems/problem-details-test-vectors.json';
import transitionCartesian from '../../../specs/001-fundamental-analysis-platform/fixtures/states/pipeline-transition-cartesian.json';
import {
  assertCapabilityDisposition,
  type CapabilityDisposition,
} from '../../../src/domain/orchestration/capabilities';
import {
  assertTransitionAllowed,
  AUTHORIZED_TRANSITIONS,
  getTransitionPair,
  isTransitionAllowed,
  PIPELINE_STATES,
  TRANSITION_PAIR_COUNT,
  TRANSITION_PAIRS,
  type PipelineState,
} from '../../../src/domain/orchestration/state-machine';

describe('authoritative pipeline transition matrix', () => {
  it('matches all 81 allowed and prohibited state pairs exactly', () => {
    expect(PIPELINE_STATES).toHaveLength(transitionCartesian.stateCount);
    expect(TRANSITION_PAIR_COUNT).toBe(transitionCartesian.expectedCombinationCount);
    expect(TRANSITION_PAIRS).toHaveLength(81);
    expect(transitionCartesian.fixtures).toHaveLength(81);

    for (const fixture of transitionCartesian.fixtures) {
      const pair = getTransitionPair(
        fixture.from as PipelineState,
        fixture.to as PipelineState,
      );
      expect(pair.permitted, fixture.fixtureId).toBe(fixture.permitted);
      expect(pair.events, fixture.fixtureId).toEqual(fixture.events);
      expect(pair.operationIds, fixture.fixtureId).toEqual(fixture.operationIds);
    }
  });

  it('permits exactly the listed from/event/to tuples and fails closed otherwise', () => {
    for (const transition of AUTHORIZED_TRANSITIONS) {
      expect(
        isTransitionAllowed(transition.from, transition.event, transition.to),
        `${transition.from}/${transition.event}/${transition.to}`,
      ).toBe(true);
      expect(() => assertTransitionAllowed(transition.from, transition.event, transition.to))
        .not.toThrow();
    }

    expect(isTransitionAllowed('idle', 'unlisted_event', 'idle')).toBe(false);
    expect(() => assertTransitionAllowed('idle', 'unlisted_event', 'idle'))
      .toThrow('PROHIBITED_PIPELINE_TRANSITION:idle:unlisted_event:idle');
    expect(isTransitionAllowed('idle', 'issuer_selected', 'ready')).toBe(false);
  });

  it('keeps preserved and blocked capabilities disjoint for every problem and local issue', () => {
    const dispositions: readonly CapabilityDisposition[] = [
      ...localIssueVectors.fixtures.map((fixture) => ({
        preservedCapabilities: fixture.input.preservedCapabilities,
        blockedOperations: fixture.input.blockedOperations,
      } as CapabilityDisposition)),
      ...problemVectors.validFixtures.map((fixture) => ({
        preservedCapabilities: fixture.input.preservedCapabilities,
        blockedCapabilities: fixture.input.blockedCapabilities,
        blockedOperations: fixture.input.blockedOperations,
      } as CapabilityDisposition)),
    ];

    for (const disposition of dispositions) {
      expect(() => assertCapabilityDisposition(disposition)).not.toThrow();
      const overlap = disposition.preservedCapabilities.filter((capability) => (
        disposition.blockedCapabilities?.includes(capability) ?? false
      ));
      expect(overlap).toEqual([]);
    }
  });
});
