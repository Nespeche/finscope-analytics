import { sha256Hex } from '../core/sha256';
import {
  normalizeCik,
  parseCik,
  type Cik,
} from '../domain/identity/cik';
import {
  parseGatewayProblemDetails,
  type GatewayProblemDetails,
} from './problem-details';

export type SecPayloadSourceKind = 'submissions' | 'company_facts' | 'company_concept';
export type SecTaxonomy = 'us-gaap' | 'ifrs-full' | 'dei';
export const SEC_CLIENT_MAX_RESPONSE_BYTES = 67_108_864 as const;

export interface SecCacheValidators {
  readonly etag?: string;
  readonly lastModified?: string;
}

export class SecGatewayNotModifiedError extends Error {
  readonly validators: SecCacheValidators;

  constructor(validators: SecCacheValidators) {
    super('SEC_GATEWAY_NOT_MODIFIED');
    this.name = 'SecGatewayNotModifiedError';
    this.validators = Object.freeze({ ...validators });
  }
}

export interface SecSubmissionsPayload extends Readonly<Record<string, unknown>> {
  readonly cik: Cik;
  readonly name: string;
  readonly tickers: readonly string[];
  readonly filings: Readonly<Record<string, unknown>>;
}

export interface SecCompanyFactsPayload extends Readonly<Record<string, unknown>> {
  readonly cik: number | string;
  readonly entityName: string;
  readonly facts: Readonly<Record<string, unknown>>;
}

export interface SecCompanyConceptPayload extends Readonly<Record<string, unknown>> {
  readonly cik: number | string;
  readonly taxonomy: SecTaxonomy;
  readonly tag: string;
  readonly entityName: string;
  readonly units: Readonly<Record<string, unknown>>;
}

export interface SecPayloadEnvelope<
  Source extends SecPayloadSourceKind,
  Payload extends Readonly<Record<string, unknown>>,
> {
  readonly cik: Cik;
  readonly sourceKind: Source;
  readonly payloadSha256: string;
  readonly payload: Payload;
}

export type SecSubmissionsEnvelope = SecPayloadEnvelope<'submissions', SecSubmissionsPayload>;
export type SecCompanyFactsEnvelope = SecPayloadEnvelope<'company_facts', SecCompanyFactsPayload>;
export type SecCompanyConceptEnvelope = SecPayloadEnvelope<'company_concept', SecCompanyConceptPayload>;

export class SecGatewayProblemError extends Error {
  readonly problem: GatewayProblemDetails;

  constructor(problem: GatewayProblemDetails) {
    super(problem.detail);
    this.name = 'SecGatewayProblemError';
    this.problem = problem;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(record: Readonly<Record<string, unknown>>, keys: readonly string[]): void {
  const actual = Object.keys(record).sort((left, right) => left.localeCompare(right, 'en'));
  const expected = [...keys].sort((left, right) => left.localeCompare(right, 'en'));
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new TypeError('INVALID_SEC_ENVELOPE_KEYS');
  }
}

function assertStringArray(value: unknown, field: string): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new TypeError(`INVALID_SEC_${field.toUpperCase()}`);
  }
}

function assertPayloadCik(value: unknown, expectedCik: Cik): void {
  if (normalizeCik(value) !== expectedCik) {
    throw new TypeError('SEC_PAYLOAD_CIK_MISMATCH');
  }
}

function parseSubmissionsPayload(input: unknown, expectedCik: Cik): SecSubmissionsPayload {
  if (!isRecord(input)) throw new TypeError('INVALID_SEC_SUBMISSIONS_PAYLOAD');
  assertPayloadCik(input.cik, expectedCik);
  if (typeof input.name !== 'string' || input.name.trim().length === 0 || !isRecord(input.filings)) {
    throw new TypeError('INVALID_SEC_SUBMISSIONS_PAYLOAD');
  }
  assertStringArray(input.tickers, 'tickers');
  return Object.freeze(structuredClone(input)) as SecSubmissionsPayload;
}

function assertCompanyFactsConcepts(facts: Readonly<Record<string, unknown>>): void {
  for (const taxonomy of Object.values(facts)) {
    if (!isRecord(taxonomy)) throw new TypeError('INVALID_SEC_COMPANY_FACTS_PAYLOAD');
    for (const concept of Object.values(taxonomy)) {
      if (!isRecord(concept) || !isRecord(concept.units)) {
        throw new TypeError('INVALID_SEC_COMPANY_FACTS_PAYLOAD');
      }
    }
  }
}

function parseCompanyFactsPayload(input: unknown, expectedCik: Cik): SecCompanyFactsPayload {
  if (!isRecord(input)) throw new TypeError('INVALID_SEC_COMPANY_FACTS_PAYLOAD');
  assertPayloadCik(input.cik, expectedCik);
  if (typeof input.entityName !== 'string' || input.entityName.trim().length === 0 || !isRecord(input.facts)) {
    throw new TypeError('INVALID_SEC_COMPANY_FACTS_PAYLOAD');
  }
  assertCompanyFactsConcepts(input.facts);
  return Object.freeze(structuredClone(input)) as SecCompanyFactsPayload;
}

function isTaxonomy(value: unknown): value is SecTaxonomy {
  return value === 'us-gaap' || value === 'ifrs-full' || value === 'dei';
}

function parseCompanyConceptPayload(
  input: unknown,
  expectedCik: Cik,
  expectedTaxonomy?: SecTaxonomy,
  expectedTag?: string,
): SecCompanyConceptPayload {
  if (!isRecord(input)) throw new TypeError('INVALID_SEC_COMPANY_CONCEPT_PAYLOAD');
  assertPayloadCik(input.cik, expectedCik);
  if (
    !isTaxonomy(input.taxonomy)
    || typeof input.tag !== 'string'
    || !/^[A-Za-z][A-Za-z0-9]+$/u.test(input.tag)
    || typeof input.entityName !== 'string'
    || input.entityName.trim().length === 0
    || !isRecord(input.units)
  ) {
    throw new TypeError('INVALID_SEC_COMPANY_CONCEPT_PAYLOAD');
  }
  if (expectedTaxonomy !== undefined && input.taxonomy !== expectedTaxonomy) {
    throw new TypeError('SEC_PAYLOAD_TAXONOMY_MISMATCH');
  }
  if (expectedTag !== undefined && input.tag !== expectedTag) {
    throw new TypeError('SEC_PAYLOAD_TAG_MISMATCH');
  }
  return Object.freeze(structuredClone(input)) as SecCompanyConceptPayload;
}

export async function parseSecPayloadEnvelope(
  input: unknown,
  expectedSource: 'submissions',
  expectedCik: Cik,
): Promise<SecSubmissionsEnvelope>;
export async function parseSecPayloadEnvelope(
  input: unknown,
  expectedSource: 'company_facts',
  expectedCik: Cik,
): Promise<SecCompanyFactsEnvelope>;
export async function parseSecPayloadEnvelope(
  input: unknown,
  expectedSource: 'company_concept',
  expectedCik: Cik,
  expectedTaxonomy: SecTaxonomy,
  expectedTag: string,
): Promise<SecCompanyConceptEnvelope>;
export async function parseSecPayloadEnvelope(
  input: unknown,
  expectedSource: SecPayloadSourceKind,
  expectedCik: Cik,
  expectedTaxonomy?: SecTaxonomy,
  expectedTag?: string,
): Promise<SecSubmissionsEnvelope | SecCompanyFactsEnvelope | SecCompanyConceptEnvelope> {
  if (!isRecord(input)) throw new TypeError('INVALID_SEC_PAYLOAD_ENVELOPE');
  assertExactKeys(input, ['cik', 'sourceKind', 'payloadSha256', 'payload']);
  const cik = parseCik(input.cik);
  if (cik !== expectedCik || input.sourceKind !== expectedSource) {
    throw new TypeError('SEC_ENVELOPE_CONTEXT_MISMATCH');
  }
  if (typeof input.payloadSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(input.payloadSha256)) {
    throw new TypeError('INVALID_SEC_PAYLOAD_SHA256');
  }
  if (!isRecord(input.payload)) throw new TypeError('INVALID_SEC_PAYLOAD');

  const actualSha256 = await sha256Hex(JSON.stringify(input.payload));
  if (actualSha256 !== input.payloadSha256) {
    throw new TypeError('SEC_PAYLOAD_SHA256_MISMATCH');
  }

  if (expectedSource === 'submissions') {
    return Object.freeze({
      cik,
      sourceKind: expectedSource,
      payloadSha256: input.payloadSha256,
      payload: parseSubmissionsPayload(input.payload, cik),
    });
  }
  if (expectedSource === 'company_facts') {
    return Object.freeze({
      cik,
      sourceKind: expectedSource,
      payloadSha256: input.payloadSha256,
      payload: parseCompanyFactsPayload(input.payload, cik),
    });
  }
  if (expectedTaxonomy === undefined || expectedTag === undefined) {
    throw new TypeError('COMPANY_CONCEPT_CONTEXT_REQUIRED');
  }
  return Object.freeze({
    cik,
    sourceKind: expectedSource,
    payloadSha256: input.payloadSha256,
    payload: parseCompanyConceptPayload(input.payload, cik, expectedTaxonomy, expectedTag),
  });
}

function responseValidators(response: Response): SecCacheValidators {
  const etag = response.headers.get('etag')?.trim();
  const lastModified = response.headers.get('last-modified')?.trim();
  return Object.freeze({
    ...(etag === undefined || etag.length === 0 ? {} : { etag }),
    ...(lastModified === undefined || lastModified.length === 0 ? {} : { lastModified }),
  });
}

async function readBoundedResponseText(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new TypeError('SEC_GATEWAY_INVALID_CONTENT_LENGTH');
    }
    if (bytes > maximumBytes) {
      throw new TypeError('SEC_GATEWAY_PAYLOAD_TOO_LARGE');
    }
  }

  const reader = response.body?.getReader();
  if (reader === undefined) throw new TypeError('SEC_GATEWAY_RESPONSE_BODY_MISSING');
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel('SEC_GATEWAY_PAYLOAD_TOO_LARGE');
      throw new TypeError('SEC_GATEWAY_PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TypeError('SEC_GATEWAY_RESPONSE_INVALID_UTF8');
  }
}

export async function readSecGatewayJson(
  response: Response,
  maximumBytes: number = SEC_CLIENT_MAX_RESPONSE_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > SEC_CLIENT_MAX_RESPONSE_BYTES) {
    throw new TypeError('INVALID_SEC_GATEWAY_MAXIMUM_BYTES');
  }
  if (response.status === 304) {
    throw new SecGatewayNotModifiedError(responseValidators(response));
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('json')) {
    throw new TypeError('SEC_GATEWAY_RESPONSE_NOT_JSON');
  }

  let input: unknown;
  try {
    input = JSON.parse(await readBoundedResponseText(response, maximumBytes)) as unknown;
  } catch (error: unknown) {
    if (error instanceof SecGatewayNotModifiedError) throw error;
    if (error instanceof TypeError && error.message.startsWith('SEC_GATEWAY_')) throw error;
    throw new TypeError('SEC_GATEWAY_RESPONSE_INVALID_JSON');
  }
  if (!response.ok) {
    throw new SecGatewayProblemError(parseGatewayProblemDetails(input));
  }
  return input;
}
