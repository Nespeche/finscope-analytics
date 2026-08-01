import {
  FIN_SCOPE_DATABASE_NAME,
  FIN_SCOPE_DATABASE_VERSION,
  installFinScopeDatabaseSchema,
  type FinScopeStoreName,
} from './db-schema';

export class IndexedDbUnavailableError extends Error {
  constructor() {
    super('IndexedDB is unavailable in this runtime.');
    this.name = 'IndexedDbUnavailableError';
  }
}

export class IndexedDbBlockedError extends Error {
  constructor(readonly databaseName: string) {
    super(`Opening IndexedDB database ${databaseName} was blocked.`);
    this.name = 'IndexedDbBlockedError';
  }
}

export type RepositoryIntegrityFailure =
  | 'schema_mismatch'
  | 'record_hash_mismatch'
  | 'pointer_corrupt'
  | 'reference_missing'
  | 'commit_evidence_missing';

export interface QuarantinedRepositoryRecord {
  readonly quarantineId: string;
  readonly storeName: FinScopeStoreName;
  readonly recordKey: string;
  readonly reason: RepositoryIntegrityFailure;
  readonly message: string;
  readonly payload: unknown;
}

function deterministicKeyText(value: IDBValidKey | string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || value instanceof Date) return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (ArrayBuffer.isView(value)) {
    return JSON.stringify([...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)]);
  }
  if (value instanceof ArrayBuffer) return JSON.stringify([...new Uint8Array(value)]);
  return String(value);
}

/**
 * Session-local quarantine registry. Invalid persisted records remain untouched in IndexedDB,
 * but deterministic quarantine entries keep them out of active resolution and export.
 */
export class CorruptionQuarantine {
  readonly #entries = new Map<string, QuarantinedRepositoryRecord>();

  quarantine(input: Readonly<{
    storeName: FinScopeStoreName;
    recordKey: IDBValidKey | string;
    reason: RepositoryIntegrityFailure;
    message: string;
    payload: unknown;
  }>): QuarantinedRepositoryRecord {
    const key = deterministicKeyText(input.recordKey);
    const quarantineId = `${input.storeName}:${key}:${input.reason}`;
    const existing = this.#entries.get(quarantineId);
    if (existing !== undefined) return existing;
    const entry = Object.freeze({
      quarantineId,
      storeName: input.storeName,
      recordKey: key,
      reason: input.reason,
      message: input.message,
      payload: input.payload,
    });
    this.#entries.set(quarantineId, entry);
    return entry;
  }

  list(): readonly QuarantinedRepositoryRecord[] {
    return Object.freeze(
      [...this.#entries.values()].sort((left, right) => left.quarantineId.localeCompare(right.quarantineId, 'en')),
    );
  }

  has(storeName: FinScopeStoreName, recordKey: IDBValidKey | string): boolean {
    const prefix = `${storeName}:${deterministicKeyText(recordKey)}:`;
    return [...this.#entries.keys()].some((key) => key.startsWith(prefix));
  }

  clear(): void {
    this.#entries.clear();
  }
}

export function resolveIndexedDbFactory(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): IDBFactory {
  if (factory === undefined) {
    throw new IndexedDbUnavailableError();
  }
  return factory;
}

export function requestToPromise<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    }, { once: true });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed without an error object.'));
    }, { once: true });
  });
}

export function openFinScopeDatabase(
  factory?: IDBFactory,
): Promise<IDBDatabase> {
  const indexedDb = resolveIndexedDbFactory(factory);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(FIN_SCOPE_DATABASE_NAME, FIN_SCOPE_DATABASE_VERSION);
    let settled = false;

    request.addEventListener('upgradeneeded', (event) => {
      installFinScopeDatabaseSchema(request.result, event.oldVersion);
    });
    request.addEventListener('success', () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    }, { once: true });
    request.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('Opening the FinScope IndexedDB database failed.'));
    }, { once: true });
    request.addEventListener('blocked', () => {
      if (settled) return;
      settled = true;
      reject(new IndexedDbBlockedError(FIN_SCOPE_DATABASE_NAME));
    }, { once: true });
  });
}

export async function deleteFinScopeDatabase(factory?: IDBFactory): Promise<void> {
  const indexedDb = resolveIndexedDbFactory(factory);
  const request = indexedDb.deleteDatabase(FIN_SCOPE_DATABASE_NAME);
  await requestToPromise(request);
}

export async function runIndexedDbTransaction<TResult>(
  database: IDBDatabase,
  storeNames: FinScopeStoreName | readonly FinScopeStoreName[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => TResult | Promise<TResult>,
): Promise<TResult> {
  const normalizedStoreNames = typeof storeNames === 'string' ? [storeNames] : [...storeNames];
  if (normalizedStoreNames.length === 0) {
    throw new TypeError('At least one IndexedDB store is required.');
  }

  const transaction = database.transaction(normalizedStoreNames, mode);
  let operationSettled = false;
  let transactionCompleted = false;
  let operationResult: TResult | undefined;
  let operationError: unknown;
  let operationFailed = false;

  return new Promise<TResult>((resolve, reject) => {
    const finish = (): void => {
      if (!operationSettled || !transactionCompleted) return;
      if (operationFailed) {
        reject(operationError);
        return;
      }
      resolve(operationResult as TResult);
    };

    transaction.addEventListener('complete', () => {
      transactionCompleted = true;
      finish();
    }, { once: true });
    transaction.addEventListener('abort', () => {
      reject(transaction.error ?? operationError ?? new Error('IndexedDB transaction aborted.'));
    }, { once: true });
    transaction.addEventListener('error', () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    }, { once: true });

    Promise.resolve()
      .then(() => operation(transaction))
      .then((result) => {
        operationResult = result;
        operationSettled = true;
        finish();
      })
      .catch((error: unknown) => {
        operationError = error;
        operationFailed = true;
        operationSettled = true;
        try {
          transaction.abort();
        } catch {
          reject(error);
        }
      });
  });
}
