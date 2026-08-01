import { describe, expect, it } from 'vitest';
import {
  applyHistoricalPriceDeletion,
  applyHistoricalPriceImport,
  applyHistoricalPriceReplacement,
  type PricePersistenceState,
} from '../../../src/domain/orchestration/price-events';
import {
  confirmHistoricalPriceImport,
  createHistoricalPriceImportPreview,
} from '../../../src/domain/price/import-preview';
import { parseHistoricalPriceOverlay, parsePriceAnalysis } from '../../../src/domain/price/types';
import { parseCik } from '../../../src/domain/model';
import type { FinScopeStoreName } from '../../../src/persistence/db-schema';
import { PriceRepository } from '../../../src/persistence/price-repository';
import type {
  AtomicRepositoryStorage,
  AtomicRepositoryTransaction,
  RepositoryKey,
} from '../../../src/persistence/snapshot-repository';

type StoreMaps = Record<FinScopeStoreName, Map<string, unknown>>;
const names: readonly FinScopeStoreName[] = [
  'fundamentalSnapshots', 'fundamentalBundles', 'fundamentalAnalyses', 'priceOverlays',
  'priceAnalyses', 'activePointers', 'commitLog',
];
const keyText = (key: RepositoryKey): string => JSON.stringify(key);
function recordKey(store: FinScopeStoreName, value: unknown): RepositoryKey {
  const row = value as Record<string, unknown>;
  if (store === 'fundamentalSnapshots') return String(row.snapshotId);
  if (store === 'fundamentalBundles') return String(row.bundleId);
  if (store === 'fundamentalAnalyses' || store === 'priceAnalyses') return String(row.analysisId);
  if (store === 'priceOverlays') return [String(row.overlayId), Number(row.overlayVersion)];
  if (store === 'activePointers') return [String(row.issuerCik), String(row.pointerKind)];
  return String(row.transactionId);
}
class MemoryStorage implements AtomicRepositoryStorage {
  readonly stores = Object.fromEntries(names.map((name) => [name, new Map<string, unknown>()])) as StoreMaps;
  failOn: FinScopeStoreName | undefined;
  async run<T>(
    _stores: readonly FinScopeStoreName[],
    _mode: IDBTransactionMode,
    operation: (transaction: AtomicRepositoryTransaction) => Promise<T>,
  ): Promise<T> {
    const draft = Object.fromEntries(names.map((name) => [name, new Map(this.stores[name])])) as StoreMaps;
    const tx: AtomicRepositoryTransaction = {
      get: async <R>(store: FinScopeStoreName, key: RepositoryKey) => draft[store].get(keyText(key)) as R | undefined,
      getAll: async <R>(store: FinScopeStoreName) => [...draft[store].values()] as R[],
      add: async (store, value) => {
        if (this.failOn === store) throw new Error(`INJECTED_FAILURE:${store}`);
        const key = keyText(recordKey(store, value));
        if (draft[store].has(key)) throw new Error(`CONSTRAINT:${store}`);
        draft[store].set(key, value);
      },
      put: async (store, value) => {
        if (this.failOn === store) throw new Error(`INJECTED_FAILURE:${store}`);
        draft[store].set(keyText(recordKey(store, value)), value);
      },
      delete: async (store, key) => { draft[store].delete(keyText(key)); },
    };
    const result = await operation(tx);
    for (const name of names) this.stores[name] = draft[name];
    return result;
  }
}

const cik = parseCik('0000320193');
const verifiedPriceQuality = Object.freeze({
  classification: 'verified' as const,
  axes: Object.freeze({
    rowValidity: 'all_valid' as const,
    dateIntegrity: 'unique_sorted' as const,
    currencyIntegrity: 'single_declared' as const,
    adjustmentDisclosure: 'declared' as const,
  }),
});
function overlay(version: number, character: string) {
  return parseHistoricalPriceOverlay({
    overlayId: 'price-overlay-0000320193-aapl', overlayVersion: version, contractVersion: '5.0.0',
    issuerCik: cik, instrument: { symbol: 'AAPL', venueMic: 'XNAS' }, currency: 'USD', frequency: 'monthly',
    observations: [{ date: '2025-01-31', priceDecimal: String(100 + version) }],
    adjustmentStatus: 'unadjusted', origin: { profileId: 'local_csv_manual_v1', method: 'manual_entry' },
    warnings: [], priceUse: 'historical_descriptive_only',
    historicalPriceOverlayFingerprint: `sha256:${character.repeat(64)}`,
    priceQuality: verifiedPriceQuality,
  });
}
function analysis(id: string, fingerprint: string, character: string) {
  return parsePriceAnalysis({
    analysisKind: 'historical_price_descriptive', analysisId: id, issuerCik: cik,
    historicalPriceOverlayFingerprint: fingerprint, priceQuality: verifiedPriceQuality, priceMetricResults: [],
    versions: { metricCatalog: '5.0.1' }, priceAnalysisFingerprint: `sha256:${character.repeat(64)}`,
  });
}
function initialState(): PricePersistenceState {
  return Object.freeze({
    fundamental: Object.freeze({ bundles: {}, analyses: {}, snapshots: {}, activeSnapshotPointers: {}, fingerprints: {} }),
    priceOverlays: Object.freeze({}), priceAnalyses: Object.freeze({}), activePricePointers: Object.freeze({}),
  });
}
function confirmation(candidate: ReturnType<typeof overlay>) {
  return confirmHistoricalPriceImport(createHistoricalPriceImportPreview({
    previewId: `preview-${candidate.overlayVersion}`,
    scope: {
      issuerCik: candidate.issuerCik, instrument: candidate.instrument, currency: candidate.currency,
      frequency: 'monthly', adjustmentStatus: 'unadjusted',
    },
    source: { method: 'manual_entry', profileId: 'local_csv_manual_v1' },
    observations: candidate.observations,
  }), true);
}

describe('independent price repository', () => {
  it('persists only confirmed immutable price events and advances its own CAS pointer', async () => {
    const storage = new MemoryStorage();
    const repository = new PriceRepository(storage);
    const firstOverlay = overlay(1, 'a');
    const firstAnalysis = analysis('price-analysis-1', firstOverlay.historicalPriceOverlayFingerprint, 'b');
    const imported = applyHistoricalPriceImport(initialState(), {
      overlay: firstOverlay, analysis: firstAnalysis, expectedPointerGeneration: 0,
    });
    const first = await repository.publishConfirmed({
      eventResult: imported, confirmation: confirmation(firstOverlay), expectedPointerGeneration: 0,
      transactionId: 'commit-price-1', committedAt: '2026-08-01T12:00:00.000Z',
    });
    expect(first.pointer.generation).toBe(1);

    const secondOverlay = overlay(2, 'c');
    const secondAnalysis = analysis('price-analysis-2', secondOverlay.historicalPriceOverlayFingerprint, 'd');
    const replaced = applyHistoricalPriceReplacement(imported.state, {
      overlay: secondOverlay, analysis: secondAnalysis, expectedPointerGeneration: 1,
    });
    const second = await repository.publishConfirmed({
      eventResult: replaced, confirmation: confirmation(secondOverlay), expectedPointerGeneration: 1,
      transactionId: 'commit-price-2',
    });
    expect(second.pointer.generation).toBe(2);
    expect(storage.stores.priceOverlays.size).toBe(2);
    expect(storage.stores.priceAnalyses.size).toBe(2);
  });

  it('rolls back failed price publication and rejects unconfirmed input', async () => {
    const storage = new MemoryStorage();
    const repository = new PriceRepository(storage);
    const candidateOverlay = overlay(1, 'a');
    const candidateAnalysis = analysis('price-analysis-1', candidateOverlay.historicalPriceOverlayFingerprint, 'b');
    const event = applyHistoricalPriceImport(initialState(), { overlay: candidateOverlay, analysis: candidateAnalysis });

    await expect(repository.publishConfirmed({
      eventResult: event,
      confirmation: { confirmed: false } as never,
      expectedPointerGeneration: 0,
      transactionId: 'unconfirmed',
    })).rejects.toThrow('PRICE_IMPORT_CONFIRMATION_REQUIRED');

    storage.failOn = 'activePointers';
    await expect(repository.publishConfirmed({
      eventResult: event, confirmation: confirmation(candidateOverlay), expectedPointerGeneration: 0,
      transactionId: 'commit-price-fail',
    })).rejects.toThrow('INJECTED_FAILURE:activePointers');
    expect(storage.stores.priceOverlays.size).toBe(0);
    expect(storage.stores.priceAnalyses.size).toBe(0);
    expect(storage.stores.commitLog.size).toBe(0);
  });

  it('deletes only price stores and never references or mutates fundamental records', async () => {
    const storage = new MemoryStorage();
    const fundamentalSentinel = Object.freeze({ id: 'fundamental-sentinel' });
    storage.stores.fundamentalBundles.set('sentinel', fundamentalSentinel);
    storage.stores.fundamentalAnalyses.set('sentinel', fundamentalSentinel);
    storage.stores.fundamentalSnapshots.set('sentinel', fundamentalSentinel);

    const repository = new PriceRepository(storage);
    const candidateOverlay = overlay(1, 'a');
    const candidateAnalysis = analysis('price-analysis-1', candidateOverlay.historicalPriceOverlayFingerprint, 'b');
    const imported = applyHistoricalPriceImport(initialState(), { overlay: candidateOverlay, analysis: candidateAnalysis });
    await repository.publishConfirmed({
      eventResult: imported, confirmation: confirmation(candidateOverlay), expectedPointerGeneration: 0,
      transactionId: 'commit-price-1',
    });
    const deleted = applyHistoricalPriceDeletion(imported.state, cik, 1);
    await repository.deleteConfirmed({
      eventResult: deleted, issuerCik: cik, expectedPointerGeneration: 1,
      transactionId: 'delete-price-1',
    });

    expect(storage.stores.priceOverlays.size).toBe(0);
    expect(storage.stores.priceAnalyses.size).toBe(0);
    expect(storage.stores.activePointers.size).toBe(0);
    expect(storage.stores.fundamentalBundles.get('sentinel')).toBe(fundamentalSentinel);
    expect(storage.stores.fundamentalAnalyses.get('sentinel')).toBe(fundamentalSentinel);
    expect(storage.stores.fundamentalSnapshots.get('sentinel')).toBe(fundamentalSentinel);
  });
});
