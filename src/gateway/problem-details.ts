import { createProductSchemaValidator } from '../core/schema-validator';
import type {
  BlockedOperation,
  Capability,
} from '../domain/orchestration/capabilities';
import type { PipelineState } from '../domain/orchestration/state-machine';

const PROBLEM_DETAILS_SCHEMA =
  'https://finscope.local/schemas/problem-details.schema.json';

export const GATEWAY_PROBLEM_STATUSES = Object.freeze([400, 403, 404, 413, 502, 504] as const);
export const GATEWAY_PROBLEM_CODES = Object.freeze([
  'invalid_request',
  'blocked_by_policy',
  'payload_too_large',
  'provider_unavailable',
  'invalid_payload',
  'upstream_timeout',
  'resource_not_found',
] as const);

export type GatewayProblemStatus = (typeof GATEWAY_PROBLEM_STATUSES)[number];
export type GatewayProblemCode = (typeof GATEWAY_PROBLEM_CODES)[number];
export type ResourceType = 'issuer' | 'filing' | 'definition' | 'mapping';

interface GatewayProblemBase {
  readonly type: string;
  readonly title: string;
  readonly status: GatewayProblemStatus;
  readonly code: GatewayProblemCode;
  readonly detail: string;
  readonly traceId: string;
  readonly retryability: string;
  readonly operationState: PipelineState;
  readonly recoveryActions: readonly string[];
  readonly preservedCapabilities: readonly Capability[];
  readonly blockedCapabilities: readonly Capability[];
  readonly blockedOperations: readonly BlockedOperation[];
  readonly messageKey: string;
  readonly accessibilityKey: string;
  readonly instance?: string;
}

export interface StandardGatewayProblem extends GatewayProblemBase {
  readonly code:
    | 'invalid_request'
    | 'blocked_by_policy'
    | 'payload_too_large'
    | 'provider_unavailable'
    | 'invalid_payload'
    | 'upstream_timeout';
  readonly resourceType?: never;
  readonly resourceId?: never;
}

export interface ResourceNotFoundProblem extends GatewayProblemBase {
  readonly code: 'resource_not_found';
  readonly status: 404;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
}

export type GatewayProblemDetails = StandardGatewayProblem | ResourceNotFoundProblem;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

const validator = createProductSchemaValidator();

export function parseGatewayProblemDetails(input: unknown): GatewayProblemDetails {
  const result = validator.validate<GatewayProblemDetails>(PROBLEM_DETAILS_SCHEMA, input);
  if (!result.valid) {
    throw new TypeError(`INVALID_GATEWAY_PROBLEM_DETAILS:${JSON.stringify(result.errors)}`);
  }
  return deepFreeze(structuredClone(result.value));
}

export function isGatewayProblemDetails(input: unknown): input is GatewayProblemDetails {
  return validator.validate<GatewayProblemDetails>(PROBLEM_DETAILS_SCHEMA, input).valid;
}

export function serializeGatewayProblemDetails(input: unknown): string {
  return JSON.stringify(parseGatewayProblemDetails(input));
}

export function createGatewayProblemResponse(
  input: unknown,
  init: Omit<ResponseInit, 'status'> = {},
): Response {
  const problem = parseGatewayProblemDetails(input);
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/problem+json');
  return new Response(JSON.stringify(problem), {
    ...init,
    status: problem.status,
    headers,
  });
}
