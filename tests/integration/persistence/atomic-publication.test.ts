import { describe, expect, it } from 'vitest';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
  type FundamentalAnalysis,
  type FundamentalBundle,
} from '../../../src/domain/fundamental/types';
import type { FinScopeStoreName } from '../../../src/persistence/db-schema';
import {
  SnapshotRepository,
  type AtomicRepositoryStorage,
  type AtomicRepositoryTransaction,
  type RepositoryKey,
} from '../../../src/persistence/snapshot-repository';

interface Fixture { readonly fixtureId: string; readonly input: unknown }

type StoreMaps = Record<FinScopeStoreName, Map<string, unknown>>;

function keyText(key: RepositoryKey): string {
  return JSON.stringify(key);
}

function valueKey(storeName: FinScopeStoreName, value: unknown): RepositoryKey {
  const record = value as Record<string, unknown>;
  switch (storeName) {
    case 'fundamentalSnapshots': return String(record.snapshotId);
    case 'fundamentalBundles': return String(record.bundleId);
    case 'fundamentalAnalyses': return String(record.analysisId);
    case 'priceOverlays': return [String(record.overlayId), Number(record.overlayVersion)];
    case 'priceAnalyses': return String(record.analysisId);
    case 'activePointers': return [String(record.issuerCik), String(record.pointerKind)];
    case 'commitLog': return String(record.transactionId);
  }
}

function emptyStores(): StoreMaps {
  return {
    fundamentalSnapshots: new Map(), fundamentalBundles: new Map(), fundamentalAnalyses: new Map(),
    priceOverlays: new Map(), priceAnalyses: new Map(), activePointers: new Map(), commitLog: new Map(),
  };
}

class InMemoryAtomicStorage implements AtomicRepositoryStorage {
  readonly stores = emptyStores();
  failOnStore: FinScopeStoreName | undefined;

  async run<TResult>(
    _storeNames: readonly FinScopeStoreName[],
    _mode: IDBTransactionMode,
    operation: (transaction: AtomicRepositoryTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const draft = Object.fromEntries(
      Object.entries(this.stores).map(([name, values]) => [name, new Map(values)]),
    ) as StoreMaps;
    const transaction: AtomicRepositoryTransaction = {
      get: async <T>(storeName: FinScopeStoreName, key: RepositoryKey) => draft[storeName].get(keyText(key)) as T | undefined,
      getAll: async <T>(storeName: FinScopeStoreName) => [...draft[storeName].values()] as T[],
      add: async (storeName, value) => {
        if (this.failOnStore === storeName) throw new Error(`INJECTED_FAILURE:${storeName}`);
        const key = keyText(valueKey(storeName, value));
        if (draft[storeName].has(key)) throw new Error(`CONSTRAINT:${storeName}:${key}`);
        draft[storeName].set(key, value);
      },
      put: async (storeName, value) => {
        if (this.failOnStore === storeName) throw new Error(`INJECTED_FAILURE:${storeName}`);
        draft[storeName].set(keyText(valueKey(storeName, value)), value);
      },
      delete: async (storeName, key) => { draft[storeName].delete(keyText(key)); },
    };
    const result = await operation(transaction);
    for (const storeName of Object.keys(this.stores) as FinScopeStoreName[]) {
      this.stores[storeName] = draft[storeName];
    }
    return result;
  }
}

const bundleFixture = parseFundamentalBundle(
  (bundleVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures[0]?.input,
);
const analysisFixture = parseFundamentalAnalysis(
  (analysisVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures
    .find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);

function candidate(suffix: string, generation: number): Readonly<{
  snapshotId: string; bundle: FundamentalBundle; analysis: FundamentalAnalysis;
  expectedPointerGeneration: number; transactionId: string; committedAt: string;
}> {
  const bundle = parseFundamentalBundle({ ...bundleFixture, bundleId: `${bundleFixture.bundleId}-${suffix}` });
  const analysis = parseFundamentalAnalysis({ ...analysisFixture, analysisId: `${analysisFixture.analysisId}-${suffix}` });
  return {
    snapshotId: `fundamental-snapshot-${suffix}`,
    bundle,
    analysis,
    expectedPointerGeneration: generation,
    transactionId: `commit-fundamental-${suffix}`,
    committedAt: '2026-08-01T12:00:00.000Z',
  };
}

describe('atomic fundamental snapshot publication', () => {
  it('commits immutable candidate, evidence index and CAS pointer together', async () => {
    const storage = new InMemoryAtomicStorage();
    const repository = new SnapshotRepository(storage);

    const published = await repository.publish(candidate('a', 0));
    const active = await repository.readActive(published.snapshot.issuerCik);

    expect(active).toEqual(published);
    expect(published.pointer.generation).toBe(1);
    expect(published.commit.writtenRecordIds).toEqual([
      published.bundle.bundleId,
      published.analysis.analysisId,
      published.snapshot.snapshotId,
    ]);
    expect(storage.stores.fundamentalBundles.size).toBe(1);
    expect(storage.stores.fundamentalAnalyses.size).toBe(1);
    expect(storage.stores.fundamentalSnapshots.size).toBe(1);
    expect(storage.stores.commitLog.size).toBe(1);
    expect(storage.stores.activePointers.size).toBe(1);
  });

  it('rolls back every candidate write when pointer publication fails', async () => {
    const storage = new InMemoryAtomicStorage();
    const repository = new SnapshotRepository(storage);
    const first = await repository.publish(candidate('a', 0));

    storage.failOnStore = 'activePointers';
    await expect(repository.publish(candidate('b', 1))).rejects.toThrow('INJECTED_FAILURE:activePointers');
    storage.failOnStore = undefined;

    expect(await repository.readActive(first.snapshot.issuerCik)).toEqual(first);
    expect(storage.stores.fundamentalBundles.size).toBe(1);
    expect(storage.stores.fundamentalAnalyses.size).toBe(1);
    expect(storage.stores.fundamentalSnapshots.size).toBe(1);
    expect(storage.stores.commitLog.size).toBe(1);
  });

  it('rejects stale compare-and-swap without orphan records and preserves last valid snapshot', async () => {
    const storage = new InMemoryAtomicStorage();
    const repository = new SnapshotRepository(storage);
    const first = await repository.publish(candidate('a', 0));

    await expect(repository.publish(candidate('stale', 0)))
      .rejects.toThrow('FUNDAMENTAL_POINTER_COMPARE_AND_SWAP_FAILED');
    expect(await repository.readActive(first.snapshot.issuerCik)).toEqual(first);
    expect(storage.stores.fundamentalSnapshots.size).toBe(1);

    const second = await repository.publish(candidate('b', 1));
    expect(second.pointer.generation).toBe(2);
    expect((await repository.readActive(second.snapshot.issuerCik))?.snapshot.snapshotId)
      .toBe(second.snapshot.snapshotId);
  });
});
