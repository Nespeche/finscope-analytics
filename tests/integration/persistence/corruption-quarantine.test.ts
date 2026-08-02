import { describe, expect, it } from 'vitest';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import {
  historicalPriceOverlayFingerprint,
  priceAnalysisFingerprint,
} from '../../../src/domain/fingerprints/fingerprint-service';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
} from '../../../src/domain/fundamental/types';
import { parseCik } from '../../../src/domain/model';
import { parseHistoricalPriceOverlay, parsePriceAnalysis } from '../../../src/domain/price/types';
import type { FinScopeStoreName } from '../../../src/persistence/db-schema';
import { CorruptionQuarantine } from '../../../src/persistence/indexeddb';
import { PriceRepository } from '../../../src/persistence/price-repository';
import {
  SnapshotRepository,
  type AtomicRepositoryStorage,
  type AtomicRepositoryTransaction,
  type RepositoryKey,
} from '../../../src/persistence/snapshot-repository';

interface Fixture { readonly fixtureId: string; readonly input: unknown }
type StoreMaps = Record<FinScopeStoreName, Map<string, unknown>>;
const storeNames: readonly FinScopeStoreName[] = [
  'fundamentalSnapshots', 'fundamentalBundles', 'fundamentalAnalyses', 'priceOverlays',
  'priceAnalyses', 'activePointers', 'commitLog',
];
const keyText = (key: RepositoryKey): string => JSON.stringify(key);
function rowKey(store: FinScopeStoreName, value: unknown): RepositoryKey {
  const row = value as Record<string, unknown>;
  switch (store) {
    case 'fundamentalSnapshots': return String(row.snapshotId);
    case 'fundamentalBundles': return String(row.bundleId);
    case 'fundamentalAnalyses': return String(row.analysisId);
    case 'priceOverlays': return [String(row.overlayId), Number(row.overlayVersion)];
    case 'priceAnalyses': return String(row.analysisId);
    case 'activePointers': return [String(row.issuerCik), String(row.pointerKind)];
    case 'commitLog': return String(row.transactionId);
  }
}
class MemoryStorage implements AtomicRepositoryStorage {
  stores = Object.fromEntries(storeNames.map((name) => [name, new Map<string, unknown>()])) as StoreMaps;
  async run<TResult>(
    _stores: readonly FinScopeStoreName[],
    _mode: IDBTransactionMode,
    operation: (transaction: AtomicRepositoryTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const draft = Object.fromEntries(storeNames.map((name) => [name, new Map(this.stores[name])])) as StoreMaps;
    const transaction: AtomicRepositoryTransaction = {
      get: async <T>(store, key) => draft[store].get(keyText(key)) as T | undefined,
      getAll: async <T>(store) => [...draft[store].values()] as T[],
      add: async (store, value) => { draft[store].set(keyText(rowKey(store, value)), value); },
      put: async (store, value) => { draft[store].set(keyText(rowKey(store, value)), value); },
      delete: async (store, key) => { draft[store].delete(keyText(key)); },
    };
    const result = await operation(transaction);
    this.stores = draft;
    return result;
  }
  seed(store: FinScopeStoreName, value: unknown): void {
    this.stores[store].set(keyText(rowKey(store, value)), value);
  }
}

const bundle = parseFundamentalBundle(
  (bundleVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures[0]?.input,
);
const analysis = parseFundamentalAnalysis(
  (analysisVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures
    .find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);

async function publishedFundamental() {
  const storage = new MemoryStorage();
  const quarantine = new CorruptionQuarantine();
  const repository = new SnapshotRepository(storage, quarantine);
  const published = await repository.publish({
    snapshotId: 'snapshot-integrity-1', bundle, analysis, expectedPointerGeneration: 0,
    transactionId: 'commit-integrity-1', committedAt: '2026-08-01T00:00:00.000Z',
  });
  return { storage, quarantine, repository, published };
}

async function seededPrice() {
  const storage = new MemoryStorage();
  const quarantine = new CorruptionQuarantine();
  const cik = parseCik('0000320193');
  const quality = {
    classification: 'verified' as const,
    axes: {
      rowValidity: 'all_valid', dateIntegrity: 'unique_sorted',
      currencyIntegrity: 'single_declared', adjustmentDisclosure: 'declared',
    },
  };
  const overlayInput = {
    overlayId: 'price-overlay-integrity', overlayVersion: 1, contractVersion: '5.0.0', issuerCik: cik,
    instrument: { symbol: 'AAPL', venueMic: 'XNAS' }, currency: 'USD', frequency: 'monthly',
    observations: [{ date: '2025-01-31', priceDecimal: '100' }], adjustmentStatus: 'unadjusted',
    origin: { profileId: 'local_csv_manual_v1', method: 'manual_entry' }, warnings: [],
    priceUse: 'historical_descriptive_only' as const, priceQuality: quality,
  };
  const overlay = parseHistoricalPriceOverlay({
    ...overlayInput,
    historicalPriceOverlayFingerprint: await historicalPriceOverlayFingerprint(overlayInput),
  });
  const analysisInput = {
    analysisKind: 'historical_price_descriptive' as const, analysisId: 'price-analysis-integrity', issuerCik: cik,
    historicalPriceOverlayFingerprint: overlay.historicalPriceOverlayFingerprint,
    priceQuality: quality, priceMetricResults: [], versions: { metricCatalog: '5.0.1' },
  };
  const priceAnalysis = parsePriceAnalysis({
    ...analysisInput,
    priceAnalysisFingerprint: await priceAnalysisFingerprint(analysisInput),
  });
  const pointer = {
    recordType: 'active_pointer', issuerCik: cik, pointerKind: 'price_overlay',
    targetId: `${overlay.overlayId}:${overlay.overlayVersion}`,
    targetFingerprint: overlay.historicalPriceOverlayFingerprint, generation: 1,
  } as const;
  const commit = {
    recordType: 'commit', transactionId: 'price-commit-integrity', issuerCik: cik,
    writtenRecordIds: [pointer.targetId, priceAnalysis.analysisId],
    pointerUpdates: [`${cik}:price_overlay`], status: 'committed',
  } as const;
  storage.seed('priceOverlays', overlay);
  storage.seed('priceAnalyses', priceAnalysis);
  storage.seed('activePointers', pointer);
  storage.seed('commitLog', commit);
  return { storage, quarantine, repository: new PriceRepository(storage, quarantine), overlay, cik };
}

describe('repository corruption quarantine', () => {
  it('quarantines canonical hash mismatches without deleting records or advancing the pointer', async () => {
    const { storage, quarantine, repository, published } = await publishedFundamental();
    const pointerBefore = structuredClone(published.pointer);
    storage.seed('fundamentalBundles', {
      ...published.bundle,
      fundamentalInputFingerprint: `sha256:${'f'.repeat(64)}`,
    });

    expect(await repository.readActive(published.snapshot.issuerCik)).toBeUndefined();
    expect(quarantine.list().map((entry) => entry.reason)).toContain('record_hash_mismatch');
    expect(storage.stores.fundamentalBundles.size).toBe(1);
    expect(storage.stores.fundamentalSnapshots.size).toBe(1);
    expect(storage.stores.activePointers.get(keyText([published.snapshot.issuerCik, 'fundamental_snapshot'])))
      .toEqual(pointerBefore);
  });

  it('quarantines schema mismatches and corrupt pointers deterministically without silent deletion', async () => {
    const first = await publishedFundamental();
    first.storage.seed('fundamentalAnalyses', { ...first.published.analysis, analysisKind: 'invalid' });
    await first.repository.readActive(first.published.snapshot.issuerCik);
    await first.repository.readActive(first.published.snapshot.issuerCik);
    const schemaEntries = first.quarantine.list().filter((entry) => entry.reason === 'schema_mismatch');
    expect(schemaEntries).toHaveLength(1);
    expect(first.storage.stores.fundamentalAnalyses.size).toBe(1);

    const second = await publishedFundamental();
    second.storage.seed('activePointers', {
      ...second.published.pointer,
      targetFingerprint: `sha256:${'e'.repeat(64)}`,
    });
    expect(await second.repository.readActive(second.published.snapshot.issuerCik)).toBeUndefined();
    expect(second.quarantine.list().map((entry) => entry.reason)).toContain('pointer_corrupt');
    expect(second.storage.stores.activePointers.size).toBe(1);
  });

  it('applies the same hash quarantine to historical price records', async () => {
    const { storage, quarantine, repository, overlay, cik } = await seededPrice();
    storage.seed('priceOverlays', {
      ...overlay,
      observations: [{ date: '2025-01-31', priceDecimal: '999' }],
    });

    expect(await repository.readActive(cik)).toBeUndefined();
    expect(quarantine.list().map((entry) => entry.reason)).toContain('record_hash_mismatch');
    expect(storage.stores.priceOverlays.size).toBe(1);
    expect(storage.stores.activePointers.size).toBe(1);
  });
});
