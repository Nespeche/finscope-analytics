import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

let database: DatabaseSync | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

function createDatabase(): DatabaseSync {
  database = new DatabaseSync(':memory:');
  return database;
}

describe('D1 catalog metadata migration', () => {
  it('applies cleanly and creates only compact public catalog metadata tables', async () => {
    const sql = await readFile('workers/sec-gateway/migrations/0001_catalog_metadata.sql', 'utf8');
    const db = createDatabase();
    db.exec(sql);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all().map((row) => String(row.name));
    expect(tables).toEqual(['active_catalog_pointers', 'catalog_versions']);

    const columns = tables.flatMap((table) => db.prepare(`PRAGMA table_info(${table})`).all()
      .map((row) => `${table}.${String(row.name)}`));
    expect(columns).toEqual(expect.arrayContaining([
      'catalog_versions.catalog_id',
      'catalog_versions.version',
      'catalog_versions.schema_id',
      'catalog_versions.content_sha256',
      'catalog_versions.published_at',
      'active_catalog_pointers.catalog_id',
      'active_catalog_pointers.active_version',
      'active_catalog_pointers.activated_at',
    ]));

    for (const prohibited of [
      'user',
      'email',
      'portfolio',
      'snapshot',
      'issuer_fact',
      'sec_payload',
      'raw_payload',
      'analysis_result',
      'price_observation',
    ]) {
      expect(columns.join('\n').toLowerCase()).not.toContain(prohibited);
    }
  });

  it('indexes version lookups and enforces immutable catalog versions', async () => {
    const sql = await readFile('workers/sec-gateway/migrations/0001_catalog_metadata.sql', 'utf8');
    const db = createDatabase();
    db.exec(sql);

    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all().map((row) => String(row.name));
    expect(indexes).toEqual([
      'active_catalog_pointers_by_version',
      'catalog_versions_by_published_at',
    ]);

    const insertVersion = db.prepare(`
      INSERT INTO catalog_versions (catalog_id, version, schema_id, content_sha256, published_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertVersion.run(
      'metric-catalog',
      '5.0.0',
      'https://finscope.local/schemas/metric-catalog.schema.json',
      'a'.repeat(64),
      '2026-07-22T00:00:00Z',
    );
    db.prepare(`
      INSERT INTO active_catalog_pointers (catalog_id, active_version, activated_at)
      VALUES (?, ?, ?)
    `).run('metric-catalog', '5.0.0', '2026-07-22T00:00:01Z');

    expect(() => db.exec("UPDATE catalog_versions SET version = '5.0.1' WHERE catalog_id = 'metric-catalog'"))
      .toThrow(/immutable/u);
    expect(() => db.exec("DELETE FROM catalog_versions WHERE catalog_id = 'metric-catalog'"))
      .toThrow(/immutable|FOREIGN KEY/u);
  });
});
