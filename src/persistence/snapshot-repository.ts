import type { Sha256Digest } from '../core/sha256';
import {
  fundamentalAnalysisFingerprint,
  fundamentalInputFingerprint,
} from '../domain/fingerprints/fingerprint-service';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
  type FundamentalAnalysis,
  type FundamentalBundle,
} from '../domain/fundamental/types';
import type { Cik } from '../domain/model';
import type { FinScopeStoreName } from './db-schema';
import {
  CorruptionQuarantine,
  requestToPromise,
  runIndexedDbTransaction,
  type QuarantinedRepositoryRecord,
  type RepositoryIntegrityFailure,
} from './indexeddb';

export type RepositoryKey = IDBValidKey;

export interface AtomicRepositoryTransaction {
  get<T>(storeName: FinScopeStoreName, key: RepositoryKey): Promise<T | undefined>;
  getAll<T>(storeName: FinScopeStoreName): Promise<readonly T[]>;
  add(storeName: FinScopeStoreName, value: unknown): Promise<void>;
  put(storeName: FinScopeStoreName, value: unknown): Promise<void>;
  delete(storeName: FinScopeStoreName, key: RepositoryKey): Promise<void>;
  clear?(storeName: FinScopeStoreName): Promise<void>;
}

export interface AtomicRepositoryStorage {
  run<TResult>(
    storeNames: readonly FinScopeStoreName[],
    mode: IDBTransactionMode,
    operation: (transaction: AtomicRepositoryTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export function createIndexedDbRepositoryStorage(database: IDBDatabase): AtomicRepositoryStorage {
  return Object.freeze({
    async run<TResult>(
      storeNames: readonly FinScopeStoreName[],
      mode: IDBTransactionMode,
      operation: (transaction: AtomicRepositoryTransaction) => Promise<TResult>,
    ): Promise<TResult> {
      return await runIndexedDbTransaction(database, storeNames, mode, async (nativeTransaction) => {
        const adapter: AtomicRepositoryTransaction = Object.freeze({
          async get<T>(storeName: FinScopeStoreName, key: RepositoryKey): Promise<T | undefined> {
            return await requestToPromise(nativeTransaction.objectStore(storeName).get(key)) as T | undefined;
          },
          async getAll<T>(storeName: FinScopeStoreName): Promise<readonly T[]> {
            return await requestToPromise(nativeTransaction.objectStore(storeName).getAll()) as readonly T[];
          },
          async add(storeName: FinScopeStoreName, value: unknown): Promise<void> {
            await requestToPromise(nativeTransaction.objectStore(storeName).add(value));
          },
          async put(storeName: FinScopeStoreName, value: unknown): Promise<void> {
            await requestToPromise(nativeTransaction.objectStore(storeName).put(value));
          },
          async delete(storeName: FinScopeStoreName, key: RepositoryKey): Promise<void> {
            await requestToPromise(nativeTransaction.objectStore(storeName).delete(key));
          },
          async clear(storeName: FinScopeStoreName): Promise<void> {
            await requestToPromise(nativeTransaction.objectStore(storeName).clear());
          },
        });
        return await operation(adapter);
      });
    },
  });
}

export interface FundamentalSnapshotRecord {
  readonly recordType: 'fundamental_snapshot';
  readonly snapshotId: string;
  readonly issuerCik: Cik;
  readonly bundleId: string;
  readonly analysisId: string;
  readonly fundamentalInputFingerprint: Sha256Digest;
  readonly fundamentalAnalysisFingerprint: Sha256Digest;
  readonly state: 'committed';
  readonly createdAt?: string;
}

export interface ActivePointerRecord {
  readonly recordType: 'active_pointer';
  readonly issuerCik: Cik;
  readonly pointerKind: 'fundamental_snapshot' | 'price_overlay';
  readonly targetId: string;
  readonly targetFingerprint: Sha256Digest;
  readonly generation: number;
  readonly updatedAt?: string;
}

export interface CommitRecord {
  readonly recordType: 'commit';
  readonly transactionId: string;
  readonly issuerCik: Cik;
  readonly writtenRecordIds: readonly string[];
  readonly pointerUpdates: readonly string[];
  readonly status: 'committed';
  readonly committedAt?: string;
}

export interface FundamentalSnapshotCandidate {
  readonly snapshotId: string;
  readonly bundle: FundamentalBundle;
  readonly analysis: FundamentalAnalysis;
  readonly expectedPointerGeneration: number;
  readonly transactionId: string;
  readonly committedAt?: string;
}

export interface PublishedFundamentalSnapshot {
  readonly snapshot: FundamentalSnapshotRecord;
  readonly bundle: FundamentalBundle;
  readonly analysis: FundamentalAnalysis;
  readonly pointer: ActivePointerRecord;
  readonly commit: CommitRecord;
}

export interface FundamentalRepositoryRecords {
  readonly snapshots: readonly FundamentalSnapshotRecord[];
  readonly bundles: readonly FundamentalBundle[];
  readonly analyses: readonly FundamentalAnalysis[];
  readonly pointers: readonly ActivePointerRecord[];
  readonly commits: readonly CommitRecord[];
}

const FUNDAMENTAL_TRANSACTION_STORES = Object.freeze([
  'fundamentalBundles',
  'fundamentalAnalyses',
  'fundamentalSnapshots',
  'activePointers',
  'commitLog',
] as const satisfies readonly FinScopeStoreName[]);

function requireNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(code);
  return normalized;
}

function requireGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('INVALID_EXPECTED_POINTER_GENERATION');
  }
  return value;
}

function pointerKey(issuerCik: Cik): [Cik, 'fundamental_snapshot'] {
  return [issuerCik, 'fundamental_snapshot'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDigest(value: unknown): value is Sha256Digest {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function parsePointerRecord(value: unknown): ActivePointerRecord {
  if (!isRecord(value)
    || value.recordType !== 'active_pointer'
    || typeof value.issuerCik !== 'string'
    || (value.pointerKind !== 'fundamental_snapshot' && value.pointerKind !== 'price_overlay')
    || typeof value.targetId !== 'string'
    || value.targetId.length === 0
    || !isDigest(value.targetFingerprint)
    || !Number.isSafeInteger(value.generation)
    || Number(value.generation) < 1) {
    throw new TypeError('INVALID_ACTIVE_POINTER_RECORD');
  }
  return value as unknown as ActivePointerRecord;
}

function parseSnapshotRecord(value: unknown): FundamentalSnapshotRecord {
  if (!isRecord(value)
    || value.recordType !== 'fundamental_snapshot'
    || typeof value.snapshotId !== 'string'
    || value.snapshotId.length === 0
    || typeof value.issuerCik !== 'string'
    || typeof value.bundleId !== 'string'
    || typeof value.analysisId !== 'string'
    || !isDigest(value.fundamentalInputFingerprint)
    || !isDigest(value.fundamentalAnalysisFingerprint)
    || value.state !== 'committed') {
    throw new TypeError('INVALID_FUNDAMENTAL_SNAPSHOT_RECORD');
  }
  return value as unknown as FundamentalSnapshotRecord;
}

function parseCommitRecord(value: unknown): CommitRecord {
  if (!isRecord(value)
    || value.recordType !== 'commit'
    || typeof value.transactionId !== 'string'
    || typeof value.issuerCik !== 'string'
    || !Array.isArray(value.writtenRecordIds)
    || !value.writtenRecordIds.every((entry) => typeof entry === 'string')
    || !Array.isArray(value.pointerUpdates)
    || !value.pointerUpdates.every((entry) => typeof entry === 'string')
    || value.status !== 'committed') {
    throw new TypeError('INVALID_COMMIT_RECORD');
  }
  return value as unknown as CommitRecord;
}

function validateCandidate(candidate: FundamentalSnapshotCandidate): Readonly<{
  snapshotId: string;
  transactionId: string;
  bundle: FundamentalBundle;
  analysis: FundamentalAnalysis;
  expectedPointerGeneration: number;
}> {
  const bundle = parseFundamentalBundle(candidate.bundle);
  const analysis = parseFundamentalAnalysis(candidate.analysis);
  const snapshotId = requireNonEmpty(candidate.snapshotId, 'FUNDAMENTAL_SNAPSHOT_ID_REQUIRED');
  const transactionId = requireNonEmpty(candidate.transactionId, 'FUNDAMENTAL_TRANSACTION_ID_REQUIRED');
  const expectedPointerGeneration = requireGeneration(candidate.expectedPointerGeneration);

  if (analysis.issuerCik !== bundle.issuer.cik) {
    throw new TypeError('FUNDAMENTAL_ANALYSIS_ISSUER_MISMATCH');
  }
  if (analysis.fundamentalInputFingerprint !== bundle.fundamentalInputFingerprint) {
    throw new TypeError('FUNDAMENTAL_INPUT_FINGERPRINT_MISMATCH');
  }

  return Object.freeze({ snapshotId, transactionId, bundle, analysis, expectedPointerGeneration });
}

function quarantineFailure(
  quarantine: CorruptionQuarantine,
  storeName: FinScopeStoreName,
  recordKey: RepositoryKey,
  reason: RepositoryIntegrityFailure,
  message: string,
  payload: unknown,
): undefined {
  quarantine.quarantine({ storeName, recordKey, reason, message, payload });
  return undefined;
}

export class SnapshotRepository {
  constructor(
    private readonly storage: AtomicRepositoryStorage,
    private readonly quarantine: CorruptionQuarantine = new CorruptionQuarantine(),
  ) {}

  listQuarantinedRecords(): readonly QuarantinedRepositoryRecord[] {
    return this.quarantine.list().filter((entry) => (
      entry.storeName === 'fundamentalBundles'
      || entry.storeName === 'fundamentalAnalyses'
      || entry.storeName === 'fundamentalSnapshots'
      || entry.storeName === 'activePointers'
      || entry.storeName === 'commitLog'
    ));
  }

  async publish(candidate: FundamentalSnapshotCandidate): Promise<PublishedFundamentalSnapshot> {
    const validated = validateCandidate(candidate);
    const issuerCik = validated.bundle.issuer.cik;
    const [inputHash, analysisHash] = await Promise.all([
      fundamentalInputFingerprint(validated.bundle),
      fundamentalAnalysisFingerprint(validated.analysis),
    ]);
    if (inputHash !== validated.bundle.fundamentalInputFingerprint) {
      throw new TypeError('FUNDAMENTAL_BUNDLE_HASH_MISMATCH');
    }
    if (analysisHash !== validated.analysis.fundamentalAnalysisFingerprint) {
      throw new TypeError('FUNDAMENTAL_ANALYSIS_HASH_MISMATCH');
    }

    return await this.storage.run(
      FUNDAMENTAL_TRANSACTION_STORES,
      'readwrite',
      async (transaction) => {
        const existingPointerRaw = await transaction.get<unknown>('activePointers', pointerKey(issuerCik));
        let existingPointer: ActivePointerRecord | undefined;
        if (existingPointerRaw !== undefined) {
          try {
            existingPointer = parsePointerRecord(existingPointerRaw);
          } catch {
            quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
              'The active fundamental pointer is structurally invalid.', existingPointerRaw);
            throw new TypeError('ACTIVE_POINTER_CORRUPT');
          }
          if (existingPointer.pointerKind !== 'fundamental_snapshot') {
            throw new TypeError('ACTIVE_POINTER_KIND_MISMATCH');
          }
        }
        const actualGeneration = existingPointer?.generation ?? 0;
        if (actualGeneration !== validated.expectedPointerGeneration) {
          throw new TypeError('FUNDAMENTAL_POINTER_COMPARE_AND_SWAP_FAILED');
        }

        const snapshot: FundamentalSnapshotRecord = Object.freeze({
          recordType: 'fundamental_snapshot',
          snapshotId: validated.snapshotId,
          issuerCik,
          bundleId: validated.bundle.bundleId,
          analysisId: validated.analysis.analysisId,
          fundamentalInputFingerprint: validated.bundle.fundamentalInputFingerprint,
          fundamentalAnalysisFingerprint: validated.analysis.fundamentalAnalysisFingerprint,
          state: 'committed',
          ...(candidate.committedAt === undefined ? {} : { createdAt: candidate.committedAt }),
        });
        const pointer: ActivePointerRecord = Object.freeze({
          recordType: 'active_pointer',
          issuerCik,
          pointerKind: 'fundamental_snapshot',
          targetId: snapshot.snapshotId,
          targetFingerprint: snapshot.fundamentalAnalysisFingerprint,
          generation: actualGeneration + 1,
          ...(candidate.committedAt === undefined ? {} : { updatedAt: candidate.committedAt }),
        });
        const commit: CommitRecord = Object.freeze({
          recordType: 'commit',
          transactionId: validated.transactionId,
          issuerCik,
          writtenRecordIds: Object.freeze([
            validated.bundle.bundleId,
            validated.analysis.analysisId,
            snapshot.snapshotId,
          ]),
          pointerUpdates: Object.freeze([`${issuerCik}:fundamental_snapshot`]),
          status: 'committed',
          ...(candidate.committedAt === undefined ? {} : { committedAt: candidate.committedAt }),
        });

        await transaction.add('fundamentalBundles', validated.bundle);
        await transaction.add('fundamentalAnalyses', validated.analysis);
        await transaction.add('fundamentalSnapshots', snapshot);
        await transaction.add('commitLog', commit);
        await transaction.put('activePointers', pointer);

        return Object.freeze({ snapshot, bundle: validated.bundle, analysis: validated.analysis, pointer, commit });
      },
    );
  }

  private async resolveSnapshot(
    transaction: AtomicRepositoryTransaction,
    pointer: ActivePointerRecord,
  ): Promise<PublishedFundamentalSnapshot | undefined> {
    const snapshotRaw = await transaction.get<unknown>('fundamentalSnapshots', pointer.targetId);
    if (snapshotRaw === undefined) {
      return quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'reference_missing',
        'The active fundamental pointer references a missing snapshot.', pointer);
    }
    let snapshot: FundamentalSnapshotRecord;
    try {
      snapshot = parseSnapshotRecord(snapshotRaw);
    } catch {
      return quarantineFailure(this.quarantine, 'fundamentalSnapshots', pointer.targetId, 'schema_mismatch',
        'The fundamental snapshot record failed structural validation.', snapshotRaw);
    }
    if (snapshot.issuerCik !== pointer.issuerCik || pointer.targetFingerprint !== snapshot.fundamentalAnalysisFingerprint) {
      return quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'pointer_corrupt',
        'The active fundamental pointer does not match its snapshot identity or fingerprint.', pointer);
    }

    const [bundleRaw, analysisRaw, commitsRaw] = await Promise.all([
      transaction.get<unknown>('fundamentalBundles', snapshot.bundleId),
      transaction.get<unknown>('fundamentalAnalyses', snapshot.analysisId),
      transaction.getAll<unknown>('commitLog'),
    ]);
    if (bundleRaw === undefined || analysisRaw === undefined) {
      return quarantineFailure(this.quarantine, 'fundamentalSnapshots', snapshot.snapshotId, 'reference_missing',
        'The fundamental snapshot references a missing bundle or analysis.', snapshot);
    }

    let bundle: FundamentalBundle;
    let analysis: FundamentalAnalysis;
    try {
      bundle = parseFundamentalBundle(bundleRaw);
    } catch {
      return quarantineFailure(this.quarantine, 'fundamentalBundles', snapshot.bundleId, 'schema_mismatch',
        'The fundamental bundle failed schema validation.', bundleRaw);
    }
    try {
      analysis = parseFundamentalAnalysis(analysisRaw);
    } catch {
      return quarantineFailure(this.quarantine, 'fundamentalAnalyses', snapshot.analysisId, 'schema_mismatch',
        'The fundamental analysis failed schema validation.', analysisRaw);
    }

    const [bundleHash, analysisHash] = await Promise.all([
      fundamentalInputFingerprint(bundle),
      fundamentalAnalysisFingerprint(analysis),
    ]);
    if (bundleHash !== bundle.fundamentalInputFingerprint
      || bundleHash !== snapshot.fundamentalInputFingerprint) {
      return quarantineFailure(this.quarantine, 'fundamentalBundles', snapshot.bundleId, 'record_hash_mismatch',
        'The fundamental bundle fingerprint does not match its canonical content.', bundleRaw);
    }
    if (analysisHash !== analysis.fundamentalAnalysisFingerprint
      || analysisHash !== snapshot.fundamentalAnalysisFingerprint
      || analysis.fundamentalInputFingerprint !== bundle.fundamentalInputFingerprint
      || analysis.issuerCik !== snapshot.issuerCik
      || bundle.issuer.cik !== snapshot.issuerCik) {
      return quarantineFailure(this.quarantine, 'fundamentalAnalyses', snapshot.analysisId, 'record_hash_mismatch',
        'The fundamental analysis fingerprint or lineage does not match the snapshot.', analysisRaw);
    }

    let commit: CommitRecord | undefined;
    for (const raw of commitsRaw) {
      try {
        const parsed = parseCommitRecord(raw);
        if (parsed.issuerCik === pointer.issuerCik
          && parsed.writtenRecordIds.includes(snapshot.snapshotId)
          && parsed.status === 'committed') {
          commit = parsed;
          break;
        }
      } catch {
        const key = isRecord(raw) && typeof raw.transactionId === 'string' ? raw.transactionId : 'unknown';
        quarantineFailure(this.quarantine, 'commitLog', key, 'schema_mismatch',
          'A commit evidence record failed structural validation.', raw);
      }
    }
    if (commit === undefined) {
      return quarantineFailure(this.quarantine, 'fundamentalSnapshots', snapshot.snapshotId, 'commit_evidence_missing',
        'The fundamental snapshot has no committed evidence record.', snapshot);
    }
    return Object.freeze({ snapshot, bundle, analysis, pointer, commit });
  }

  async readActive(issuerCik: Cik): Promise<PublishedFundamentalSnapshot | undefined> {
    return await this.storage.run(FUNDAMENTAL_TRANSACTION_STORES, 'readonly', async (transaction) => {
      const pointerRaw = await transaction.get<unknown>('activePointers', pointerKey(issuerCik));
      if (pointerRaw === undefined) return undefined;
      let pointer: ActivePointerRecord;
      try {
        pointer = parsePointerRecord(pointerRaw);
      } catch {
        return quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
          'The active fundamental pointer failed structural validation.', pointerRaw);
      }
      if (pointer.pointerKind !== 'fundamental_snapshot' || pointer.issuerCik !== issuerCik) {
        return quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
          'The active pointer is not a fundamental pointer for the requested issuer.', pointerRaw);
      }
      return await this.resolveSnapshot(transaction, pointer);
    });
  }

  async readAllRecords(): Promise<FundamentalRepositoryRecords> {
    return await this.storage.run(FUNDAMENTAL_TRANSACTION_STORES, 'readonly', async (transaction) => {
      const [snapshotRaws, bundleRaws, analysisRaws, pointerRaws, commitRaws] = await Promise.all([
        transaction.getAll<unknown>('fundamentalSnapshots'),
        transaction.getAll<unknown>('fundamentalBundles'),
        transaction.getAll<unknown>('fundamentalAnalyses'),
        transaction.getAll<unknown>('activePointers'),
        transaction.getAll<unknown>('commitLog'),
      ]);

      const bundles = new Map<string, FundamentalBundle>();
      for (const raw of bundleRaws) {
        try {
          const bundle = parseFundamentalBundle(raw);
          const hash = await fundamentalInputFingerprint(bundle);
          if (hash !== bundle.fundamentalInputFingerprint) {
            quarantineFailure(this.quarantine, 'fundamentalBundles', bundle.bundleId, 'record_hash_mismatch',
              'The fundamental bundle fingerprint does not match canonical content.', raw);
            continue;
          }
          bundles.set(bundle.bundleId, bundle);
        } catch {
          const key = isRecord(raw) && typeof raw.bundleId === 'string' ? raw.bundleId : 'unknown';
          quarantineFailure(this.quarantine, 'fundamentalBundles', key, 'schema_mismatch',
            'A fundamental bundle failed schema validation.', raw);
        }
      }

      const analyses = new Map<string, FundamentalAnalysis>();
      for (const raw of analysisRaws) {
        try {
          const analysis = parseFundamentalAnalysis(raw);
          const hash = await fundamentalAnalysisFingerprint(analysis);
          if (hash !== analysis.fundamentalAnalysisFingerprint) {
            quarantineFailure(this.quarantine, 'fundamentalAnalyses', analysis.analysisId, 'record_hash_mismatch',
              'The fundamental analysis fingerprint does not match canonical content.', raw);
            continue;
          }
          analyses.set(analysis.analysisId, analysis);
        } catch {
          const key = isRecord(raw) && typeof raw.analysisId === 'string' ? raw.analysisId : 'unknown';
          quarantineFailure(this.quarantine, 'fundamentalAnalyses', key, 'schema_mismatch',
            'A fundamental analysis failed schema validation.', raw);
        }
      }

      const commits = new Map<string, CommitRecord>();
      for (const raw of commitRaws) {
        try {
          const commit = parseCommitRecord(raw);
          commits.set(commit.transactionId, commit);
        } catch {
          const key = isRecord(raw) && typeof raw.transactionId === 'string' ? raw.transactionId : 'unknown';
          quarantineFailure(this.quarantine, 'commitLog', key, 'schema_mismatch',
            'A commit evidence record failed structural validation.', raw);
        }
      }

      const snapshots = new Map<string, FundamentalSnapshotRecord>();
      const snapshotCommits = new Map<string, CommitRecord>();
      for (const raw of snapshotRaws) {
        let snapshot: FundamentalSnapshotRecord;
        try {
          snapshot = parseSnapshotRecord(raw);
        } catch {
          const key = isRecord(raw) && typeof raw.snapshotId === 'string' ? raw.snapshotId : 'unknown';
          quarantineFailure(this.quarantine, 'fundamentalSnapshots', key, 'schema_mismatch',
            'A fundamental snapshot failed structural validation.', raw);
          continue;
        }
        const bundle = bundles.get(snapshot.bundleId);
        const analysis = analyses.get(snapshot.analysisId);
        if (bundle === undefined || analysis === undefined) {
          quarantineFailure(this.quarantine, 'fundamentalSnapshots', snapshot.snapshotId, 'reference_missing',
            'The fundamental snapshot references a missing or quarantined bundle or analysis.', raw);
          continue;
        }
        if (bundle.issuer.cik !== snapshot.issuerCik
          || analysis.issuerCik !== snapshot.issuerCik
          || bundle.fundamentalInputFingerprint !== snapshot.fundamentalInputFingerprint
          || analysis.fundamentalInputFingerprint !== snapshot.fundamentalInputFingerprint
          || analysis.fundamentalAnalysisFingerprint !== snapshot.fundamentalAnalysisFingerprint) {
          quarantineFailure(this.quarantine, 'fundamentalSnapshots', snapshot.snapshotId, 'record_hash_mismatch',
            'The fundamental snapshot lineage does not match its referenced records.', raw);
          continue;
        }
        const commit = [...commits.values()].find((entry) => (
          entry.issuerCik === snapshot.issuerCik
          && entry.status === 'committed'
          && entry.writtenRecordIds.includes(snapshot.snapshotId)
        ));
        if (commit === undefined) {
          quarantineFailure(this.quarantine, 'fundamentalSnapshots', snapshot.snapshotId, 'commit_evidence_missing',
            'The fundamental snapshot has no committed evidence record.', raw);
          continue;
        }
        snapshots.set(snapshot.snapshotId, snapshot);
        snapshotCommits.set(commit.transactionId, commit);
      }

      const pointers = new Map<string, ActivePointerRecord>();
      for (const raw of pointerRaws) {
        let pointer: ActivePointerRecord;
        try {
          pointer = parsePointerRecord(raw);
        } catch {
          if (!isRecord(raw) || raw.pointerKind !== 'fundamental_snapshot') continue;
          const key: RepositoryKey = typeof raw.issuerCik === 'string'
            ? [raw.issuerCik, 'fundamental_snapshot']
            : 'unknown';
          quarantineFailure(this.quarantine, 'activePointers', key, 'pointer_corrupt',
            'An active fundamental pointer failed structural validation.', raw);
          continue;
        }
        if (pointer.pointerKind !== 'fundamental_snapshot') continue;
        const snapshot = snapshots.get(pointer.targetId);
        if (snapshot === undefined || snapshot.issuerCik !== pointer.issuerCik
          || snapshot.fundamentalAnalysisFingerprint !== pointer.targetFingerprint) {
          quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'pointer_corrupt',
            'The active fundamental pointer does not resolve to a valid snapshot.', raw);
          continue;
        }
        pointers.set(`${pointer.issuerCik}:fundamental_snapshot`, pointer);
      }

      const referencedBundleIds = new Set([...snapshots.values()].map((entry) => entry.bundleId));
      const referencedAnalysisIds = new Set([...snapshots.values()].map((entry) => entry.analysisId));
      return Object.freeze({
        snapshots: Object.freeze([...snapshots.values()]),
        bundles: Object.freeze([...bundles.values()].filter((entry) => referencedBundleIds.has(entry.bundleId))),
        analyses: Object.freeze([...analyses.values()].filter((entry) => referencedAnalysisIds.has(entry.analysisId))),
        pointers: Object.freeze([...pointers.values()]),
        commits: Object.freeze([...snapshotCommits.values()]),
      });
    });
  }
}
