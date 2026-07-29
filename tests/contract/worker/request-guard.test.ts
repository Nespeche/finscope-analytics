import { describe, expect, it, vi } from 'vitest';
import worker, { type SecGatewayEnvironment } from '../../../workers/sec-gateway/src/index';
import {
  assertAllowedSecUrl,
  createCompanyConceptSecUrl,
  isAllowedSecUrl,
} from '../../../workers/sec-gateway/src/security/allowlist';
import { guardGatewayRequest } from '../../../workers/sec-gateway/src/security/request-guard';
import { parseCik } from '../../../src/domain/identity/cik';
import { parseGatewayProblemDetails } from '../../../src/gateway/problem-details';

const environment: SecGatewayEnvironment = {
  CATALOG_DB: { prepare: () => undefined },
  SEC_USER_AGENT: 'FinScope test agent',
  SEC_CONTACT_EMAIL: 'test@example.invalid',
};

describe('SEC request guard and allowlist', () => {
  it('rejects invalid CIK, path and method before any upstream call', async () => {
    const upstream = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', upstream);

    const invalidCik = await worker.fetch(
      new Request('https://gateway.example/issuers/32O193/submissions'),
      environment,
    );
    const invalidMethod = await worker.fetch(
      new Request('https://gateway.example/issuers/0000320193/submissions', { method: 'POST' }),
      environment,
    );
    const invalidTag = await worker.fetch(
      new Request('https://gateway.example/issuers/0000320193/company-concepts/us-gaap/Revenue%2FAll'),
      environment,
    );

    expect(invalidCik.status).toBe(400);
    const invalidProblem = parseGatewayProblemDetails(await invalidCik.json());
    expect(invalidProblem).toMatchObject({
      code: 'invalid_request',
      status: 400,
      title: 'InvalidRequestProblem',
      type: 'https://finscope.local/problems/invalid_request',
    });
    expect(invalidMethod.status).toBe(405);
    expect(invalidMethod.headers.get('allow')).toBe('GET, HEAD');
    expect(invalidTag.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('accepts only the three explicit B06 request shapes', () => {
    expect(guardGatewayRequest(new Request(
      'https://gateway.example/issuers/0000320193/submissions',
    ))).toMatchObject({ status: 'allowed', value: { kind: 'submissions' } });
    expect(guardGatewayRequest(new Request(
      'https://gateway.example/issuers/0000320193/company-facts',
    ))).toMatchObject({ status: 'allowed', value: { kind: 'company_facts' } });
    expect(guardGatewayRequest(new Request(
      'https://gateway.example/issuers/0000320193/company-concepts/us-gaap/Revenues',
    ))).toMatchObject({ status: 'allowed', value: { kind: 'company_concept' } });
    expect(guardGatewayRequest(new Request(
      'https://gateway.example/issuers/0000320193/filings/0000320193-24-000123',
    ))).toEqual({ status: 'not_found' });
  });

  it('returns the schema-exact issuer not-found Problem Details variant', async () => {
    const upstream = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', upstream);
    const response = await worker.fetch(
      new Request('https://gateway.example/issuers/0000320193/company-facts'),
      environment,
    );

    expect(response.status).toBe(404);
    const problem = parseGatewayProblemDetails(await response.json());
    expect(problem).toMatchObject({
      code: 'resource_not_found',
      status: 404,
      title: 'IssuerNotFoundProblem',
      type: 'https://finscope.local/problems/resource_not_found-issuer',
      resourceType: 'issuer',
      resourceId: '0000320193',
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('revalidates each redirect target and forbids cross-host redirects', () => {
    const initial = createCompanyConceptSecUrl(parseCik('0000320193'), 'us-gaap', 'Revenues');
    expect(initial.href).toBe(
      'https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/Revenues.json',
    );
    const sameHost = new URL(initial.href);
    const crossHost = new URL(initial.href);
    crossHost.hostname = 'www.sec.gov';
    const foreignHost = new URL('https://example.invalid/api/xbrl/companyfacts/CIK0000320193.json');

    expect(isAllowedSecUrl(sameHost, initial)).toBe(true);
    expect(isAllowedSecUrl(crossHost, initial)).toBe(false);
    expect(isAllowedSecUrl(foreignHost)).toBe(false);
    expect(() => assertAllowedSecUrl(crossHost, initial)).toThrow(/SEC_URL_BLOCKED_BY_POLICY/u);
  });
});
