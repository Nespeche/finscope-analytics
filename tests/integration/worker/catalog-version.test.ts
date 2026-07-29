import { describe, expect, it, vi } from 'vitest';
import { EMBEDDED_CATALOG_VERSIONS } from '../../../src/authority/catalog-version';
import {
  ACTIVE_CATALOG_VERSION_QUERY_PREFIX,
  CatalogVersionRepository,
} from '../../../workers/sec-gateway/src/catalog/version-repository';

interface MockStatement {
  bind(...values: readonly unknown[]): MockStatement;
  all<T>(): Promise<{ results: readonly T[] }>;
}

function createDatabase(rows: readonly unknown[]) {
  const all = vi.fn(async () => ({ results: rows }));
  const bind = vi.fn(function bind(this: MockStatement): MockStatement { return this; });
  const statement = { bind, all } as unknown as MockStatement;
  const prepare = vi.fn<(query: string) => MockStatement>(() => statement);
  return { database: { prepare }, prepare, bind, all };
}

describe('CatalogVersionRepository', () => {
  it('uses the indexed active-pointer join and returns current D1 metadata', async () => {
    const row = {
      catalog_id: 'metric-catalog',
      version: '5.0.2',
      schema_id: 'https://finscope.local/schemas/metric-catalog.schema.json',
      content_sha256: 'a'.repeat(64),
      published_at: '2026-07-25T10:00:00Z',
      activated_at: '2026-07-25T11:00:00Z',
    };
    const { database, prepare, bind } = createDatabase([row]);
    const repository = new CatalogVersionRepository(database);

    const versions = await repository.readActive(['metric-catalog']);

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining(ACTIVE_CATALOG_VERSION_QUERY_PREFIX));
    expect(prepare.mock.calls[0]?.[0]).toContain('INNER JOIN catalog_versions');
    expect(prepare.mock.calls[0]?.[0]).toContain('ORDER BY p.catalog_id ASC');
    expect(bind).toHaveBeenCalledWith('metric-catalog');
    expect(versions).toEqual([{
      catalogId: 'metric-catalog',
      version: '5.0.2',
      schemaId: row.schema_id,
      contentSha256: row.content_sha256,
      publishedAt: row.published_at,
      activatedAt: row.activated_at,
      source: 'd1',
      freshness: 'current',
    }]);
  });

  it('falls back to immutable embedded authorities and marks metadata stale when D1 fails', async () => {
    const repository = new CatalogVersionRepository({
      prepare: () => { throw new Error('D1 unavailable'); },
    });

    const versions = await repository.readActive(['xbrl-mapping-catalog', 'accounting-profile-catalog']);

    expect(versions.map((version) => version.catalogId)).toEqual([
      'accounting-profile-catalog',
      'xbrl-mapping-catalog',
    ]);
    expect(versions.every((version) => (
      version.source === 'embedded'
      && version.freshness === 'stale'
      && version.staleReason === 'd1_unavailable'
    ))).toBe(true);
    expect(versions[0]?.contentSha256).toBe(
      EMBEDDED_CATALOG_VERSIONS['accounting-profile-catalog'].contentSha256,
    );
  });

  it('falls back per catalog for missing pointers and invalid rows without blocking valid rows', async () => {
    const { database } = createDatabase([
      {
        catalog_id: 'metric-catalog',
        version: 'invalid',
        schema_id: 'invalid',
        content_sha256: 'invalid',
        published_at: 'invalid',
        activated_at: 'invalid',
      },
      {
        catalog_id: 'xbrl-mapping-catalog',
        version: '5.0.0',
        schema_id: 'https://finscope.local/schemas/xbrl-mapping-catalog.schema.json',
        content_sha256: 'b'.repeat(64),
        published_at: '2026-07-25T10:00:00Z',
        activated_at: '2026-07-25T11:00:00Z',
      },
    ]);
    const repository = new CatalogVersionRepository(database);

    const versions = await repository.readActive([
      'state-and-capability-catalog',
      'metric-catalog',
      'xbrl-mapping-catalog',
    ]);

    expect(versions.find((version) => version.catalogId === 'metric-catalog')).toMatchObject({
      source: 'embedded', freshness: 'stale', staleReason: 'invalid_d1_row',
    });
    expect(versions.find((version) => version.catalogId === 'state-and-capability-catalog')).toMatchObject({
      source: 'embedded', freshness: 'stale', staleReason: 'missing_active_pointer',
    });
    expect(versions.find((version) => version.catalogId === 'xbrl-mapping-catalog')).toMatchObject({
      source: 'd1', freshness: 'current',
    });
  });
});
