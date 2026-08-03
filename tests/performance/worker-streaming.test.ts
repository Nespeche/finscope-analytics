import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES } from '../../workers/sec-gateway/src/sec-stream';
import { FINSCOPE_CLOUDFLARE_BUDGET } from '../../workers/sec-gateway/src/budget';
import { SEC_PAYLOAD_TEST_SIZES, chunkedJsonStream } from './fixtures/sec-payload-sizes';

describe('Worker streaming boundaries', () => {
  it('generates bounded chunks without constructing the complete fixture', async () => {
    const reader = chunkedJsonStream(SEC_PAYLOAD_TEST_SIZES.small).getReader();
    let largest = 0;
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      largest = Math.max(largest, chunk.value.byteLength);
      total += chunk.value.byteLength;
    }
    expect(largest).toBeLessThanOrEqual(64 * 1024);
    expect(total).toBeGreaterThanOrEqual(SEC_PAYLOAD_TEST_SIZES.small);
    expect(SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES).toBe(SEC_PAYLOAD_TEST_SIZES.companyFactsMaximum);
  });

  it('keeps redirects and subrequests statically bounded', async () => {
    const source = await readFile(new URL('../../workers/sec-gateway/src/sec-stream.ts', import.meta.url), 'utf8');
    expect(source).toContain('const MAX_REDIRECTS = 5');
    expect(FINSCOPE_CLOUDFLARE_BUDGET.workerSubrequests).toBe(1);
    expect(source).toContain('SEC_MAX_UNCOMPRESSED_RESPONSE_BYTES');
  });
});
