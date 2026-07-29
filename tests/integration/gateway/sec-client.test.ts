import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../../src/core/sha256';
import { parseCik } from '../../../src/domain/identity/cik';
import { createSecClient } from '../../../src/gateway/sec-client';
import {
  readSecGatewayJson,
  SecGatewayNotModifiedError,
} from '../../../src/gateway/sec-response';

async function readFixture(path: string): Promise<Readonly<Record<string, unknown>>> {
  return JSON.parse(await readFile(path, 'utf8')) as Readonly<Record<string, unknown>>;
}

async function createEnvelope(
  sourceKind: 'submissions' | 'company_facts' | 'company_concept',
  payload: Readonly<Record<string, unknown>>,
): Promise<Readonly<Record<string, unknown>>> {
  return Object.freeze({
    cik: '0000320193',
    sourceKind,
    payloadSha256: await sha256Hex(JSON.stringify(payload)),
    payload,
  });
}

function jsonResponse(input: unknown, status = 200): Response {
  return new Response(JSON.stringify(input), {
    status,
    headers: { 'content-type': status === 200 ? 'application/json' : 'application/problem+json' },
  });
}

describe('validated SEC gateway client', () => {
  it('requests Submissions before Company Facts and validates both before return', async () => {
    const submissions = await readFixture(
      'specs/001-fundamental-analysis-platform/fixtures/sec/raw/apple-submissions-official-excerpt.json',
    );
    const companyFacts = await readFixture(
      'specs/001-fundamental-analysis-platform/fixtures/sec/raw/apple-companyfacts-official-excerpt.json',
    );
    const responses = [
      jsonResponse(await createEnvelope('submissions', submissions)),
      jsonResponse(await createEnvelope('company_facts', companyFacts)),
    ];
    const requestedPaths: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      requestedPaths.push(new URL(String(input)).pathname);
      const response = responses.shift();
      if (response === undefined) throw new Error('Unexpected request.');
      return response;
    });
    const client = createSecClient({
      baseUrl: new URL('https://gateway.example/'),
      fetchImpl,
    });

    const result = await client.acquirePrimary(parseCik('0000320193'));

    expect(requestedPaths).toEqual([
      '/issuers/0000320193/submissions',
      '/issuers/0000320193/company-facts',
    ]);
    expect(result.submissions.payload.name).toBe('Apple Inc.');
    expect(result.companyFacts.payload.entityName).toBe('Apple Inc.');
  });

  it('rejects partial Company Facts before exposing it to domain consumers', async () => {
    const invalidFacts = await readFixture(
      'specs/001-fundamental-analysis-platform/fixtures/sec/raw/invalid-companyfacts-partial.json',
    );
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(
      await createEnvelope('company_facts', invalidFacts),
    ));
    const client = createSecClient({
      baseUrl: new URL('https://gateway.example/'),
      fetchImpl,
    });

    await expect(client.getCompanyFacts(parseCik('0000320193')))
      .rejects.toThrow(/INVALID_SEC_COMPANY_FACTS_PAYLOAD/u);
  });

  it('validates Company Concept taxonomy, tag, CIK and payload hash', async () => {
    const concept = await readFixture(
      'specs/001-fundamental-analysis-platform/fixtures/sec/raw/apple-companyconcept-revenues-official-excerpt.json',
    );
    const validEnvelope = await createEnvelope('company_concept', concept);
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(validEnvelope));
    const client = createSecClient({
      baseUrl: new URL('https://gateway.example/'),
      fetchImpl,
    });

    const result = await client.getCompanyConcept(
      parseCik('0000320193'),
      'us-gaap',
      'Revenues',
    );
    expect(result.payload.taxonomy).toBe('us-gaap');
    expect(result.payload.tag).toBe('Revenues');

    const tampered = { ...validEnvelope, payloadSha256: '0'.repeat(64) };
    const tamperedClient = createSecClient({
      baseUrl: new URL('https://gateway.example/'),
      fetchImpl: async () => jsonResponse(tampered),
    });
    await expect(tamperedClient.getCompanyConcept(
      parseCik('0000320193'),
      'us-gaap',
      'Revenues',
    )).rejects.toThrow(/SEC_PAYLOAD_SHA256_MISMATCH/u);
  });

  it('sends only validated conditional cache headers and exposes 304 metadata', async () => {
    let requestHeaders = new Headers();
    let fetchCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      fetchCalls += 1;
      requestHeaders = new Headers(init?.headers);
      return new Response(null, {
        status: 304,
        headers: {
          etag: '"gateway-etag"',
          'last-modified': 'Sun, 26 Jul 2026 00:00:00 GMT',
        },
      });
    });
    const client = createSecClient({ baseUrl: new URL('https://gateway.example/'), fetchImpl });

    const request = client.getSubmissions(parseCik('0000320193'), {
      validators: {
        etag: '"cached-etag"',
        lastModified: 'Sat, 25 Jul 2026 00:00:00 GMT',
      },
    });

    const notModifiedError = await request.catch((error: unknown) => error);
    expect(notModifiedError).toBeInstanceOf(SecGatewayNotModifiedError);
    expect(notModifiedError).toMatchObject({
      validators: {
        etag: '"gateway-etag"',
        lastModified: 'Sun, 26 Jul 2026 00:00:00 GMT',
      },
    });
    expect(requestHeaders.get('if-none-match')).toBe('"cached-etag"');
    expect(requestHeaders.get('if-modified-since')).toBe('Sat, 25 Jul 2026 00:00:00 GMT');

    const callsBeforeInvalidHeader = fetchCalls;
    await expect(client.getSubmissions(parseCik('0000320193'), {
      validators: { etag: 'unsafe\r\nheader' },
    })).rejects.toThrow(/INVALID_SEC_ETAG/u);
    expect(fetchCalls).toBe(callsBeforeInvalidHeader);
  });

  it('cancels a streamed gateway body as soon as its byte limit is exceeded', async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"a":1}'));
        controller.enqueue(new TextEncoder().encode(' '));
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    await expect(readSecGatewayJson(response, 7)).rejects.toThrow(/SEC_GATEWAY_PAYLOAD_TOO_LARGE/u);
    expect(cancelled).toBe(true);
  });


  it('serializes concurrent browser requests to one active gateway call', async () => {
    const facts = await readFixture(
      'specs/001-fundamental-analysis-platform/fixtures/sec/raw/apple-companyfacts-official-excerpt.json',
    );
    const envelope = await createEnvelope('company_facts', facts);
    let active = 0;
    let maximumActive = 0;
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let callCount = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      callCount += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (callCount === 1) await firstGate;
      active -= 1;
      return jsonResponse(envelope);
    });
    const client = createSecClient({ baseUrl: new URL('https://gateway.example/'), fetchImpl });

    const first = client.getCompanyFacts(parseCik('0000320193'));
    const second = client.getCompanyFacts(parseCik('0000320193'));
    await Promise.resolve();
    expect(callCount).toBe(1);
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(callCount).toBe(2);
    expect(maximumActive).toBe(1);
  });

});
