import { describe, expect, it, vi } from 'vitest';
import { parseCik } from '../../../src/domain/identity/cik';
import type { TelemetrySink } from '../../../src/core/telemetry';
import type { SecGatewayEnvironment } from '../../../workers/sec-gateway/src/index';
import {
  fetchSecPayloadEnvelope,
  SEC_MAX_EXTERNAL_CALLS,
  SEC_REQUEST_TIMEOUT_MS,
  SecOperationBudget,
} from '../../../workers/sec-gateway/src/sec-stream';
import { createCompanyFactsSecUrl } from '../../../workers/sec-gateway/src/security/allowlist';

const cik = parseCik('0000320193');
const environment: SecGatewayEnvironment = {
  CATALOG_DB: { prepare: () => undefined },
  SEC_USER_AGENT: 'FinScope integration agent',
  SEC_CONTACT_EMAIL: 'integration@example.invalid',
};

describe('SEC bounded stream', () => {
  it('returns a hashed envelope and emits only redacted telemetry', async () => {
    const payload = { cik: 320193, entityName: 'Apple Inc.', facts: {} };
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    const records: string[] = [];
    const telemetrySink: TelemetrySink = { write: (record) => { records.push(record); } };

    const response = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl,
      sleep: async () => {},
      telemetrySink,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      cik,
      sourceKind: 'company_facts',
      payload,
      payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(2);
    expect(records.join('\n')).not.toContain(environment.SEC_USER_AGENT);
    expect(records.join('\n')).not.toContain(environment.SEC_CONTACT_EMAIL);
  });

  it('performs zero upstream calls when fair-access bindings are missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment: { ...environment, SEC_CONTACT_EMAIL: '' },
      fetchImpl,
      sleep: async () => {},
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'blocked_by_policy' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects malformed redirect locations and invalid contact bindings before unsafe follow-up calls', async () => {
    const redirectFetch = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://[invalid' },
    }));
    const malformedRedirect = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl: redirectFetch,
      sleep: async () => {},
    });
    expect(malformedRedirect.status).toBe(403);
    expect(redirectFetch).toHaveBeenCalledTimes(1);

    const invalidBindingFetch = vi.fn<typeof fetch>();
    const invalidBinding = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment: { ...environment, SEC_CONTACT_EMAIL: 'not-an-email' },
      fetchImpl: invalidBindingFetch,
      sleep: async () => {},
    });
    expect(invalidBinding.status).toBe(403);
    expect(invalidBindingFetch).not.toHaveBeenCalled();
  });

  it('revalidates redirect targets before issuing the redirected request', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, {
      status: 302,
      headers: {
        location: 'https://www.sec.gov/api/xbrl/companyfacts/CIK0000320193.json',
      },
    }));

    const response = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl,
      sleep: async () => {},
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'blocked_by_policy' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('applies three logical attempts and fail-fast status mapping', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    const sleep = vi.fn(async () => {});

    const response = await fetchSecPayloadEnvelope({
      cik,
      sourceKind: 'company_facts',
      upstreamUrl: createCompanyFactsSecUrl(cik),
      environment,
      fetchImpl,
      sleep,
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'provider_unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('keeps the request timeout active while the response body is streaming', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
        const signal = init?.signal;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            signal?.addEventListener('abort', () => {
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              controller.error(abortError);
            }, { once: true });
          },
        });
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

      const pending = fetchSecPayloadEnvelope({
        cik,
        sourceKind: 'company_facts',
        upstreamUrl: createCompanyFactsSecUrl(cik),
        environment,
        fetchImpl,
        sleep: async () => {},
      });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await vi.advanceTimersByTimeAsync(SEC_REQUEST_TIMEOUT_MS);
      }
      const response = await pending;

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ code: 'upstream_timeout' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never permits a fifteenth external call', () => {
    const budget = new SecOperationBudget();
    for (let index = 0; index < SEC_MAX_EXTERNAL_CALLS; index += 1) {
      expect(budget.consume()).toBe(index + 1);
    }
    expect(budget.remaining).toBe(0);
    expect(() => budget.consume()).toThrow(/budget exhausted/u);
    expect(budget.externalCallCount).toBe(14);
  });
});
