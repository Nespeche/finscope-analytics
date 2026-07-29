import type { GatewayRouteDefinition } from '../index';
import { fetchSecPayloadEnvelope } from '../sec-stream';
import { createSubmissionsSecUrl } from '../security/allowlist';

export const submissionsRoute = Object.freeze({
  id: 'sec-submissions',
  operationId: 'getIssuerSubmissions',
  pathTemplate: '/issuers/{cik}/submissions',
  requestKind: 'submissions',
  methods: Object.freeze(['GET', 'HEAD'] as const),
  allowedStatuses: Object.freeze([200, 400, 403, 404, 413, 502, 504] as const),
  async handle(_request, environment, guardedRequest) {
    if (guardedRequest.kind !== 'submissions') throw new Error('SUBMISSIONS_ROUTE_MISMATCH');
    return fetchSecPayloadEnvelope({
      cik: guardedRequest.cik,
      sourceKind: 'submissions',
      upstreamUrl: createSubmissionsSecUrl(guardedRequest.cik),
      environment,
    });
  },
} satisfies GatewayRouteDefinition);
