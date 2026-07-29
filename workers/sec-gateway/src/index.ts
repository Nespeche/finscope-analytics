import { companyConceptRoute } from './routes/company-concept';
import { companyFactsRoute } from './routes/company-facts';
import { submissionsRoute } from './routes/submissions';
import {
  guardGatewayRequest,
  type GuardedGatewayRequest,
  type SecGatewayRequestKind,
} from './security/request-guard';

export interface D1CatalogDatabase {
  prepare(query: string): unknown;
}

export interface SecGatewayEnvironment {
  readonly CATALOG_DB: D1CatalogDatabase;
  readonly SEC_USER_AGENT: string;
  readonly SEC_CONTACT_EMAIL: string;
}

export type ReadOnlyMethod = 'GET' | 'HEAD';

export interface GatewayRouteDefinition {
  readonly id: string;
  readonly operationId: 'getIssuerSubmissions' | 'getCompanyFacts' | 'getCompanyConcept';
  readonly pathTemplate:
    | '/issuers/{cik}/submissions'
    | '/issuers/{cik}/company-facts'
    | '/issuers/{cik}/company-concepts/{taxonomy}/{tag}';
  readonly requestKind: SecGatewayRequestKind;
  readonly methods: readonly ReadOnlyMethod[];
  readonly allowedStatuses: readonly (200 | 400 | 403 | 404 | 413 | 502 | 504)[];
  readonly handle: (
    request: Request,
    environment: SecGatewayEnvironment,
    guardedRequest: GuardedGatewayRequest,
  ) => Promise<Response>;
}

export const gatewayRouteTable: readonly GatewayRouteDefinition[] = Object.freeze([
  submissionsRoute,
  companyFactsRoute,
  companyConceptRoute,
]);

function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
}

function routeNotFound(request: Request): Response {
  return new Response(request.method === 'HEAD' ? null : 'Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function withoutBody(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export default {
  async fetch(request: Request, environment: SecGatewayEnvironment): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return methodNotAllowed();
    }

    const guard = guardGatewayRequest(request);
    if (guard.status === 'rejected') return request.method === 'HEAD' ? withoutBody(guard.response) : guard.response;
    if (guard.status === 'not_found') return routeNotFound(request);

    const route = gatewayRouteTable.find((candidate) => (
      candidate.requestKind === guard.value.kind
      && candidate.methods.includes(request.method as ReadOnlyMethod)
    ));
    if (route === undefined) return routeNotFound(request);

    const response = await route.handle(request, environment, guard.value);
    return request.method === 'HEAD' ? withoutBody(response) : response;
  },
};
