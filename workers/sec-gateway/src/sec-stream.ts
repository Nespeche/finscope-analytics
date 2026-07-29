import { sha256Hex } from '../../../src/core/sha256';
import type { TelemetrySink } from '../../../src/core/telemetry';
import type { Cik } from '../../../src/domain/identity/cik';
import type { SecGatewayEnvironment } from './index';
import { createRedactedTelemetrySink, createWorkerObservability } from './observability';
import { assertAllowedSecUrl } from './security/allowlist';
import {
  createGatewayProblemResponse,
  type GatewayProblemCode,
} from './security/request-guard';

export const SEC_MAX_EXTERNAL_CALLS = 14 as const;
export const SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST = 3 as const;
export const SEC_REQUEST_TIMEOUT_MS = 20_000 as const;
export const SEC_OPERATION_TIMEOUT_MS = 120_000 as const;
export const SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES = 67_108_864 as const;
export const SEC_BACKOFF_MS = Object.freeze([1_000, 2_000, 4_000] as const);
const MAX_REDIRECTS = 5;
const SEC_CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type SecSourceKind = 'submissions' | 'company_facts' | 'company_concept';

export class SecOperationBudget {
  readonly maximumExternalCalls: number;
  #externalCallCount = 0;

  constructor(maximumExternalCalls: number = SEC_MAX_EXTERNAL_CALLS) {
    if (!Number.isSafeInteger(maximumExternalCalls) || maximumExternalCalls < 1 || maximumExternalCalls > SEC_MAX_EXTERNAL_CALLS) {
      throw new TypeError('INVALID_SEC_OPERATION_BUDGET');
    }
    this.maximumExternalCalls = maximumExternalCalls;
  }

  get externalCallCount(): number {
    return this.#externalCallCount;
  }

  get remaining(): number {
    return this.maximumExternalCalls - this.#externalCallCount;
  }

  consume(): number {
    if (this.#externalCallCount >= this.maximumExternalCalls) {
      throw new SecTransportFailure('provider_unavailable', 'SEC operation budget exhausted before another call.');
    }
    this.#externalCallCount += 1;
    return this.#externalCallCount;
  }
}

class SecTransportFailure extends Error {
  readonly code: GatewayProblemCode;
  readonly resourceId?: string;

  constructor(code: GatewayProblemCode, message: string, resourceId?: string) {
    super(message);
    this.name = 'SecTransportFailure';
    this.code = code;
    if (resourceId !== undefined) this.resourceId = resourceId;
  }
}

export interface SecStreamOptions {
  readonly cik: Cik;
  readonly sourceKind: SecSourceKind;
  readonly upstreamUrl: URL;
  readonly environment: SecGatewayEnvironment;
  readonly budget?: SecOperationBudget;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
  readonly operationStartedAt?: number;
  readonly telemetrySink?: TelemetrySink;
}

interface FetchDependencies {
  readonly fetchImpl: typeof fetch;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly now: () => number;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertDeploymentBindings(environment: SecGatewayEnvironment): void {
  const userAgent = environment.SEC_USER_AGENT;
  const contactEmail = environment.SEC_CONTACT_EMAIL;
  if (
    typeof userAgent !== 'string'
    || userAgent.trim().length === 0
    || /[\r\n]/u.test(userAgent)
    || typeof contactEmail !== 'string'
    || !SEC_CONTACT_EMAIL_PATTERN.test(contactEmail.trim())
    || /[\r\n]/u.test(contactEmail)
  ) {
    throw new SecTransportFailure(
      'blocked_by_policy',
      'SEC fair-access deployment variables are missing or invalid.',
    );
  }
}

function retryAfterMilliseconds(response: Response, now: number): number | undefined {
  const raw = response.headers.get('retry-after');
  if (raw === null) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 30_000);
  }
  const date = Date.parse(raw);
  if (!Number.isFinite(date)) return undefined;
  return Math.min(Math.max(0, date - now), 30_000);
}

function assertOperationWithinDeadline(startedAt: number, now: number): void {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now) || now - startedAt > SEC_OPERATION_TIMEOUT_MS) {
    throw new SecTransportFailure('upstream_timeout', 'SEC operation exceeded 120 seconds.');
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

interface TimedSecResponse {
  readonly response: Response;
  readonly dispose: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchWithTimeout(
  url: URL,
  environment: SecGatewayEnvironment,
  fetchImpl: typeof fetch,
  timeoutMilliseconds: number,
): Promise<TimedSecResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
  };
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': `${environment.SEC_USER_AGENT.trim()} ${environment.SEC_CONTACT_EMAIL.trim()}`,
      },
    });
    return Object.freeze({ response, dispose });
  } catch (error: unknown) {
    dispose();
    if (isAbortError(error)) {
      throw new SecTransportFailure('upstream_timeout', 'SEC request or operation timeout was exceeded.');
    }
    throw new SecTransportFailure('provider_unavailable', 'SEC provider request failed.');
  }
}

async function fetchFollowingAllowlistedRedirects(
  initialUrl: URL,
  environment: SecGatewayEnvironment,
  budget: SecOperationBudget,
  dependencies: FetchDependencies,
  operationStartedAt: number,
): Promise<TimedSecResponse> {
  let currentUrl: URL;
  try {
    currentUrl = assertAllowedSecUrl(new URL(initialUrl.href));
  } catch {
    throw new SecTransportFailure('blocked_by_policy', 'SEC URL is not allowlisted.');
  }
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const now = dependencies.now();
    assertOperationWithinDeadline(operationStartedAt, now);
    const remainingOperationMilliseconds = Math.max(1, SEC_OPERATION_TIMEOUT_MS - (now - operationStartedAt));
    budget.consume();
    const timedResponse = await fetchWithTimeout(
      currentUrl,
      environment,
      dependencies.fetchImpl,
      Math.min(SEC_REQUEST_TIMEOUT_MS, remainingOperationMilliseconds),
    );
    let keepForCaller = false;
    try {
      assertOperationWithinDeadline(operationStartedAt, dependencies.now());
      if (!isRedirect(timedResponse.response.status)) {
        keepForCaller = true;
        return timedResponse;
      }

      const location = timedResponse.response.headers.get('location');
      if (location === null || redirectCount === MAX_REDIRECTS) {
        throw new SecTransportFailure('blocked_by_policy', 'SEC redirect chain is invalid or too long.');
      }
      try {
        const redirectTarget = new URL(location, currentUrl);
        currentUrl = assertAllowedSecUrl(redirectTarget, currentUrl);
      } catch {
        throw new SecTransportFailure('blocked_by_policy', 'SEC redirect target is not allowlisted.');
      }
    } finally {
      if (!keepForCaller) timedResponse.dispose();
    }
  }
  throw new SecTransportFailure('blocked_by_policy', 'SEC redirect chain is invalid.');
}

async function readBoundedJsonObject(response: Response): Promise<Readonly<Record<string, unknown>>> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new SecTransportFailure('invalid_payload', 'SEC response Content-Length is invalid.');
    }
    if (parsedLength > SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES) {
      throw new SecTransportFailure('payload_too_large', 'SEC response exceeded 64 MiB.');
    }
  }

  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new SecTransportFailure('invalid_payload', 'SEC response body is missing.');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SecTransportFailure('payload_too_large', 'SEC response exceeded 64 MiB.');
      }
      chunks.push(chunk.value);
    }
  } catch (error: unknown) {
    if (error instanceof SecTransportFailure) throw error;
    if (isAbortError(error)) {
      throw new SecTransportFailure('upstream_timeout', 'SEC request or operation timeout was exceeded.');
    }
    throw new SecTransportFailure('provider_unavailable', 'SEC response stream failed.');
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new SecTransportFailure('invalid_payload', 'SEC response is not valid UTF-8 JSON.');
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SecTransportFailure('invalid_payload', 'SEC response root must be a JSON object.');
  }
  return input as Readonly<Record<string, unknown>>;
}

function failureFromStatus(status: number, cik: Cik): SecTransportFailure {
  if (status === 403) return new SecTransportFailure('blocked_by_policy', 'SEC provider blocked the request.');
  if (status === 404) return new SecTransportFailure('resource_not_found', 'SEC issuer resource was not found.', cik);
  if (status === 413) return new SecTransportFailure('payload_too_large', 'SEC provider reported an oversized payload.');
  if (status === 504) return new SecTransportFailure('upstream_timeout', 'SEC provider timed out.');
  return new SecTransportFailure('provider_unavailable', `SEC provider returned HTTP ${status}.`);
}

async function acquirePayload(
  options: SecStreamOptions,
  budget: SecOperationBudget,
  dependencies: FetchDependencies,
): Promise<Readonly<Record<string, unknown>>> {
  const startedAt = options.operationStartedAt ?? dependencies.now();
  if (!Number.isFinite(startedAt)) {
    throw new SecTransportFailure('upstream_timeout', 'SEC operation start timestamp is invalid.');
  }
  let lastFailure: SecTransportFailure | undefined;

  for (let attempt = 0; attempt < SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST; attempt += 1) {
    assertOperationWithinDeadline(startedAt, dependencies.now());

    try {
      const timedResponse = await fetchFollowingAllowlistedRedirects(
        options.upstreamUrl,
        options.environment,
        budget,
        dependencies,
        startedAt,
      );
      const response = timedResponse.response;
      try {
        if (response.ok) {
          const payload = await readBoundedJsonObject(response);
          assertOperationWithinDeadline(startedAt, dependencies.now());
          return payload;
        }
        const failure = failureFromStatus(response.status, options.cik);
        if (!isRetryableStatus(response.status)) throw failure;
        lastFailure = failure;
      } finally {
        timedResponse.dispose();
      }
      if (attempt + 1 < SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST) {
        const delay = retryAfterMilliseconds(response, dependencies.now()) ?? SEC_BACKOFF_MS[attempt] ?? SEC_BACKOFF_MS[2];
        await dependencies.sleep(delay);
        assertOperationWithinDeadline(startedAt, dependencies.now());
      }
    } catch (error: unknown) {
      if (!(error instanceof SecTransportFailure)) throw error;
      if (
        error.code !== 'provider_unavailable'
        && error.code !== 'upstream_timeout'
      ) {
        throw error;
      }
      lastFailure = error;
      if (attempt + 1 < SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST) {
        await dependencies.sleep(SEC_BACKOFF_MS[attempt] ?? SEC_BACKOFF_MS[2]);
        assertOperationWithinDeadline(startedAt, dependencies.now());
      }
    }
  }

  throw lastFailure ?? new SecTransportFailure('provider_unavailable', 'SEC provider did not return a usable response.');
}

export async function fetchSecPayloadEnvelope(options: SecStreamOptions): Promise<Response> {
  const budget = options.budget ?? new SecOperationBudget();
  const dependencies: FetchDependencies = {
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    sleep: options.sleep ?? defaultSleep,
    now: options.now ?? Date.now,
  };

  try {
    assertDeploymentBindings(options.environment);
    try {
      assertAllowedSecUrl(options.upstreamUrl);
    } catch {
      throw new SecTransportFailure('blocked_by_policy', 'SEC URL is not allowlisted.');
    }

    const baseSink: TelemetrySink = options.telemetrySink ?? Object.freeze({ write: () => {} });
    const sink = createRedactedTelemetrySink(baseSink, [
      options.environment.SEC_USER_AGENT,
      options.environment.SEC_CONTACT_EMAIL,
    ]);
    const observability = createWorkerObservability(sink);
    observability.record('started', 'none');

    const payload = await acquirePayload(options, budget, dependencies);
    const canonicalPayload = JSON.stringify(payload);
    const envelope = Object.freeze({
      cik: options.cik,
      sourceKind: options.sourceKind,
      payloadSha256: await sha256Hex(canonicalPayload),
      payload,
    });
    observability.record('succeeded', 'none');

    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    if (error instanceof SecTransportFailure) {
      if (error.code === 'resource_not_found') {
        return createGatewayProblemResponse(error.code, {
          detail: error.message,
          resourceId: error.resourceId ?? options.cik,
          resourceType: 'issuer',
        });
      }
      return createGatewayProblemResponse(error.code, { detail: error.message });
    }
    return createGatewayProblemResponse('provider_unavailable', {
      detail: 'Unexpected SEC gateway transport failure.',
    });
  }
}
