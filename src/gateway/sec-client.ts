import {
  parseCik,
  type Cik,
} from '../domain/identity/cik';
import {
  parseSecPayloadEnvelope,
  readSecGatewayJson,
  type SecCacheValidators,
  type SecCompanyConceptEnvelope,
  type SecCompanyFactsEnvelope,
  type SecSubmissionsEnvelope,
  type SecTaxonomy,
} from './sec-response';

export interface SecRequestOptions {
  readonly validators?: SecCacheValidators;
}

export interface SecClient {
  readonly getSubmissions: (cik: Cik, options?: SecRequestOptions) => Promise<SecSubmissionsEnvelope>;
  readonly getCompanyFacts: (cik: Cik, options?: SecRequestOptions) => Promise<SecCompanyFactsEnvelope>;
  readonly getCompanyConcept: (
    cik: Cik,
    taxonomy: SecTaxonomy,
    tag: string,
    options?: SecRequestOptions,
  ) => Promise<SecCompanyConceptEnvelope>;
  readonly acquirePrimary: (cik: Cik) => Promise<Readonly<{
    submissions: SecSubmissionsEnvelope;
    companyFacts: SecCompanyFactsEnvelope;
  }>>;
}

export interface SecClientOptions {
  readonly baseUrl?: URL;
  readonly fetchImpl?: typeof fetch;
}

function parseTaxonomy(value: SecTaxonomy): SecTaxonomy {
  if (value !== 'us-gaap' && value !== 'ifrs-full' && value !== 'dei') {
    throw new TypeError('INVALID_SEC_TAXONOMY');
  }
  return value;
}

function parseTag(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9]+$/u.test(value)) throw new TypeError('INVALID_SEC_TAG');
  return value;
}

function defaultBaseUrl(): URL {
  const origin = globalThis.location?.origin ?? 'http://localhost';
  return new URL('/', origin);
}

function parseValidator(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = value.trim();
  if (parsed.length === 0 || /[\r\n]/u.test(parsed)) {
    throw new TypeError(`INVALID_SEC_${field.toUpperCase()}`);
  }
  return parsed;
}

function createRequestHeaders(options: SecRequestOptions | undefined): Headers {
  const headers = new Headers({ accept: 'application/json, application/problem+json' });
  const etag = parseValidator(options?.validators?.etag, 'etag');
  const lastModified = parseValidator(options?.validators?.lastModified, 'last_modified');
  if (etag !== undefined) headers.set('if-none-match', etag);
  if (lastModified !== undefined) headers.set('if-modified-since', lastModified);
  return headers;
}

export function createSecClient(options: SecClientOptions = {}): SecClient {
  const baseUrl = new URL(options.baseUrl?.href ?? defaultBaseUrl().href);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  let requestQueue: Promise<void> = Promise.resolve();

  function runSerially<T>(operation: () => Promise<T>): Promise<T> {
    const result = requestQueue.then(operation, operation);
    requestQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function request(pathname: string, options?: SecRequestOptions): Promise<unknown> {
    const headers = createRequestHeaders(options);
    return runSerially(async () => {
      const response = await fetchImpl(new URL(pathname, baseUrl), {
        method: 'GET',
        headers,
      });
      return readSecGatewayJson(response);
    });
  }

  async function getSubmissions(
    cikInput: Cik,
    options?: SecRequestOptions,
  ): Promise<SecSubmissionsEnvelope> {
    const cik = parseCik(cikInput);
    const input = await request(`/issuers/${cik}/submissions`, options);
    return parseSecPayloadEnvelope(input, 'submissions', cik);
  }

  async function getCompanyFacts(
    cikInput: Cik,
    options?: SecRequestOptions,
  ): Promise<SecCompanyFactsEnvelope> {
    const cik = parseCik(cikInput);
    const input = await request(`/issuers/${cik}/company-facts`, options);
    return parseSecPayloadEnvelope(input, 'company_facts', cik);
  }

  async function getCompanyConcept(
    cikInput: Cik,
    taxonomyInput: SecTaxonomy,
    tagInput: string,
    options?: SecRequestOptions,
  ): Promise<SecCompanyConceptEnvelope> {
    const cik = parseCik(cikInput);
    const taxonomy = parseTaxonomy(taxonomyInput);
    const tag = parseTag(tagInput);
    const input = await request(`/issuers/${cik}/company-concepts/${taxonomy}/${tag}`, options);
    return parseSecPayloadEnvelope(input, 'company_concept', cik, taxonomy, tag);
  }

  async function acquirePrimary(cikInput: Cik): Promise<Readonly<{
    submissions: SecSubmissionsEnvelope;
    companyFacts: SecCompanyFactsEnvelope;
  }>> {
    const cik = parseCik(cikInput);
    const submissions = await getSubmissions(cik);
    const companyFacts = await getCompanyFacts(cik);
    return Object.freeze({ submissions, companyFacts });
  }

  return Object.freeze({ getSubmissions, getCompanyFacts, getCompanyConcept, acquirePrimary });
}
