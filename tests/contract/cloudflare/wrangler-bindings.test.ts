import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function parseJsonc(source: string): unknown {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');
  return JSON.parse(withoutComments) as unknown;
}

function assertRecord(value: unknown): asserts value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Expected a JSON object.');
  }
}

describe('Cloudflare Worker binding contract', () => {
  it('declares one D1 catalog binding and no prohibited Cloudflare services', async () => {
    const source = await readFile('workers/sec-gateway/wrangler.jsonc', 'utf8');
    const document = parseJsonc(source);
    assertRecord(document);

    expect(document.main).toBe('src/index.ts');
    expect(document.workers_dev).toBe(false);
    expect(document.preview_urls).toBe(false);
    expect(document.d1_databases).toEqual([
      expect.objectContaining({
        binding: 'CATALOG_DB',
        database_name: 'finscope-catalog-metadata',
        migrations_dir: 'migrations',
      }),
    ]);

    for (const prohibited of [
      'kv_namespaces',
      'r2_buckets',
      'queues',
      'durable_objects',
      'triggers',
      'services',
    ]) {
      expect(document, prohibited).not.toHaveProperty(prohibited);
    }
  });

  it('declares required variable names without packaging their values', async () => {
    const [configuration, entrypoint] = await Promise.all([
      readFile('workers/sec-gateway/wrangler.jsonc', 'utf8'),
      readFile('workers/sec-gateway/src/index.ts', 'utf8'),
    ]);
    const document = parseJsonc(configuration);
    assertRecord(document);

    expect(document).not.toHaveProperty('vars');
    expect(entrypoint).toContain('readonly SEC_USER_AGENT: string');
    expect(entrypoint).toContain('readonly SEC_CONTACT_EMAIL: string');
    expect(configuration).toContain('// SEC_USER_AGENT');
    expect(configuration).toContain('// SEC_CONTACT_EMAIL');
    expect(configuration).not.toMatch(/SEC_(?:USER_AGENT|CONTACT_EMAIL)\s*[=:]\s*["'][^"']+/u);
    expect(entrypoint).not.toMatch(/SEC_(?:USER_AGENT|CONTACT_EMAIL)\s*[:=]\s*["'][^"']+/u);
  });

  it('keeps a closed, explicit read-only gateway route table', async () => {
    const entrypoint = await readFile('workers/sec-gateway/src/index.ts', 'utf8');
    expect(entrypoint).toContain("export type ReadOnlyMethod = 'GET' | 'HEAD'");
    expect(entrypoint).toContain('export const gatewayRouteTable');
    expect(entrypoint).toContain("request.method !== 'GET' && request.method !== 'HEAD'");
    expect(entrypoint).not.toContain('POST');
    expect(entrypoint).not.toContain('PUT');
    expect(entrypoint).not.toContain('DELETE');
  });
});
