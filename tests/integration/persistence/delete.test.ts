import { describe, expect, it } from 'vitest';
import type { Cik } from '../../../src/domain/model';
import type { FinScopeStoreName } from '../../../src/persistence/db-schema';
import { DeleteService } from '../../../src/persistence/delete-service';
import { LocalExportService } from '../../../src/persistence/export-service';
import type {
  AtomicRepositoryStorage,
  AtomicRepositoryTransaction,
  RepositoryKey,
} from '../../../src/persistence/snapshot-repository';

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
function emptyStores(): StoreMaps {
  return Object.fromEntries(storeNames.map((name) => [name, new Map<string, unknown>()])) as StoreMaps;
}
class MemoryStorage implements AtomicRepositoryStorage {
  stores = emptyStores();
  failOnDeleteStore: FinScopeStoreName | undefined;
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
      delete: async (store, key) => {
        if (this.failOnDeleteStore === store) throw new Error(`INJECTED_DELETE_FAILURE:${store}`);
        draft[store].delete(keyText(key));
      },
    };
    const result = await operation(transaction);
    this.stores = draft;
    return result;
  }
  seed(store: FinScopeStoreName, value: unknown): void {
    this.stores[store].set(keyText(rowKey(store, value)), value);
  }
  snapshot(): string {
    return JSON.stringify(Object.fromEntries(storeNames.map((name) => [name, [...this.stores[name].entries()]])));
  }
}

const issuer = '0000320193' as Cik;
const fundamental = {
  snapshot: { recordType: 'fundamental_snapshot', snapshotId: 's1', issuerCik: issuer },
  bundle: { bundleId: 'b1', issuer: { cik: issuer } },
  analysis: { analysisId: 'fa1', issuerCik: issuer },
  pointer: { recordType: 'active_pointer', issuerCik: issuer, pointerKind: 'fundamental_snapshot', targetId: 's1' },
  commit: { recordType: 'commit', transactionId: 'fc1', issuerCik: issuer, pointerUpdates: [`${issuer}:fundamental_snapshot`] },
};
const price = {
  overlay: { overlayId: 'p1', overlayVersion: 1, issuerCik: issuer },
  analysis: { analysisId: 'pa1', issuerCik: issuer },
  pointer: { recordType: 'active_pointer', issuerCik: issuer, pointerKind: 'price_overlay', targetId: 'p1:1' },
  commit: { recordType: 'commit', transactionId: 'pc1', issuerCik: issuer, pointerUpdates: [`${issuer}:price_overlay`] },
};

function populatedStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  storage.seed('fundamentalSnapshots', fundamental.snapshot);
  storage.seed('fundamentalBundles', fundamental.bundle);
  storage.seed('fundamentalAnalyses', fundamental.analysis);
  storage.seed('activePointers', fundamental.pointer);
  storage.seed('commitLog', fundamental.commit);
  storage.seed('priceOverlays', price.overlay);
  storage.seed('priceAnalyses', price.analysis);
  storage.seed('activePointers', price.pointer);
  storage.seed('commitLog', price.commit);
  return storage;
}

function exportService(): LocalExportService {
  return new LocalExportService(
    { readAllRecords: async () => ({ snapshots: [], bundles: [], analyses: [], pointers: [], commits: [] }) },
    { readAllRecords: async () => ({ overlays: [], analyses: [], pointers: [], commits: [] }) },
    () => '2026-08-01T00:00:00.000Z',
  );
}

describe('personal data deletion transactions', () => {
  it('offers a pre-export and deletes all stores in one transaction', async () => {
    const storage = populatedStorage();
    const service = new DeleteService(storage, exportService());
    const preparation = await service.prepareDeleteAll(true);

    expect(preparation.preExportOffered).toBe(true);
    expect(preparation.backup).toBeDefined();
    expect(preparation.recordCount).toBe(9);

    const result = await service.deleteAll(preparation, true);
    expect(result.deletedRecords).toBe(9);
    expect(storeNames.every((name) => storage.stores[name].size === 0)).toBe(true);
  });

  it('rolls back delete-all exactly when one store fails', async () => {
    const storage = populatedStorage();
    const service = new DeleteService(storage, exportService());
    const preparation = await service.prepareDeleteAll(false);
    const before = storage.snapshot();
    storage.failOnDeleteStore = 'activePointers';

    await expect(service.deleteAll(preparation, true)).rejects.toThrow('INJECTED_DELETE_FAILURE:activePointers');
    expect(storage.snapshot()).toBe(before);
  });

  it('deletes price history while preserving every fundamental record', async () => {
    const storage = populatedStorage();
    const service = new DeleteService(storage, exportService());
    const fundamentalBefore = {
      snapshots: storage.stores.fundamentalSnapshots.size,
      bundles: storage.stores.fundamentalBundles.size,
      analyses: storage.stores.fundamentalAnalyses.size,
    };

    const deleted = await service.deletePriceHistory(issuer);

    expect(deleted).toBe(4);
    expect(storage.stores.priceOverlays.size).toBe(0);
    expect(storage.stores.priceAnalyses.size).toBe(0);
    expect([...storage.stores.activePointers.values()]).toEqual([fundamental.pointer]);
    expect([...storage.stores.commitLog.values()]).toEqual([fundamental.commit]);
    expect(storage.stores.fundamentalSnapshots.size).toBe(fundamentalBefore.snapshots);
    expect(storage.stores.fundamentalBundles.size).toBe(fundamentalBefore.bundles);
    expect(storage.stores.fundamentalAnalyses.size).toBe(fundamentalBefore.analyses);
  });

  it('requires preparation and explicit confirmation before delete-all', async () => {
    const service = new DeleteService(populatedStorage(), exportService());
    await expect(service.deleteAll({} as never, true)).rejects.toThrow('DELETE_ALL_PREPARATION_REQUIRED');
    const preparation = await service.prepareDeleteAll(false);
    await expect(service.deleteAll(preparation, false)).rejects.toThrow('DELETE_ALL_CONFIRMATION_REQUIRED');
  });
});
