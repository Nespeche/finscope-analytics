import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import gatewayProblems from '../../../specs/001-fundamental-analysis-platform/definitions/gateway-problem-details-catalog.json';
import { gatewayRouteTable } from '../../../workers/sec-gateway/src/index';

const expectedRoutes = Object.freeze([
  Object.freeze({
    operationId: 'getIssuerSubmissions',
    pathTemplate: '/issuers/{cik}/submissions',
    statuses: Object.freeze([200, 400, 403, 404, 413, 502, 504]),
  }),
  Object.freeze({
    operationId: 'getCompanyFacts',
    pathTemplate: '/issuers/{cik}/company-facts',
    statuses: Object.freeze([200, 400, 403, 404, 413, 502, 504]),
  }),
  Object.freeze({
    operationId: 'getCompanyConcept',
    pathTemplate: '/issuers/{cik}/company-concepts/{taxonomy}/{tag}',
    statuses: Object.freeze([200, 400, 403, 404, 413, 502, 504]),
  }),
]);

describe('closed SEC gateway OpenAPI surface', () => {
  it('registers only the three B06 OpenAPI routes with read-only methods', async () => {
    const openapi = await readFile(
      'specs/001-fundamental-analysis-platform/contracts/openapi.yaml',
      'utf8',
    );

    expect(gatewayRouteTable).toHaveLength(expectedRoutes.length);
    expect(gatewayRouteTable.map((route) => ({
      operationId: route.operationId,
      pathTemplate: route.pathTemplate,
      statuses: [...route.allowedStatuses],
    }))).toEqual(expectedRoutes);

    for (const route of gatewayRouteTable) {
      expect(route.methods).toEqual(['GET', 'HEAD']);
      expect(openapi).toContain(`  ${route.pathTemplate}:`);
      expect(openapi).toContain(`operationId: ${route.operationId}`);
      expect(route.allowedStatuses).not.toContain(409);
      expect(route.allowedStatuses).not.toContain(422);
    }
  });

  it('matches the active operation×status×variant matrix exactly', () => {
    for (const route of gatewayRouteTable) {
      const matrix = gatewayProblems.operationMatrix[route.operationId];
      const matrixStatuses = Object.keys(matrix).map(Number).sort((left, right) => left - right);
      expect([...route.allowedStatuses].filter((status) => status !== 200)).toEqual(matrixStatuses);
      expect(JSON.stringify(matrix)).not.toContain('identity_ambiguous');
      expect(JSON.stringify(matrix)).not.toContain('409');
      expect(JSON.stringify(matrix)).not.toContain('422');
    }
  });
});
