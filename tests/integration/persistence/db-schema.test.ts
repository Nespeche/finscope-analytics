import { describe, expect, it, vi } from 'vitest';
import browserStorageContract from '../../../specs/001-fundamental-analysis-platform/contracts/browser-storage-contract.json';
import {
  FIN_SCOPE_DATABASE_NAME,
  FIN_SCOPE_DATABASE_VERSION,
  FIN_SCOPE_STORE_DEFINITIONS,
  FIN_SCOPE_STORE_NAMES,
  installFinScopeDatabaseSchema,
} from '../../../src/persistence/db-schema';
import { createConsentRepository } from '../../../src/persistence/consent-repository';

class FakeDomStringList implements DOMStringList {
  readonly #values: string[];

  constructor(values: readonly string[] = []) {
    this.#values = [...values];
  }

  get length(): number {
    return this.#values.length;
  }

  item(index: number): string | null {
    return this.#values[index] ?? null;
  }

  contains(value: string): boolean {
    return this.#values.includes(value);
  }

  [index: number]: string;

  [Symbol.iterator](): ArrayIterator<string> {
    return this.#values[Symbol.iterator]();
  }
}

describe('FinScope IndexedDB schema', () => {
  it('matches the active browser-storage authority exactly', () => {
    expect(FIN_SCOPE_DATABASE_NAME).toBe(browserStorageContract.databaseName);
    expect(FIN_SCOPE_DATABASE_VERSION).toBe(1);
    expect(FIN_SCOPE_STORE_NAMES).toEqual(
      browserStorageContract.stores.map((store) => store.storeId),
    );
    expect(FIN_SCOPE_STORE_DEFINITIONS.map(({ storeId, keyPath, immutable }) => ({
      storeId,
      keyPath,
      immutable,
    }))).toEqual(browserStorageContract.stores.map(({ storeId, keyPath, immutable }) => ({
      storeId,
      keyPath,
      immutable,
    })));
  });

  it('creates every missing native object store once', () => {
    const created: Array<{ name: string; keyPath: IDBObjectStoreParameters['keyPath'] }> = [];
    const target = {
      objectStoreNames: new FakeDomStringList(),
      createObjectStore: vi.fn((name: string, options?: IDBObjectStoreParameters) => {
        created.push({ name, keyPath: options?.keyPath });
        return {} as IDBObjectStore;
      }),
    };

    installFinScopeDatabaseSchema(target, 0);

    expect(created).toEqual(FIN_SCOPE_STORE_DEFINITIONS.map((definition) => ({
      name: definition.storeId,
      keyPath: definition.keyPath,
    })));
  });
});

describe('separate in-memory consent records', () => {
  it('defaults both records to false without opening storage', async () => {
    const repository = createConsentRepository();
    const persistentWrite = vi.fn(() => 'stored');
    const lifecycleRefresh = vi.fn(() => 'network');

    expect(repository.snapshot()).toEqual({
      refreshConsent: { kind: 'refreshConsent', granted: false, revision: 0 },
      storageConsent: { kind: 'storageConsent', granted: false, revision: 0 },
    });
    await expect(repository.runPersistentWrite(persistentWrite)).resolves.toEqual({
      mode: 'memory_only',
      value: undefined,
    });
    await expect(repository.runLifecycleRefresh(lifecycleRefresh)).resolves.toEqual({
      mode: 'local_only',
      value: undefined,
    });
    expect(persistentWrite).not.toHaveBeenCalled();
    expect(lifecycleRefresh).not.toHaveBeenCalled();
  });

  it('revokes refresh and storage consent independently', () => {
    const repository = createConsentRepository();

    repository.grantRefreshConsent();
    repository.grantStorageConsent();
    repository.revokeRefreshConsent();

    expect(repository.read('refreshConsent')).toEqual({
      kind: 'refreshConsent',
      granted: false,
      revision: 2,
    });
    expect(repository.read('storageConsent')).toEqual({
      kind: 'storageConsent',
      granted: true,
      revision: 1,
    });

    repository.revokeStorageConsent();
    expect(repository.read('storageConsent')).toEqual({
      kind: 'storageConsent',
      granted: false,
      revision: 2,
    });
  });
});
