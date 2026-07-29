import {
  parseCik,
  type Cik,
} from '../../../../src/domain/identity/cik';
import {
  isAllowedTaxonomy,
  parseSecTag,
  type AllowedTaxonomy,
} from './allowlist';

export type SecGatewayRequestKind = 'submissions' | 'company_facts' | 'company_concept';

interface GuardedRequestBase {
  readonly cik: Cik;
  readonly pathname: string;
}

export interface GuardedSubmissionsRequest extends GuardedRequestBase {
  readonly kind: 'submissions';
}

export interface GuardedCompanyFactsRequest extends GuardedRequestBase {
  readonly kind: 'company_facts';
}

export interface GuardedCompanyConceptRequest extends GuardedRequestBase {
  readonly kind: 'company_concept';
  readonly taxonomy: AllowedTaxonomy;
  readonly tag: string;
}

export type GuardedGatewayRequest =
  | GuardedSubmissionsRequest
  | GuardedCompanyFactsRequest
  | GuardedCompanyConceptRequest;

export type GatewayRequestGuardResult =
  | Readonly<{ readonly status: 'allowed'; readonly value: GuardedGatewayRequest }>
  | Readonly<{ readonly status: 'rejected'; readonly response: Response }>
  | Readonly<{ readonly status: 'not_found' }>;

export type GatewayProblemCode =
  | 'invalid_request'
  | 'blocked_by_policy'
  | 'payload_too_large'
  | 'provider_unavailable'
  | 'invalid_payload'
  | 'upstream_timeout'
  | 'resource_not_found';

interface GatewayProblemOptions {
  readonly detail: string;
  readonly resourceId?: string;
  readonly resourceType?: 'issuer';
  readonly traceId?: string;
}

const problemDefinitions = Object.freeze({
  invalid_request: Object.freeze({
    status: 400,
    title: 'InvalidRequestProblem',
    type: 'https://finscope.local/problems/invalid_request',
    operationState: 'failed',
    retryability: 'after_input_change',
    recoveryActions: Object.freeze(['correct_input']),
    preservedCapabilities: Object.freeze(['definitions']),
    blockedCapabilities: Object.freeze([]),
    blockedOperations: Object.freeze(['requested_operation']),
  }),
  blocked_by_policy: Object.freeze({
    status: 403,
    title: 'BlockedByPolicyProblem',
    type: 'https://finscope.local/problems/blocked_by_policy',
    operationState: 'failed',
    retryability: 'after_policy_change',
    recoveryActions: Object.freeze(['review_policy']),
    preservedCapabilities: Object.freeze(['issuer_identity', 'definitions', 'mappings', 'evidence']),
    blockedCapabilities: Object.freeze([]),
    blockedOperations: Object.freeze(['requested_operation']),
  }),
  payload_too_large: Object.freeze({
    status: 413,
    title: 'PayloadTooLargeProblem',
    type: 'https://finscope.local/problems/payload_too_large',
    operationState: 'failed',
    retryability: 'after_request_change',
    recoveryActions: Object.freeze(['narrow_request', 'retry']),
    preservedCapabilities: Object.freeze(['issuer_identity', 'local_snapshot', 'definitions', 'mappings', 'evidence']),
    blockedCapabilities: Object.freeze(['filings', 'fundamentals', 'insights']),
    blockedOperations: Object.freeze(['acquisition']),
  }),
  provider_unavailable: Object.freeze({
    status: 502,
    title: 'ProviderUnavailableProblem',
    type: 'https://finscope.local/problems/provider_unavailable',
    operationState: 'partial',
    retryability: 'backoff',
    recoveryActions: Object.freeze(['retry', 'use_cached_sec_payload', 'use_last_snapshot']),
    preservedCapabilities: Object.freeze(['issuer_identity', 'local_snapshot', 'definitions', 'mappings', 'evidence']),
    blockedCapabilities: Object.freeze(['filings', 'fundamentals', 'insights']),
    blockedOperations: Object.freeze(['acquisition']),
  }),
  invalid_payload: Object.freeze({
    status: 502,
    title: 'InvalidPayloadProblem',
    type: 'https://finscope.local/problems/invalid_payload',
    operationState: 'partial',
    retryability: 'after_source_change',
    recoveryActions: Object.freeze(['retry', 'use_cached_sec_payload', 'use_last_snapshot']),
    preservedCapabilities: Object.freeze(['issuer_identity', 'local_snapshot', 'definitions', 'mappings', 'evidence']),
    blockedCapabilities: Object.freeze(['fundamentals', 'insights']),
    blockedOperations: Object.freeze(['normalization']),
  }),
  upstream_timeout: Object.freeze({
    status: 504,
    title: 'UpstreamTimeoutProblem',
    type: 'https://finscope.local/problems/upstream_timeout',
    operationState: 'partial',
    retryability: 'backoff',
    recoveryActions: Object.freeze(['retry', 'use_cached_sec_payload', 'use_last_snapshot']),
    preservedCapabilities: Object.freeze(['issuer_identity', 'local_snapshot', 'definitions', 'mappings', 'evidence']),
    blockedCapabilities: Object.freeze(['filings', 'fundamentals', 'insights']),
    blockedOperations: Object.freeze(['acquisition']),
  }),
  resource_not_found: Object.freeze({
    status: 404,
    title: 'IssuerNotFoundProblem',
    type: 'https://finscope.local/problems/resource_not_found-issuer',
    operationState: 'failed',
    retryability: 'after_input_change',
    recoveryActions: Object.freeze(['choose_existing_resource']),
    preservedCapabilities: Object.freeze(['definitions', 'evidence']),
    blockedCapabilities: Object.freeze([]),
    blockedOperations: Object.freeze(['requested_resource']),
  }),
} as const);

function createTraceId(): string {
  return `op-${globalThis.crypto.randomUUID()}`;
}

export function createGatewayProblemResponse(
  code: GatewayProblemCode,
  options: GatewayProblemOptions,
): Response {
  const definition = problemDefinitions[code];
  const problem: Record<string, unknown> = {
    type: definition.type,
    title: definition.title,
    status: definition.status,
    code,
    detail: options.detail,
    traceId: options.traceId ?? createTraceId(),
    retryability: definition.retryability,
    operationState: definition.operationState,
    recoveryActions: definition.recoveryActions,
    preservedCapabilities: definition.preservedCapabilities,
    blockedCapabilities: definition.blockedCapabilities,
    blockedOperations: definition.blockedOperations,
    messageKey: `error.${code}`,
    accessibilityKey: `a11y.error.${code}`,
  };
  if (code === 'resource_not_found') {
    problem.resourceType = options.resourceType ?? 'issuer';
    problem.resourceId = options.resourceId ?? 'unknown';
  }
  return new Response(JSON.stringify(problem), {
    status: definition.status,
    headers: {
      'content-type': 'application/problem+json',
      'cache-control': 'no-store',
    },
  });
}

function decodePathSegments(pathname: string): readonly string[] | undefined {
  try {
    const decoded = pathname.split('/').slice(1).map((segment) => decodeURIComponent(segment));
    if (decoded.some((segment) => (
      segment.includes('/')
      || segment.includes('\\')
      || segment === '.'
      || segment === '..'
    ))) {
      return undefined;
    }
    return decoded;
  } catch {
    return undefined;
  }
}

function invalidRequest(detail: string): GatewayRequestGuardResult {
  return Object.freeze({
    status: 'rejected',
    response: createGatewayProblemResponse('invalid_request', { detail }),
  });
}

export function guardGatewayRequest(request: Request): GatewayRequestGuardResult {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Object.freeze({
      status: 'rejected',
      response: new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } }),
    });
  }

  const url = new URL(request.url);
  if (url.search.length > 0) {
    return invalidRequest('SEC gateway routes do not accept query parameters.');
  }

  const segments = decodePathSegments(url.pathname);
  if (segments === undefined) {
    return invalidRequest('The request path is not valid UTF-8 or contains a forbidden segment.');
  }

  const [issuers, cikText, resource, taxonomyText, tagText, extra] = segments;
  if (issuers !== 'issuers') {
    return Object.freeze({ status: 'not_found' });
  }
  if (extra !== undefined || cikText === undefined || resource === undefined) {
    return Object.freeze({ status: 'not_found' });
  }

  let cik: Cik;
  try {
    cik = parseCik(cikText);
  } catch {
    if (resource === 'submissions' || resource === 'company-facts' || resource === 'company-concepts') {
      return invalidRequest('CIK must contain exactly 10 digits.');
    }
    return Object.freeze({ status: 'not_found' });
  }

  if (resource === 'submissions' && taxonomyText === undefined && tagText === undefined) {
    return Object.freeze({ status: 'allowed', value: Object.freeze({ kind: 'submissions', cik, pathname: url.pathname }) });
  }
  if (resource === 'company-facts' && taxonomyText === undefined && tagText === undefined) {
    return Object.freeze({ status: 'allowed', value: Object.freeze({ kind: 'company_facts', cik, pathname: url.pathname }) });
  }
  if (resource === 'company-concepts') {
    if (!isAllowedTaxonomy(taxonomyText)) {
      return invalidRequest('Taxonomy is not allowlisted.');
    }
    let tag: string;
    try {
      tag = parseSecTag(tagText);
    } catch {
      return invalidRequest('Company Concept tag is invalid.');
    }
    return Object.freeze({
      status: 'allowed',
      value: Object.freeze({ kind: 'company_concept', cik, taxonomy: taxonomyText, tag, pathname: url.pathname }),
    });
  }

  return Object.freeze({ status: 'not_found' });
}
