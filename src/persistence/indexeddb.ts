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
