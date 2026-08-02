import { describe, expect, it } from 'vitest';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
} from '../../../src/domain/fundamental/types';
import type { FinScopeStoreName } from '../../../src/persistence/db-schema';
import { LocalExportService } from '../../../src/persistence/export-service';
import { RestorePreviewService } from '../../../src/persistence/restore-preview';
import { RestoreService, type RestoreAuthorization } from '../../../src/persistence/restore-service';
import type {
  ActivePointerRecord,
  AtomicRepositoryStorage,
  AtomicRepositoryTransaction,
  CommitRecord,
  FundamentalRepositoryRecords,
  FundamentalSnapshotRecord,
  RepositoryKey,
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
function emptyStores(): StoreMaps {
  return Object.fromEntries(storeNames.map((name) => [name, new Map<string, unknown>()])) as StoreMaps;
}
class MemoryStorage implements AtomicRepositoryStorage {
  stores = emptyStores();
  failOnStore: FinScopeStoreName | undefined;
  async run<TResult>(
    _stores: readonly FinScopeStoreName[],
    _mode: IDBTransactionMode,
    operation: (transaction: AtomicRepositoryTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const draft = Object.fromEntries(storeNames.map((name) => [name, new Map(this.stores[name])])) as StoreMaps;
    const transaction: AtomicRepositoryTransaction = {
      get: async <T>(store, key) => draft[store].get(keyText(key)) as T | undefined,
      getAll: async <T>(store) => [...draft[store].values()] as T[],
      add: async (store, value) => {
        if (this.failOnStore === store) throw new Error(`INJECTED_FAILURE:${store}`);
        const key = keyText(rowKey(store, value));
        if (draft[store].has(key)) throw new Error(`CONSTRAINT:${store}:${key}`);
        draft[store].set(key, value);
      },
      put: async (store, value) => {
        if (this.failOnStore === store) throw new Error(`INJECTED_FAILURE:${store}`);
        draft[store].set(keyText(rowKey(store, value)), value);
      },
      delete: async (store, key) => { draft[store].delete(keyText(key)); },
    };
    const result = await operation(transaction);
    this.stores = draft;
    return result;
  }
  snapshot(): string {
    return JSON.stringify(Object.fromEntries(storeNames.map((name) => [name, [...this.stores[name].entries()]])));
  }
}

const bundle = parseFundamentalBundle(
  (bundleVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures[0]?.input,
);
const analysis = parseFundamentalAnalysis(
  (analysisVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures
    .find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);
const snapshot: FundamentalSnapshotRecord = {
  recordType: 'fundamental_snapshot', snapshotId: 'restore-snapshot-1', issuerCik: bundle.issuer.cik,
  bundleId: bundle.bundleId, analysisId: analysis.analysisId,
  fundamentalInputFingerprint: bundle.fundamentalInputFingerprint,
  fundamentalAnalysisFingerprint: analysis.fundamentalAnalysisFingerprint,
  state: 'committed', createdAt: '2026-08-01T00:00:00.000Z',
};
const pointer: ActivePointerRecord = {
  recordType: 'active_pointer', issuerCik: bundle.issuer.cik, pointerKind: 'fundamental_snapshot',
  targetId: snapshot.snapshotId, targetFingerprint: snapshot.fundamentalAnalysisFingerprint,
  generation: 1, updatedAt: '2026-08-01T00:00:00.000Z',
};
const commit: CommitRecord = {
  recordType: 'commit', transactionId: 'restore-commit-1', issuerCik: bundle.issuer.cik,
  writtenRecordIds: [bundle.bundleId, analysis.analysisId, snapshot.snapshotId],
  pointerUpdates: [`${bundle.issuer.cik}:fundamental_snapshot`], status: 'committed',
  committedAt: '2026-08-01T00:00:00.000Z',
};
const fundamentalRecords: FundamentalRepositoryRecords = {
  snapshots: [snapshot], bundles: [bundle], analyses: [analysis], pointers: [pointer], commits: [commit],
};
const emptyPrice = { overlays: [], analyses: [], pointers: [], commits: [] } as const;

async function previewPackage() {
  const exporter = new LocalExportService(
    { readAllRecords: async () => fundamentalRecords },
    { readAllRecords: async () => emptyPrice },
    () => '2026-08-01T00:00:00.000Z',
  );
  const serialized = await exporter.serialize();
  return await new RestorePreviewService({ find: async () => undefined }).preview(serialized);
}

describe('atomic restore with rollback', () => {
  it('requires a validated preview authorization and restores every store atomically', async () => {
    const storage = new MemoryStorage();
    const service = new RestoreService(storage);
    await expect(service.restore({} as RestoreAuthorization)).rejects.toThrow('RESTORE_AUTHORIZATION_REQUIRED');

    const preview = await previewPackage();
    const authorization = service.authorize({
      preview, storageConsentGranted: true, explicitConfirmation: true, conflictPolicy: 'reject',
    });
    const result = await service.restore(authorization);

    expect(result.writtenRecords).toBe(5);
    expect(storage.stores.fundamentalBundles.size).toBe(1);
    expect(storage.stores.fundamentalAnalyses.size).toBe(1);
    expect(storage.stores.fundamentalSnapshots.size).toBe(1);
    expect(storage.stores.activePointers.size).toBe(1);
    expect(storage.stores.commitLog.size).toBe(1);
  });

  it('restores the exact prior database state when any store write fails', async () => {
    const storage = new MemoryStorage();
    storage.stores.fundamentalBundles.set(keyText('sentinel'), { bundleId: 'sentinel', untouched: true });
    const before = storage.snapshot();
    storage.failOnStore = 'activePointers';
    const service = new RestoreService(storage);
    const preview = await previewPackage();
    const authorization = service.authorize({
      preview, storageConsentGranted: true, explicitConfirmation: true, conflictPolicy: 'reject',
    });

    await expect(service.restore(authorization)).rejects.toThrow('INJECTED_FAILURE:activePointers');
    expect(storage.snapshot()).toBe(before);
  });

  it('does not allow restore without storage consent or explicit confirmation', async () => {
    const service = new RestoreService(new MemoryStorage());
    const preview = await previewPackage();
    expect(() => service.authorize({ preview, storageConsentGranted: false, explicitConfirmation: true }))
      .toThrow('RESTORE_STORAGE_CONSENT_REQUIRED');
    expect(() => service.authorize({ preview, storageConsentGranted: true, explicitConfirmation: false }))
      .toThrow('RESTORE_EXPLICIT_CONFIRMATION_REQUIRED');
  });
});
