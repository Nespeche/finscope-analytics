import { describe, expect, it } from 'vitest';
import localOperationIssueVectors from '../../specs/001-fundamental-analysis-platform/fixtures/problems/local-operation-issue-test-vectors.json';
import problemDetailsVectors from '../../specs/001-fundamental-analysis-platform/fixtures/problems/problem-details-test-vectors.json';
import {
  isLocalOperationIssue,
  parseLocalOperationIssue,
} from '../../src/domain/issues/local-issue';
import {
  createGatewayProblemResponse,
  isGatewayProblemDetails,
  parseGatewayProblemDetails,
  serializeGatewayProblemDetails,
} from '../../src/gateway/problem-details';

describe('gateway Problem Details and local issue boundary', () => {
  it('accepts every authoritative gateway variant and serializes it as RFC problem JSON', async () => {
    expect(problemDetailsVectors.validFixtures).toHaveLength(10);
    for (const fixture of problemDetailsVectors.validFixtures) {
      const parsed = parseGatewayProblemDetails(fixture.input);
      expect(parsed, fixture.fixtureId).toEqual(fixture.input);
      expect(Object.isFrozen(parsed), fixture.fixtureId).toBe(true);
      expect(isGatewayProblemDetails(fixture.input), fixture.fixtureId).toBe(true);
      expect(JSON.parse(serializeGatewayProblemDetails(fixture.input)), fixture.fixtureId)
        .toEqual(fixture.input);

      const response = createGatewayProblemResponse(fixture.input);
      expect(response.status, fixture.fixtureId).toBe(fixture.input.status);
      expect(response.headers.get('content-type'), fixture.fixtureId)
        .toBe('application/problem+json');
      expect(await response.json(), fixture.fixtureId).toEqual(fixture.input);
    }
  });

  it('rejects every authoritative invalid gateway variant', () => {
    expect(problemDetailsVectors.negativeFixtures).toHaveLength(6);
    for (const fixture of problemDetailsVectors.negativeFixtures) {
      expect(isGatewayProblemDetails(fixture.input), fixture.fixtureId).toBe(false);
      expect(() => parseGatewayProblemDetails(fixture.input), fixture.fixtureId)
        .toThrow(/INVALID_GATEWAY_PROBLEM_DETAILS/u);
      expect(() => createGatewayProblemResponse(fixture.input), fixture.fixtureId)
        .toThrow(/INVALID_GATEWAY_PROBLEM_DETAILS/u);
    }
  });

  it('keeps all local operation issues out of HTTP serialization', () => {
    expect(localOperationIssueVectors.fixtures).toHaveLength(5);
    for (const fixture of localOperationIssueVectors.fixtures) {
      const localIssue = parseLocalOperationIssue(fixture.input);
      expect(isLocalOperationIssue(localIssue), fixture.fixtureId).toBe(true);
      expect(isGatewayProblemDetails(localIssue), fixture.fixtureId).toBe(false);
      expect(() => serializeGatewayProblemDetails(localIssue), fixture.fixtureId)
        .toThrow(/INVALID_GATEWAY_PROBLEM_DETAILS/u);
      expect(() => createGatewayProblemResponse(localIssue), fixture.fixtureId)
        .toThrow(/INVALID_GATEWAY_PROBLEM_DETAILS/u);
    }
  });

  it('does not expose superseded HTTP 409 or 422 variants', () => {
    const statuses = problemDetailsVectors.validFixtures.map((fixture) => fixture.input.status);
    expect(statuses).not.toContain(409);
    expect(statuses).not.toContain(422);
  });
});
