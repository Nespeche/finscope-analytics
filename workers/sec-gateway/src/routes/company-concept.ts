import type { GatewayRouteDefinition } from '../index';
import { fetchSecPayloadEnvelope } from '../sec-stream';
import { createCompanyConceptSecUrl } from '../security/allowlist';

export const companyConceptRoute = Object.freeze({
  id: 'sec-company-concept',
  operationId: 'getCompanyConcept',
  pathTemplate: '/issuers/{cik}/company-concepts/{taxonomy}/{tag}',
  requestKind: 'company_concept',
  methods: Object.freeze(['GET', 'HEAD'] as const),
  allowedStatuses: Object.freeze([200, 400, 403, 404, 413, 502, 504] as const),
  async handle(_request, environment, guardedRequest) {
    if (guardedRequest.kind !== 'company_concept') throw new Error('COMPANY_CONCEPT_ROUTE_MISMATCH');
    return fetchSecPayloadEnvelope({
      cik: guardedRequest.cik,
      sourceKind: 'company_concept',
      upstreamUrl: createCompanyConceptSecUrl(
        guardedRequest.cik,
        guardedRequest.taxonomy,
        guardedRequest.tag,
      ),
      environment,
    });
  },
} satisfies GatewayRouteDefinition);
