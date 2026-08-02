import type { JsonObject } from '../core/canonical-json';
import { FIN_SCOPE_STORE_NAMES, type FinScopeStoreName } from './db-schema';
import type { LocalExportRecord, LocalExportRecordKind } from './export-service';
import type { RestorePreview } from './restore-preview';
import type {
  AtomicRepositoryStorage,
  AtomicRepositoryTransaction,
  RepositoryKey,
} from './snapshot-repository';

export type RestoreConflictPolicy = 'reject' | 'replace_matching_record_ids';

const authorizationBrand = Symbol('FinScopeRestoreAuthorization');

export interface RestoreAuthorization {
  readonly preview: RestorePreview;
  readonly conflictPolicy: RestoreConflictPolicy;
  readonly storageConsentGranted: true;
  readonly explicitConfirmation: true;
  readonly [authorizationBrand]: true;
}

export interface RestoreResult {
  readonly previewId: string;
  readonly writtenRecords: number;
  readonly replacedRecords: number;
  readonly migrationApplied?: 'local-export-1.0-to-1.1';
}

const STORE_BY_KIND = Object.freeze({
  fundamentalSnapshot: 'fundamentalSnapshots',
  fundamentalBundle: 'fundamentalBundles',
  fundamentalAnalysis: 'fundamentalAnalyses',
  historicalPriceOverlay: 'priceOverlays',
  priceAnalysis: 'priceAnalyses',
  activePointer: 'activePointers',
  commitRecord: 'commitLog',
} satisfies Record<LocalExportRecordKind, FinScopeStoreName>);

const RESTORE_WRITE_ORDER = Object.freeze([
  'fundamentalBundle',
  'fundamentalAnalysis',
  'fundamentalSnapshot',
  'historicalPriceOverlay',
  'priceAnalysis',
  'commitRecord',
  'activePointer',
] as const satisfies readonly LocalExportRecordKind[]);

function asObject(record: LocalExportRecord): JsonObject {
  if (record.payload === null || Array.isArray(record.payload) || typeof record.payload !== 'object') {
    throw new TypeError(`RESTORE_INVALID_PREVIEW_PAYLOAD:${record.recordKind}:${record.recordId}`);
  }
  return record.payload as JsonObject;
}

function keyForRecord(record: LocalExportRecord): RepositoryKey {
  const payload = asObject(record);
  switch (record.recordKind) {
    case 'fundamentalSnapshot': return String(payload.snapshotId);
    case 'fundamentalBundle': return String(payload.bundleId);
    case 'fundamentalAnalysis': return String(payload.analysisId);
    case 'historicalPriceOverlay': return [String(payload.overlayId), Number(payload.overlayVersion)];
    case 'priceAnalysis': return String(payload.analysisId);
    case 'activePointer': return [String(payload.issuerCik), String(payload.pointerKind)];
    case 'commitRecord': return String(payload.transactionId);
  }
}

function assertPreview(preview: RestorePreview): void {
  if (preview.valid !== true
    || preview.explicitConfirmationRequired !== true
    || preview.previewId !== preview.packageSha256
    || preview.estimatedWrites !== preview.records.length
    || preview.incompatibleRecords.length !== 0) {
    throw new TypeError('RESTORE_VALIDATED_PREVIEW_REQUIRED');
  }
  if (preview.migrationPlan !== undefined
    && (preview.migrationPlan.migrationId !== 'local-export-1.0-to-1.1'
      || preview.migrationPlan.targetVersion !== preview.targetFormatVersion)) {
    throw new TypeError('RESTORE_MIGRATION_NOT_ALLOWED');
  }
}

function sortedRecords(records: readonly LocalExportRecord[]): readonly LocalExportRecord[] {
  const order = new Map(RESTORE_WRITE_ORDER.map((kind, index) => [kind, index]));
  return Object.freeze([...records].sort((left, right) => (
    (order.get(left.recordKind) ?? 99) - (order.get(right.recordKind) ?? 99)
    || left.recordId.localeCompare(right.recordId, 'en')
  )));
}

export class RestoreService {
  readonly #authorizations = new WeakSet<object>();

  constructor(private readonly storage: AtomicRepositoryStorage) {}

  authorize(input: Readonly<{
    preview: RestorePreview;
    storageConsentGranted: boolean;
    explicitConfirmation: boolean;
    conflictPolicy?: RestoreConflictPolicy;
  }>): RestoreAuthorization {
    assertPreview(input.preview);
    if (!input.storageConsentGranted) throw new TypeError('RESTORE_STORAGE_CONSENT_REQUIRED');
    if (!input.explicitConfirmation) throw new TypeError('RESTORE_EXPLICIT_CONFIRMATION_REQUIRED');
    const conflictPolicy = input.conflictPolicy ?? 'reject';
    if (input.preview.conflicts.length > 0 && conflictPolicy === 'reject') {
      throw new TypeError('RESTORE_CONFLICT_POLICY_REQUIRED');
    }
    if (input.preview.conflicts.some((conflict) => conflict.recordId.length === 0)) {
      throw new TypeError('RESTORE_INVALID_CONFLICT_PREVIEW');
    }
    const authorization = Object.freeze({
      preview: input.preview,
      conflictPolicy,
      storageConsentGranted: true as const,
      explicitConfirmation: true as const,
      [authorizationBrand]: true as const,
    });
    this.#authorizations.add(authorization);
    return authorization;
  }

  async restore(authorization: RestoreAuthorization): Promise<RestoreResult> {
    if (!this.#authorizations.has(authorization) || authorization[authorizationBrand] !== true) {
      throw new TypeError('RESTORE_AUTHORIZATION_REQUIRED');
    }
    this.#authorizations.delete(authorization);
    assertPreview(authorization.preview);

    const conflicts = new Set(
      authorization.preview.conflicts.map((conflict) => `${conflict.recordKind}:${conflict.recordId}`),
    );
    const records = sortedRecords(authorization.preview.records);
    let replacedRecords = 0;

    const result = await this.storage.run(
      FIN_SCOPE_STORE_NAMES,
      'readwrite',
      async (transaction: AtomicRepositoryTransaction) => {
        for (const record of records) {
          const storeName = STORE_BY_KIND[record.recordKind];
          const key = keyForRecord(record);
          const conflict = conflicts.has(`${record.recordKind}:${record.recordId}`);
          const existing = await transaction.get<unknown>(storeName, key);
          if (existing !== undefined && !conflict) {
            throw new TypeError(`RESTORE_PREVIEW_STALE_CONFLICT:${record.recordKind}:${record.recordId}`);
          }
          if (conflict && authorization.conflictPolicy !== 'replace_matching_record_ids') {
            throw new TypeError(`RESTORE_CONFLICT_REJECTED:${record.recordKind}:${record.recordId}`);
          }
          if (existing === undefined) {
            await transaction.add(storeName, record.payload);
          } else {
            await transaction.put(storeName, record.payload);
            replacedRecords += 1;
          }
        }
        return Object.freeze({
          previewId: authorization.preview.previewId,
          writtenRecords: records.length,
          replacedRecords,
          ...(authorization.preview.migrationPlan === undefined
            ? {}
            : { migrationApplied: authorization.preview.migrationPlan.migrationId }),
        });
      },
    );
    return result;
  }
}
