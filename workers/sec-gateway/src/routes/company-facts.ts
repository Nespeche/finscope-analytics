import type { GatewayRouteDefinition } from '../index';
import { fetchSecPayloadEnvelope } from '../sec-stream';
import { createCompanyFactsSecUrl } from '../security/allowlist';

export const companyFactsRoute = Object.freeze({
  id: 'sec-company-facts',
  operationId: 'getCompanyFacts',
  pathTemplate: '/issuers/{cik}/company-facts',
  requestKind: 'company_facts',
  methods: Object.freeze(['GET', 'HEAD'] as const),
  allowedStatuses: Object.freeze([200, 400, 403, 404, 413, 502, 504] as const),
  async handle(_request, environment, guardedRequest) {
    if (guardedRequest.kind !== 'company_facts') throw new Error('COMPANY_FACTS_ROUTE_MISMATCH');
    return fetchSecPayloadEnvelope({
      cik: guardedRequest.cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(guardedRequest.cik),
      environment,
    });
  },
} satisfies GatewayRouteDefinition);
