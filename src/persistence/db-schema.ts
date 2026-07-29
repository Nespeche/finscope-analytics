export const FIN_SCOPE_DATABASE_NAME = 'finscope_personal_v1';
export const FIN_SCOPE_DATABASE_VERSION = 1;

export const FIN_SCOPE_STORE_DEFINITIONS = Object.freeze([
  Object.freeze({
    storeId: 'fundamentalSnapshots',
    keyPath: 'snapshotId',
    immutable: true,
  }),
  Object.freeze({
    storeId: 'fundamentalBundles',
    keyPath: 'bundleId',
    immutable: true,
  }),
  Object.freeze({
    storeId: 'fundamentalAnalyses',
    keyPath: 'analysisId',
    immutable: true,
  }),
  Object.freeze({
    storeId: 'priceOverlays',
    keyPath: Object.freeze(['overlayId', 'overlayVersion'] as const),
    immutable: true,
  }),
  Object.freeze({
    storeId: 'priceAnalyses',
    keyPath: 'analysisId',
    immutable: true,
  }),
  Object.freeze({
    storeId: 'activePointers',
    keyPath: Object.freeze(['issuerCik', 'pointerKind'] as const),
    immutable: false,
  }),
  Object.freeze({
    storeId: 'commitLog',
    keyPath: 'transactionId',
    immutable: true,
  }),
] as const);

export type FinScopeStoreDefinition = typeof FIN_SCOPE_STORE_DEFINITIONS[number];
export type FinScopeStoreName = FinScopeStoreDefinition['storeId'];

export const FIN_SCOPE_STORE_NAMES: readonly FinScopeStoreName[] = Object.freeze(
  FIN_SCOPE_STORE_DEFINITIONS.map((definition) => definition.storeId),
);

export interface IndexedDbSchemaTarget {
  readonly objectStoreNames: DOMStringList;
  createObjectStore(
    name: string,
    optionalParameters?: IDBObjectStoreParameters,
  ): IDBObjectStore;
}

function containsStore(objectStoreNames: DOMStringList, storeName: string): boolean {
  return objectStoreNames.contains(storeName);
}

export function installFinScopeDatabaseSchema(
  database: IndexedDbSchemaTarget,
  oldVersion: number,
): void {
  if (!Number.isSafeInteger(oldVersion) || oldVersion < 0) {
    throw new TypeError(`Invalid IndexedDB oldVersion: ${oldVersion}`);
  }

  if (oldVersion >= FIN_SCOPE_DATABASE_VERSION) {
    return;
  }

  for (const definition of FIN_SCOPE_STORE_DEFINITIONS) {
    if (containsStore(database.objectStoreNames, definition.storeId)) {
      continue;
    }
    const keyPath = typeof definition.keyPath === 'string'
      ? definition.keyPath
      : [...definition.keyPath];
    database.createObjectStore(definition.storeId, { keyPath });
  }
}

export function assertFinScopeDatabaseSchema(database: Pick<IDBDatabase, 'objectStoreNames'>): void {
  const missingStores = FIN_SCOPE_STORE_NAMES.filter(
    (storeName) => !database.objectStoreNames.contains(storeName),
  );
  if (missingStores.length > 0) {
    throw new Error(`FIN_SCOPE_INDEXEDDB_SCHEMA_MISSING:${missingStores.join(',')}`);
  }
}
