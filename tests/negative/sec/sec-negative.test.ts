import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import securityVectors from '../../../specs/001-fundamental-analysis-platform/fixtures/security/security-and-import-limit-vectors.json';
import { parseCik } from '../../../src/domain/identity/cik';
import type { SecGatewayEnvironment } from '../../../workers/sec-gateway/src/index';
import { fetchSecPayloadEnvelope } from '../../../workers/sec-gateway/src/sec-stream';
import { createCompanyFactsSecUrl } from '../../../workers/sec-gateway/src/security/allowlist';

const cik = parseCik('0000320193');
const environment: SecGatewayEnvironment = {
  CATALOG_DB: { prepare: () => undefined },
  SEC_USER_AGENT: 'FinScope negative agent',
  SEC_CONTACT_EMAIL: 'negative@example.invalid',
};

describe('SEC negative authority vectors', () => {
  it('maps oversized and operation-timeout vectors to their exact problems', async () => {
    const sizeVector = securityVectors.vectors.find((vector) => vector.vectorId === 'sec-response-too-large');
    const timeoutVector = securityVectors.vectors.find((vector) => vector.vectorId === 'sec-operation-timeout');
    expect(sizeVector?.uncompressedBytes).toBe(67_108_865);
    expect(timeoutVector?.elapsedSeconds).toBe(121);

    const oversizedFetch = vi.fn<typeof fetch>(async () => new Response('{}', {
      status: 200,
      headers: { 'content-length': '67108865', 'content-type': 'application/json' },
    }));
    const oversized = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl: oversizedFetch,
      sleep: async () => {},
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toMatchObject({ code: 'payload_too_large' });

    const timeoutFetch = vi.fn<typeof fetch>();
    const timedOut = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl: timeoutFetch,
      sleep: async () => {},
      operationStartedAt: 0,
      now: () => 121_000,
    });
    expect(timedOut.status).toBe(504);
    expect(await timedOut.json()).toMatchObject({ code: 'upstream_timeout' });
    expect(timeoutFetch).not.toHaveBeenCalled();
  });

  it('packages binding names but no deployment values or secret logging', async () => {
    const [wrangler, entrypoint, stream, observability] = await Promise.all([
      readFile('workers/sec-gateway/wrangler.jsonc', 'utf8'),
      readFile('workers/sec-gateway/src/index.ts', 'utf8'),
      readFile('workers/sec-gateway/src/sec-stream.ts', 'utf8'),
      readFile('workers/sec-gateway/src/observability.ts', 'utf8'),
    ]);
    const packageText = [wrangler, entrypoint, stream, observability].join('\n');

    expect(packageText).toContain('SEC_USER_AGENT');
    expect(packageText).toContain('SEC_CONTACT_EMAIL');
    expect(wrangler).not.toMatch(/SEC_(?:USER_AGENT|CONTACT_EMAIL)\s*[=:]\s*["'][^"']+/u);
    expect(stream).not.toContain('console.log');
    expect(stream).not.toContain('console.error');
    expect(observability).toContain('SENSITIVE_VALUE_IN_TELEMETRY');
  });

  it('permits only same-host allowlisted redirects and rejects cross-host redirects before follow-up', async () => {
    const sameHostFetch = vi.fn<typeof fetch>(async (_input, _init) => {
      if (sameHostFetch.mock.calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://data.sec.gov/submissions/CIK0000320193.json' },
        });
      }
      return new Response(JSON.stringify({ cik: '0000320193', filings: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const sameHost = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl: sameHostFetch,
      sleep: async () => {},
    });
    expect(sameHost.status).toBe(200);
    expect(sameHostFetch).toHaveBeenCalledTimes(2);

    const crossHostFetch = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://www.sec.gov/api/xbrl/companyfacts/CIK0000320193.json' },
    }));
    const crossHost = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl: crossHostFetch,
      sleep: async () => {},
    });
    expect(crossHost.status).toBe(403);
    expect(await crossHost.json()).toMatchObject({ code: 'blocked_by_policy' });
    expect(crossHostFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed with zero upstream calls for null, empty and malformed fair-access bindings', async () => {
    const invalidEnvironments: readonly SecGatewayEnvironment[] = [
      { ...environment, SEC_USER_AGENT: null } as unknown as SecGatewayEnvironment,
      { ...environment, SEC_CONTACT_EMAIL: null } as unknown as SecGatewayEnvironment,
      { ...environment, SEC_USER_AGENT: '' },
      { ...environment, SEC_CONTACT_EMAIL: '' },
      { ...environment, SEC_USER_AGENT: 'FinScope\r\nInjected' },
      { ...environment, SEC_CONTACT_EMAIL: 'invalid' },
    ];

    for (const invalidEnvironment of invalidEnvironments) {
      const fetchImpl = vi.fn<typeof fetch>();
      const response = await fetchSecPayloadEnvelope({
        cik,
        sourceKind: 'company_facts',
        upstreamUrl: createCompanyFactsSecUrl(cik),
        environment: invalidEnvironment,
        fetchImpl,
        sleep: async () => {},
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'blocked_by_policy' });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });
});
