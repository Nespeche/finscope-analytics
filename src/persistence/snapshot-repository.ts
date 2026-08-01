import type { Sha256Digest } from '../core/sha256';
import {
  parseFundamentalAnalysis,
  parseFundamentalBundle,
  type FundamentalAnalysis,
  type FundamentalBundle,
} from '../domain/fundamental/types';
import type { Cik } from '../domain/model';
import type { FinScopeStoreName } from './db-schema';
import { requestToPromise, runIndexedDbTransaction } from './indexeddb';

export type RepositoryKey = IDBValidKey;

export interface AtomicRepositoryTransaction {
  get<T>(storeName: FinScopeStoreName, key: RepositoryKey): Promise<T | undefined>;
  getAll<T>(storeName: FinScopeStoreName): Promise<readonly T[]>;
  add(storeName: FinScopeStoreName, value: unknown): Promise<void>;
  put(storeName: FinScopeStoreName, value: unknown): Promise<void>;
  delete(storeName: FinScopeStoreName, key: RepositoryKey): Promise<void>;
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

export class SnapshotRepository {
  constructor(private readonly storage: AtomicRepositoryStorage) {}

  async publish(candidate: FundamentalSnapshotCandidate): Promise<PublishedFundamentalSnapshot> {
    const validated = validateCandidate(candidate);
    const issuerCik = validated.bundle.issuer.cik;

    return await this.storage.run(
      FUNDAMENTAL_TRANSACTION_STORES,
      'readwrite',
      async (transaction) => {
        const existingPointer = await transaction.get<ActivePointerRecord>(
          'activePointers',
          pointerKey(issuerCik),
        );
        if (
          existingPointer !== undefined
          && existingPointer.pointerKind !== 'fundamental_snapshot'
        ) {
          throw new TypeError('ACTIVE_POINTER_KIND_MISMATCH');
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

        return Object.freeze({
          snapshot,
          bundle: validated.bundle,
          analysis: validated.analysis,
          pointer,
          commit,
        });
      },
    );
  }

  async readActive(issuerCik: Cik): Promise<PublishedFundamentalSnapshot | undefined> {
    return await this.storage.run(FUNDAMENTAL_TRANSACTION_STORES, 'readonly', async (transaction) => {
      const pointer = await transaction.get<ActivePointerRecord>(
        'activePointers',
        pointerKey(issuerCik),
      );
      if (pointer === undefined) return undefined;
      if (pointer.pointerKind !== 'fundamental_snapshot') {
        throw new TypeError('ACTIVE_POINTER_KIND_MISMATCH');
      }
      const snapshot = await transaction.get<FundamentalSnapshotRecord>(
        'fundamentalSnapshots',
        pointer.targetId,
      );
      if (snapshot === undefined) throw new TypeError('ORPHAN_FUNDAMENTAL_POINTER');
      const bundle = await transaction.get<FundamentalBundle>('fundamentalBundles', snapshot.bundleId);
      const analysis = await transaction.get<FundamentalAnalysis>('fundamentalAnalyses', snapshot.analysisId);
      if (bundle === undefined || analysis === undefined) {
        throw new TypeError('ORPHAN_FUNDAMENTAL_SNAPSHOT');
      }
      if (pointer.targetFingerprint !== snapshot.fundamentalAnalysisFingerprint) {
        throw new TypeError('FUNDAMENTAL_POINTER_FINGERPRINT_MISMATCH');
      }
      const commits = await transaction.getAll<CommitRecord>('commitLog');
      const commit = commits.find((entry) => (
        entry.issuerCik === issuerCik
        && entry.writtenRecordIds.includes(snapshot.snapshotId)
        && entry.status === 'committed'
      ));
      if (commit === undefined) throw new TypeError('FUNDAMENTAL_EVIDENCE_INDEX_MISSING');
      return Object.freeze({ snapshot, bundle, analysis, pointer, commit });
    });
  }

  async readAllRecords(): Promise<FundamentalRepositoryRecords> {
    return await this.storage.run(FUNDAMENTAL_TRANSACTION_STORES, 'readonly', async (transaction) => {
      const [snapshots, bundles, analyses, pointers, commits] = await Promise.all([
        transaction.getAll<FundamentalSnapshotRecord>('fundamentalSnapshots'),
        transaction.getAll<FundamentalBundle>('fundamentalBundles'),
        transaction.getAll<FundamentalAnalysis>('fundamentalAnalyses'),
        transaction.getAll<ActivePointerRecord>('activePointers'),
        transaction.getAll<CommitRecord>('commitLog'),
      ]);
      return Object.freeze({
        snapshots: Object.freeze([...snapshots]),
        bundles: Object.freeze([...bundles]),
        analyses: Object.freeze([...analyses]),
        pointers: Object.freeze(pointers.filter((pointer) => pointer.pointerKind === 'fundamental_snapshot')),
        commits: Object.freeze(commits.filter((commit) => (
          commit.pointerUpdates.some((pointer) => pointer.endsWith(':fundamental_snapshot'))
        ))),
      });
    });
  }
}
