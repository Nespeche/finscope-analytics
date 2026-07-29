import {
  embeddedCatalogVersion,
  isEmbeddedCatalogId,
  parseCatalogVersionDatabaseRow,
  type CatalogVersionDatabaseRow,
  type CatalogVersionRecord,
  type EmbeddedCatalogId,
} from '../../../../src/authority/catalog-version';
import type { D1CatalogDatabase } from '../index';

interface D1Result<T> {
  readonly results?: readonly T[];
}

interface D1PreparedStatement {
  bind(...values: readonly unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
}

function asPreparedStatement(value: unknown): D1PreparedStatement {
  if (
    typeof value !== 'object'
    || value === null
    || typeof (value as Partial<D1PreparedStatement>).bind !== 'function'
    || typeof (value as Partial<D1PreparedStatement>).all !== 'function'
  ) {
    throw new TypeError('INVALID_D1_PREPARED_STATEMENT');
  }
  return value as D1PreparedStatement;
}

function stableUniqueCatalogIds(values: readonly string[]): readonly EmbeddedCatalogId[] {
  const selected = new Set<EmbeddedCatalogId>();
  for (const value of values) {
    if (!isEmbeddedCatalogId(value)) throw new TypeError(`UNKNOWN_CATALOG_ID:${value}`);
    selected.add(value);
  }
  return Object.freeze([...selected].sort((left, right) => left.localeCompare(right, 'en')));
}

function fallback(
  catalogIds: readonly EmbeddedCatalogId[],
  reason: 'd1_unavailable' | 'missing_active_pointer' | 'invalid_d1_row',
): readonly CatalogVersionRecord[] {
  return Object.freeze(catalogIds.map((catalogId) => embeddedCatalogVersion(catalogId, reason)));
}

export const ACTIVE_CATALOG_VERSION_QUERY_PREFIX = `
SELECT
  p.catalog_id,
  v.version,
  v.schema_id,
  v.content_sha256,
  v.published_at,
  p.activated_at
FROM active_catalog_pointers AS p
INNER JOIN catalog_versions AS v
  ON v.catalog_id = p.catalog_id
 AND v.version = p.active_version
WHERE p.catalog_id IN (`.trim();

export class CatalogVersionRepository {
  constructor(readonly database: D1CatalogDatabase) {}

  async readActive(catalogIdsInput: readonly string[]): Promise<readonly CatalogVersionRecord[]> {
    const catalogIds = stableUniqueCatalogIds(catalogIdsInput);
    if (catalogIds.length === 0) return Object.freeze([]);

    const placeholders = catalogIds.map(() => '?').join(', ');
    const query = `${ACTIVE_CATALOG_VERSION_QUERY_PREFIX}${placeholders})\nORDER BY p.catalog_id ASC`;

    let rows: readonly CatalogVersionDatabaseRow[];
    try {
      const statement = asPreparedStatement(this.database.prepare(query)).bind(...catalogIds);
      const result = await statement.all<CatalogVersionDatabaseRow>();
      rows = result.results ?? Object.freeze([]);
    } catch {
      return fallback(catalogIds, 'd1_unavailable');
    }

    const parsedById = new Map<string, CatalogVersionRecord>();
    for (const row of rows) {
      const parsed = parseCatalogVersionDatabaseRow(row);
      if (parsed === undefined || !catalogIds.includes(parsed.catalogId as EmbeddedCatalogId)) {
        continue;
      }
      parsedById.set(parsed.catalogId, parsed);
    }

    return Object.freeze(catalogIds.map((catalogId) => {
      const parsed = parsedById.get(catalogId);
      if (parsed !== undefined) return parsed;
      const matchingRaw = rows.some((row) => row.catalog_id === catalogId);
      return embeddedCatalogVersion(
        catalogId,
        matchingRaw ? 'invalid_d1_row' : 'missing_active_pointer',
      );
    }));
  }
}
