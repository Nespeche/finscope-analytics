export const EMBEDDED_CATALOG_IDS = Object.freeze([
  'accounting-profile-catalog',
  'xbrl-mapping-catalog',
  'metric-catalog',
  'insight-rule-catalog',
  'quality-model-catalog',
  'state-and-capability-catalog',
  'gateway-problem-details-catalog',
  'local-operation-issue-catalog',
  'acceptance-criteria-catalog',
] as const);

export type EmbeddedCatalogId = (typeof EMBEDDED_CATALOG_IDS)[number];
export type CatalogVersionSource = 'd1' | 'embedded';
export type CatalogVersionFreshness = 'current' | 'stale';
export type CatalogVersionStaleReason = 'd1_unavailable' | 'missing_active_pointer' | 'invalid_d1_row';

export interface CatalogVersionRecord {
  readonly catalogId: string;
  readonly version: string;
  readonly schemaId: string;
  readonly contentSha256: string;
  readonly publishedAt: string;
  readonly activatedAt: string;
  readonly source: CatalogVersionSource;
  readonly freshness: CatalogVersionFreshness;
  readonly staleReason?: CatalogVersionStaleReason;
}

export interface CatalogVersionDatabaseRow {
  readonly catalog_id: unknown;
  readonly version: unknown;
  readonly schema_id: unknown;
  readonly content_sha256: unknown;
  readonly published_at: unknown;
  readonly activated_at: unknown;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function embedded(
  catalogId: EmbeddedCatalogId,
  version: string,
  schemaId: string,
  contentSha256: string,
): CatalogVersionRecord {
  return Object.freeze({
    catalogId,
    version,
    schemaId,
    contentSha256,
    publishedAt: '2026-07-21T00:00:00Z',
    activatedAt: '2026-07-21T00:00:00Z',
    source: 'embedded' as const,
    freshness: 'current' as const,
  });
}

export const EMBEDDED_CATALOG_VERSIONS: Readonly<Record<EmbeddedCatalogId, CatalogVersionRecord>> = Object.freeze({
  'accounting-profile-catalog': embedded(
    'accounting-profile-catalog',
    '5.0.0',
    'https://finscope.local/schemas/accounting-profile-catalog.schema.json',
    '5806eabaf905d7355e597a03c0cb98d4fbec22d5e803024c3c67472c88b09086',
  ),
  'xbrl-mapping-catalog': embedded(
    'xbrl-mapping-catalog',
    '5.0.0',
    'https://finscope.local/schemas/xbrl-mapping-catalog.schema.json',
    '2b9d7db2c0191c66dbbea8fa1da833e492817b1b90be89588574b9c70733e9cb',
  ),
  'metric-catalog': embedded(
    'metric-catalog',
    '5.0.1',
    'https://finscope.local/schemas/metric-catalog.schema.json',
    '6e0459696fe641533fb39afc3a715e55c43f7e74c83c236c390cccb8484f42ed',
  ),
  'insight-rule-catalog': embedded(
    'insight-rule-catalog',
    '5.0.0',
    'https://finscope.local/schemas/insight-rule-catalog.schema.json',
    '2d6100b3ed8ecc9118f653d8bfa2b13d1605f8e1b2ad0723a0a1f21a17cd93aa',
  ),
  'quality-model-catalog': embedded(
    'quality-model-catalog',
    '5.0.0',
    'https://finscope.local/schemas/quality-model-catalog.schema.json',
    '39e89d4a8495dfcab57e0a2e7f078150d0d3c143b4892be54173202c30f11d0d',
  ),
  'state-and-capability-catalog': embedded(
    'state-and-capability-catalog',
    '5.0.0',
    'https://finscope.local/schemas/state-and-capability-catalog.schema.json',
    '073abd3e6e1dd04d32f8639a07be6d0393ada668418a98e08baf8a98e56d2c20',
  ),
  'gateway-problem-details-catalog': embedded(
    'gateway-problem-details-catalog',
    '5.0.0',
    'https://finscope.local/schemas/gateway-problem-details-catalog.schema.json',
    '1eae100f2b5f9e58e0b6e4cba994a687522a71367f856d57dec896b7de35c380',
  ),
  'local-operation-issue-catalog': embedded(
    'local-operation-issue-catalog',
    '5.0.0',
    'https://finscope.local/schemas/local-operation-issue-catalog.schema.json',
    '6fd37aad79cf35fd65a33fd794a1c40a6f29ad6be43820a81ef4dfc27f6b239a',
  ),
  'acceptance-criteria-catalog': embedded(
    'acceptance-criteria-catalog',
    '5.0.3',
    'https://finscope.local/schemas/acceptance-criteria-catalog.schema.json',
    '68dcfb7ecae46b116cda95123a9275cc2c44a566d32a839839df1604c36faf33',
  ),
});

export function isEmbeddedCatalogId(value: string): value is EmbeddedCatalogId {
  return (EMBEDDED_CATALOG_IDS as readonly string[]).includes(value);
}

export function parseCatalogVersionDatabaseRow(row: CatalogVersionDatabaseRow): CatalogVersionRecord | undefined {
  if (
    typeof row.catalog_id !== 'string'
    || row.catalog_id.length === 0
    || typeof row.version !== 'string'
    || !VERSION_PATTERN.test(row.version)
    || typeof row.schema_id !== 'string'
    || !row.schema_id.startsWith('https://finscope.local/schemas/')
    || typeof row.content_sha256 !== 'string'
    || !SHA256_PATTERN.test(row.content_sha256)
    || typeof row.published_at !== 'string'
    || !DATE_TIME_PATTERN.test(row.published_at)
    || typeof row.activated_at !== 'string'
    || !DATE_TIME_PATTERN.test(row.activated_at)
  ) {
    return undefined;
  }
  return Object.freeze({
    catalogId: row.catalog_id,
    version: row.version,
    schemaId: row.schema_id,
    contentSha256: row.content_sha256,
    publishedAt: row.published_at,
    activatedAt: row.activated_at,
    source: 'd1' as const,
    freshness: 'current' as const,
  });
}

export function embeddedCatalogVersion(
  catalogId: EmbeddedCatalogId,
  staleReason?: CatalogVersionStaleReason,
): CatalogVersionRecord {
  const value = EMBEDDED_CATALOG_VERSIONS[catalogId];
  if (staleReason === undefined) return value;
  return Object.freeze({
    ...value,
    freshness: 'stale' as const,
    staleReason,
  });
}
