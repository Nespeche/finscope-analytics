import type { Cik } from '../domain/model';
import { FIN_SCOPE_STORE_NAMES, type FinScopeStoreName } from './db-schema';
import type { LocalExportPackage } from './export-service';
import { LocalExportService } from './export-service';
import type {
  ActivePointerRecord,
  AtomicRepositoryStorage,
  AtomicRepositoryTransaction,
  CommitRecord,
  RepositoryKey,
} from './snapshot-repository';

const deleteAuthorizationBrand = Symbol('FinScopeDeleteAuthorization');

export interface DeleteAllPreparation {
  readonly preparationId: string;
  readonly recordCount: number;
  readonly preExportOffered: true;
  readonly backup?: LocalExportPackage;
  readonly [deleteAuthorizationBrand]: true;
}

export interface DeleteAllResult {
  readonly deletedRecords: number;
  readonly preparationId: string;
}

function keyForStoredValue(storeName: FinScopeStoreName, value: unknown): RepositoryKey {
  const row = value as Record<string, unknown>;
  switch (storeName) {
    case 'fundamentalSnapshots': return String(row.snapshotId);
    case 'fundamentalBundles': return String(row.bundleId);
    case 'fundamentalAnalyses': return String(row.analysisId);
    case 'priceOverlays': return [String(row.overlayId), Number(row.overlayVersion)];
    case 'priceAnalyses': return String(row.analysisId);
    case 'activePointers': return [String(row.issuerCik), String(row.pointerKind)];
    case 'commitLog': return String(row.transactionId);
  }
}

export class DeleteService {
  readonly #preparations = new WeakSet<object>();

  constructor(
    private readonly storage: AtomicRepositoryStorage,
    private readonly exportService: LocalExportService,
  ) {}

  async prepareDeleteAll(includeBackup: boolean): Promise<DeleteAllPreparation> {
    const backup = includeBackup ? await this.exportService.createPackage() : undefined;
    const counts = await this.storage.run(FIN_SCOPE_STORE_NAMES, 'readonly', async (transaction) => {
      let count = 0;
      for (const storeName of FIN_SCOPE_STORE_NAMES) {
        count += (await transaction.getAll<unknown>(storeName)).length;
      }
      return count;
    });
    const preparation = Object.freeze({
      preparationId: backup?.packageSha256 ?? `empty-delete:${counts}`,
      recordCount: counts,
      preExportOffered: true as const,
      ...(backup === undefined ? {} : { backup }),
      [deleteAuthorizationBrand]: true as const,
    });
    this.#preparations.add(preparation);
    return preparation;
  }

  async deleteAll(preparation: DeleteAllPreparation, explicitConfirmation: boolean): Promise<DeleteAllResult> {
    if (!this.#preparations.has(preparation) || preparation[deleteAuthorizationBrand] !== true) {
      throw new TypeError('DELETE_ALL_PREPARATION_REQUIRED');
    }
    if (!explicitConfirmation) throw new TypeError('DELETE_ALL_CONFIRMATION_REQUIRED');
    this.#preparations.delete(preparation);

    return await this.storage.run(FIN_SCOPE_STORE_NAMES, 'readwrite', async (transaction) => {
      let deletedRecords = 0;
      for (const storeName of FIN_SCOPE_STORE_NAMES) {
        const rows = await transaction.getAll<unknown>(storeName);
        deletedRecords += rows.length;
        if (transaction.clear !== undefined) {
          await transaction.clear(storeName);
          continue;
        }
        for (const row of rows) {
          await transaction.delete(storeName, keyForStoredValue(storeName, row));
        }
      }
      return Object.freeze({ deletedRecords, preparationId: preparation.preparationId });
    });
  }

  async deletePriceHistory(issuerCik: Cik): Promise<number> {
    const priceStores = ['priceOverlays', 'priceAnalyses', 'activePointers', 'commitLog'] as const;
    return await this.storage.run(priceStores, 'readwrite', async (transaction: AtomicRepositoryTransaction) => {
      const overlays = (await transaction.getAll<Record<string, unknown>>('priceOverlays'))
        .filter((row) => row.issuerCik === issuerCik);
      const analyses = (await transaction.getAll<Record<string, unknown>>('priceAnalyses'))
        .filter((row) => row.issuerCik === issuerCik);
      const pointers = (await transaction.getAll<ActivePointerRecord>('activePointers'))
        .filter((row) => row.issuerCik === issuerCik && row.pointerKind === 'price_overlay');
      const commits = (await transaction.getAll<CommitRecord>('commitLog'))
        .filter((row) => row.issuerCik === issuerCik
          && row.pointerUpdates.some((pointer) => pointer === `${issuerCik}:price_overlay`));

      let deleted = 0;
      for (const row of overlays) {
        await transaction.delete('priceOverlays', [String(row.overlayId), Number(row.overlayVersion)]);
        deleted += 1;
      }
      for (const row of analyses) {
        await transaction.delete('priceAnalyses', String(row.analysisId));
        deleted += 1;
      }
      for (const row of pointers) {
        await transaction.delete('activePointers', [row.issuerCik, row.pointerKind]);
        deleted += 1;
      }
      for (const row of commits) {
        await transaction.delete('commitLog', row.transactionId);
        deleted += 1;
      }
      return deleted;
    });
  }
}
