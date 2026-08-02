import type { PriceEventResult } from '../domain/orchestration/price-events';
import {
  historicalPriceOverlayFingerprint,
  priceAnalysisFingerprint,
} from '../domain/fingerprints/fingerprint-service';
import type { ConfirmedHistoricalPriceImport } from '../domain/price/import-preview';
import {
  parseHistoricalPriceOverlay,
  parsePriceAnalysis,
  type HistoricalPriceOverlay,
  type PriceAnalysis,
} from '../domain/price/types';
import type { Cik } from '../domain/model';
import type { FinScopeStoreName } from './db-schema';
import {
  CorruptionQuarantine,
  type QuarantinedRepositoryRecord,
  type RepositoryIntegrityFailure,
} from './indexeddb';
import {
  type ActivePointerRecord,
  type AtomicRepositoryStorage,
  type AtomicRepositoryTransaction,
  type CommitRecord,
  type RepositoryKey,
} from './snapshot-repository';

export interface ConfirmedPricePublication {
  readonly eventResult: PriceEventResult;
  readonly confirmation: ConfirmedHistoricalPriceImport;
  readonly expectedPointerGeneration: number;
  readonly transactionId: string;
  readonly committedAt?: string;
}

export interface ConfirmedPriceDeletion {
  readonly eventResult: PriceEventResult;
  readonly issuerCik: Cik;
  readonly expectedPointerGeneration: number;
  readonly transactionId: string;
  readonly committedAt?: string;
}

export interface PublishedPriceVersion {
  readonly overlay: HistoricalPriceOverlay;
  readonly analysis: PriceAnalysis;
  readonly pointer: ActivePointerRecord;
  readonly commit: CommitRecord;
}

export interface PriceRepositoryRecords {
  readonly overlays: readonly HistoricalPriceOverlay[];
  readonly analyses: readonly PriceAnalysis[];
  readonly pointers: readonly ActivePointerRecord[];
  readonly commits: readonly CommitRecord[];
}

const PRICE_STORES = Object.freeze([
  'priceOverlays', 'priceAnalyses', 'activePointers', 'commitLog',
] as const satisfies readonly FinScopeStoreName[]);

function pointerKey(issuerCik: Cik): [Cik, 'price_overlay'] {
  return [issuerCik, 'price_overlay'];
}

function overlayRecordId(overlayId: string, overlayVersion: number): string {
  return `${overlayId}:${overlayVersion}`;
}

function parseOverlayRecordId(value: string): readonly [string, number] {
  const separator = value.lastIndexOf(':');
  if (separator < 1) throw new TypeError('INVALID_PRICE_POINTER_TARGET');
  const version = Number(value.slice(separator + 1));
  if (!Number.isSafeInteger(version) || version < 1) throw new TypeError('INVALID_PRICE_POINTER_TARGET');
  return [value.slice(0, separator), version] as const;
}

function requireGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('INVALID_EXPECTED_POINTER_GENERATION');
  return value;
}

function requireId(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new TypeError(code);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDigest(value: unknown): boolean {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function parsePointer(value: unknown): ActivePointerRecord {
  if (!isRecord(value)
    || value.recordType !== 'active_pointer'
    || typeof value.issuerCik !== 'string'
    || value.pointerKind !== 'price_overlay'
    || typeof value.targetId !== 'string'
    || value.targetId.length === 0
    || !isDigest(value.targetFingerprint)
    || !Number.isSafeInteger(value.generation)
    || Number(value.generation) < 1) {
    throw new TypeError('INVALID_PRICE_POINTER_RECORD');
  }
  return value as unknown as ActivePointerRecord;
}

function parseCommit(value: unknown): CommitRecord {
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

function resolveConfirmedPublication(input: ConfirmedPricePublication): Readonly<{
  overlay: HistoricalPriceOverlay;
  analysis: PriceAnalysis;
  event: 'historical_price_imported' | 'historical_price_replaced';
}> {
  if (input.confirmation.confirmed !== true || !input.confirmation.preview.publicationAllowed) {
    throw new TypeError('PRICE_IMPORT_CONFIRMATION_REQUIRED');
  }
  const event = input.eventResult.event;
  if (event !== 'historical_price_imported' && event !== 'historical_price_replaced') {
    throw new TypeError('CONFIRMED_PRICE_PUBLICATION_EVENT_REQUIRED');
  }
  const cik = input.confirmation.preview.scope.issuerCik;
  const eventPointer = input.eventResult.state.activePricePointers[cik];
  if (eventPointer === undefined) throw new TypeError('CONFIRMED_PRICE_EVENT_POINTER_MISSING');
  const overlay = parseHistoricalPriceOverlay(
    input.eventResult.state.priceOverlays[`${eventPointer.overlayId}:${eventPointer.overlayVersion}`],
  );
  const analysis = parsePriceAnalysis(input.eventResult.state.priceAnalyses[eventPointer.analysisId]);
  if (overlay.issuerCik !== cik || analysis.issuerCik !== cik) throw new TypeError('PRICE_EVENT_ISSUER_MISMATCH');
  if (analysis.historicalPriceOverlayFingerprint !== overlay.historicalPriceOverlayFingerprint) {
    throw new TypeError('PRICE_ANALYSIS_OVERLAY_FINGERPRINT_MISMATCH');
  }
  const preview = input.confirmation.preview;
  if (
    preview.scope.instrument.symbol !== overlay.instrument.symbol
    || preview.scope.instrument.venueMic !== overlay.instrument.venueMic
    || preview.scope.currency !== overlay.currency
    || JSON.stringify(preview.observations) !== JSON.stringify(overlay.observations)
  ) {
    throw new TypeError('PRICE_EVENT_DOES_NOT_MATCH_CONFIRMED_PREVIEW');
  }
  return Object.freeze({ overlay, analysis, event });
}

export class PriceRepository {
  constructor(
    private readonly storage: AtomicRepositoryStorage,
    private readonly quarantine: CorruptionQuarantine = new CorruptionQuarantine(),
  ) {}

  listQuarantinedRecords(): readonly QuarantinedRepositoryRecord[] {
    return this.quarantine.list().filter((entry) => (
      entry.storeName === 'priceOverlays'
      || entry.storeName === 'priceAnalyses'
      || entry.storeName === 'activePointers'
      || entry.storeName === 'commitLog'
    ));
  }

  async publishConfirmed(input: ConfirmedPricePublication): Promise<PublishedPriceVersion> {
    const resolved = resolveConfirmedPublication(input);
    const expectedGeneration = requireGeneration(input.expectedPointerGeneration);
    const transactionId = requireId(input.transactionId, 'PRICE_TRANSACTION_ID_REQUIRED');
    const issuerCik = resolved.overlay.issuerCik;
    return await this.storage.run(PRICE_STORES, 'readwrite', async (transaction) => {
      const currentRaw = await transaction.get<unknown>('activePointers', pointerKey(issuerCik));
      let current: ActivePointerRecord | undefined;
      if (currentRaw !== undefined) {
        try {
          current = parsePointer(currentRaw);
        } catch {
          quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
            'The active price pointer failed structural validation.', currentRaw);
          throw new TypeError('ACTIVE_POINTER_CORRUPT');
        }
      }
      const actualGeneration = current?.generation ?? 0;
      if (actualGeneration !== expectedGeneration) throw new TypeError('PRICE_POINTER_COMPARE_AND_SWAP_FAILED');
      if (resolved.event === 'historical_price_imported' && current !== undefined) {
        throw new TypeError('PRICE_HISTORY_ALREADY_EXISTS_USE_REPLACEMENT');
      }
      if (resolved.event === 'historical_price_replaced') {
        if (current === undefined) throw new TypeError('PRICE_HISTORY_NOT_FOUND');
        const [currentOverlayId, currentVersion] = parseOverlayRecordId(current.targetId);
        if (resolved.overlay.overlayId !== currentOverlayId) throw new TypeError('PRICE_OVERLAY_ID_CHANGED');
        if (resolved.overlay.overlayVersion !== currentVersion + 1) {
          throw new TypeError('PRICE_OVERLAY_VERSION_MUST_INCREMENT_BY_ONE');
        }
      }

      const pointer: ActivePointerRecord = Object.freeze({
        recordType: 'active_pointer', issuerCik, pointerKind: 'price_overlay',
        targetId: overlayRecordId(resolved.overlay.overlayId, resolved.overlay.overlayVersion),
        targetFingerprint: resolved.overlay.historicalPriceOverlayFingerprint,
        generation: actualGeneration + 1,
        ...(input.committedAt === undefined ? {} : { updatedAt: input.committedAt }),
      });
      const commit: CommitRecord = Object.freeze({
        recordType: 'commit', transactionId, issuerCik,
        writtenRecordIds: Object.freeze([pointer.targetId, resolved.analysis.analysisId]),
        pointerUpdates: Object.freeze([`${issuerCik}:price_overlay`]), status: 'committed',
        ...(input.committedAt === undefined ? {} : { committedAt: input.committedAt }),
      });

      await transaction.add('priceOverlays', resolved.overlay);
      await transaction.add('priceAnalyses', resolved.analysis);
      await transaction.add('commitLog', commit);
      await transaction.put('activePointers', pointer);
      return Object.freeze({ overlay: resolved.overlay, analysis: resolved.analysis, pointer, commit });
    });
  }

  async deleteConfirmed(input: ConfirmedPriceDeletion): Promise<void> {
    if (input.eventResult.event !== 'historical_price_deleted') {
      throw new TypeError('CONFIRMED_PRICE_DELETION_EVENT_REQUIRED');
    }
    const expectedGeneration = requireGeneration(input.expectedPointerGeneration);
    const transactionId = requireId(input.transactionId, 'PRICE_TRANSACTION_ID_REQUIRED');
    await this.storage.run(PRICE_STORES, 'readwrite', async (transaction) => {
      const pointerRaw = await transaction.get<unknown>('activePointers', pointerKey(input.issuerCik));
      if (pointerRaw === undefined) throw new TypeError('PRICE_HISTORY_NOT_FOUND');
      let pointer: ActivePointerRecord;
      try {
        pointer = parsePointer(pointerRaw);
      } catch {
        quarantineFailure(this.quarantine, 'activePointers', pointerKey(input.issuerCik), 'pointer_corrupt',
          'The active price pointer failed structural validation.', pointerRaw);
        throw new TypeError('ACTIVE_POINTER_CORRUPT');
      }
      if (pointer.generation !== expectedGeneration) throw new TypeError('PRICE_POINTER_COMPARE_AND_SWAP_FAILED');
      const overlays = (await transaction.getAll<HistoricalPriceOverlay>('priceOverlays'))
        .filter((overlay) => overlay.issuerCik === input.issuerCik);
      const analyses = (await transaction.getAll<PriceAnalysis>('priceAnalyses'))
        .filter((analysis) => analysis.issuerCik === input.issuerCik);
      for (const overlay of overlays) await transaction.delete('priceOverlays', [overlay.overlayId, overlay.overlayVersion]);
      for (const analysis of analyses) await transaction.delete('priceAnalyses', analysis.analysisId);
      await transaction.delete('activePointers', pointerKey(input.issuerCik));
      await transaction.add('commitLog', Object.freeze({
        recordType: 'commit', transactionId, issuerCik: input.issuerCik,
        writtenRecordIds: Object.freeze([transactionId]),
        pointerUpdates: Object.freeze([`${input.issuerCik}:price_overlay`]), status: 'committed',
        ...(input.committedAt === undefined ? {} : { committedAt: input.committedAt }),
      }) satisfies CommitRecord);
    });
  }

  private async resolvePointer(
    transaction: AtomicRepositoryTransaction,
    pointer: ActivePointerRecord,
  ): Promise<PublishedPriceVersion | undefined> {
    let overlayKey: readonly [string, number];
    try {
      overlayKey = parseOverlayRecordId(pointer.targetId);
    } catch {
      return quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'pointer_corrupt',
        'The active price pointer target ID is invalid.', pointer);
    }
    const overlayRaw = await transaction.get<unknown>('priceOverlays', overlayKey as [string, number]);
    if (overlayRaw === undefined) {
      return quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'reference_missing',
        'The active price pointer references a missing overlay.', pointer);
    }
    let overlay: HistoricalPriceOverlay;
    try {
      overlay = parseHistoricalPriceOverlay(overlayRaw);
    } catch {
      return quarantineFailure(this.quarantine, 'priceOverlays', overlayKey as [string, number], 'schema_mismatch',
        'The historical price overlay failed schema validation.', overlayRaw);
    }
    if (overlay.issuerCik !== pointer.issuerCik
      || overlayRecordId(overlay.overlayId, overlay.overlayVersion) !== pointer.targetId
      || overlay.historicalPriceOverlayFingerprint !== pointer.targetFingerprint) {
      return quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'pointer_corrupt',
        'The active price pointer does not match the referenced overlay.', pointer);
    }
    const [analysesRaw, commitsRaw] = await Promise.all([
      transaction.getAll<unknown>('priceAnalyses'),
      transaction.getAll<unknown>('commitLog'),
    ]);
    const overlayHash = await historicalPriceOverlayFingerprint(overlay);
    if (overlayHash !== overlay.historicalPriceOverlayFingerprint) {
      return quarantineFailure(this.quarantine, 'priceOverlays', overlayKey as [string, number], 'record_hash_mismatch',
        'The historical price overlay fingerprint does not match canonical content.', overlayRaw);
    }

    let analysis: PriceAnalysis | undefined;
    for (const raw of analysesRaw) {
      try {
        const parsed = parsePriceAnalysis(raw);
        if (parsed.issuerCik !== pointer.issuerCik
          || parsed.historicalPriceOverlayFingerprint !== overlay.historicalPriceOverlayFingerprint) continue;
        const hash = await priceAnalysisFingerprint(parsed);
        if (hash !== parsed.priceAnalysisFingerprint) {
          quarantineFailure(this.quarantine, 'priceAnalyses', parsed.analysisId, 'record_hash_mismatch',
            'The price analysis fingerprint does not match canonical content.', raw);
          continue;
        }
        analysis = parsed;
        break;
      } catch {
        const key = isRecord(raw) && typeof raw.analysisId === 'string' ? raw.analysisId : 'unknown';
        quarantineFailure(this.quarantine, 'priceAnalyses', key, 'schema_mismatch',
          'A price analysis failed schema validation.', raw);
      }
    }
    if (analysis === undefined) {
      return quarantineFailure(this.quarantine, 'priceOverlays', overlayKey as [string, number], 'reference_missing',
        'The active price overlay has no valid analysis.', overlay);
    }

    let commit: CommitRecord | undefined;
    for (const raw of commitsRaw) {
      try {
        const parsed = parseCommit(raw);
        if (parsed.issuerCik === pointer.issuerCik
          && parsed.writtenRecordIds.includes(pointer.targetId)
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
      return quarantineFailure(this.quarantine, 'priceOverlays', overlayKey as [string, number], 'commit_evidence_missing',
        'The active price overlay has no committed evidence record.', overlay);
    }
    return Object.freeze({ overlay, analysis, pointer, commit });
  }

  async readActive(issuerCik: Cik): Promise<PublishedPriceVersion | undefined> {
    return await this.storage.run(PRICE_STORES, 'readonly', async (transaction) => {
      const pointerRaw = await transaction.get<unknown>('activePointers', pointerKey(issuerCik));
      if (pointerRaw === undefined) return undefined;
      let pointer: ActivePointerRecord;
      try {
        pointer = parsePointer(pointerRaw);
      } catch {
        return quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
          'The active price pointer failed structural validation.', pointerRaw);
      }
      if (pointer.issuerCik !== issuerCik) {
        return quarantineFailure(this.quarantine, 'activePointers', pointerKey(issuerCik), 'pointer_corrupt',
          'The active price pointer belongs to another issuer.', pointerRaw);
      }
      return await this.resolvePointer(transaction, pointer);
    });
  }

  async readAllRecords(): Promise<PriceRepositoryRecords> {
    return await this.storage.run(PRICE_STORES, 'readonly', async (transaction) => {
      const [overlayRaws, analysisRaws, pointerRaws, commitRaws] = await Promise.all([
        transaction.getAll<unknown>('priceOverlays'),
        transaction.getAll<unknown>('priceAnalyses'),
        transaction.getAll<unknown>('activePointers'),
        transaction.getAll<unknown>('commitLog'),
      ]);

      const overlays = new Map<string, HistoricalPriceOverlay>();
      for (const raw of overlayRaws) {
        try {
          const overlay = parseHistoricalPriceOverlay(raw);
          const key = overlayRecordId(overlay.overlayId, overlay.overlayVersion);
          const hash = await historicalPriceOverlayFingerprint(overlay);
          if (hash !== overlay.historicalPriceOverlayFingerprint) {
            quarantineFailure(this.quarantine, 'priceOverlays', [overlay.overlayId, overlay.overlayVersion],
              'record_hash_mismatch', 'A historical price overlay fingerprint does not match canonical content.', raw);
            continue;
          }
          overlays.set(key, overlay);
        } catch {
          const key: RepositoryKey = isRecord(raw) && typeof raw.overlayId === 'string'
            && Number.isSafeInteger(raw.overlayVersion)
            ? [raw.overlayId, Number(raw.overlayVersion)]
            : 'unknown';
          quarantineFailure(this.quarantine, 'priceOverlays', key, 'schema_mismatch',
            'A historical price overlay failed schema validation.', raw);
        }
      }

      const analyses = new Map<string, PriceAnalysis>();
      for (const raw of analysisRaws) {
        try {
          const analysis = parsePriceAnalysis(raw);
          const hash = await priceAnalysisFingerprint(analysis);
          if (hash !== analysis.priceAnalysisFingerprint) {
            quarantineFailure(this.quarantine, 'priceAnalyses', analysis.analysisId, 'record_hash_mismatch',
              'A price analysis fingerprint does not match canonical content.', raw);
            continue;
          }
          analyses.set(analysis.analysisId, analysis);
        } catch {
          const key = isRecord(raw) && typeof raw.analysisId === 'string' ? raw.analysisId : 'unknown';
          quarantineFailure(this.quarantine, 'priceAnalyses', key, 'schema_mismatch',
            'A price analysis failed schema validation.', raw);
        }
      }

      const commits = new Map<string, CommitRecord>();
      for (const raw of commitRaws) {
        try {
          const commit = parseCommit(raw);
          commits.set(commit.transactionId, commit);
        } catch {
          const key = isRecord(raw) && typeof raw.transactionId === 'string' ? raw.transactionId : 'unknown';
          quarantineFailure(this.quarantine, 'commitLog', key, 'schema_mismatch',
            'A commit evidence record failed structural validation.', raw);
        }
      }

      const validOverlays = new Map<string, HistoricalPriceOverlay>();
      const validAnalyses = new Map<string, PriceAnalysis>();
      const overlayCommits = new Map<string, CommitRecord>();
      for (const [recordId, overlay] of overlays) {
        const matchingAnalyses = [...analyses.values()].filter((entry) => (
          entry.issuerCik === overlay.issuerCik
          && entry.historicalPriceOverlayFingerprint === overlay.historicalPriceOverlayFingerprint
        ));
        if (matchingAnalyses.length === 0) {
          quarantineFailure(this.quarantine, 'priceOverlays', [overlay.overlayId, overlay.overlayVersion],
            'reference_missing', 'The historical price overlay has no valid analysis.', overlay);
          continue;
        }
        const commit = [...commits.values()].find((entry) => (
          entry.issuerCik === overlay.issuerCik
          && entry.status === 'committed'
          && entry.writtenRecordIds.includes(recordId)
        ));
        if (commit === undefined) {
          quarantineFailure(this.quarantine, 'priceOverlays', [overlay.overlayId, overlay.overlayVersion],
            'commit_evidence_missing', 'The historical price overlay has no committed evidence record.', overlay);
          continue;
        }
        validOverlays.set(recordId, overlay);
        matchingAnalyses.forEach((entry) => validAnalyses.set(entry.analysisId, entry));
        overlayCommits.set(commit.transactionId, commit);
      }

      const pointers = new Map<string, ActivePointerRecord>();
      for (const raw of pointerRaws) {
        let pointer: ActivePointerRecord;
        try {
          pointer = parsePointer(raw);
        } catch {
          if (!isRecord(raw) || raw.pointerKind !== 'price_overlay') continue;
          const key: RepositoryKey = typeof raw.issuerCik === 'string'
            ? [raw.issuerCik, 'price_overlay']
            : 'unknown';
          quarantineFailure(this.quarantine, 'activePointers', key, 'pointer_corrupt',
            'An active price pointer failed structural validation.', raw);
          continue;
        }
        const overlay = validOverlays.get(pointer.targetId);
        if (overlay === undefined || overlay.issuerCik !== pointer.issuerCik
          || overlay.historicalPriceOverlayFingerprint !== pointer.targetFingerprint) {
          quarantineFailure(this.quarantine, 'activePointers', pointerKey(pointer.issuerCik), 'pointer_corrupt',
            'The active price pointer does not resolve to a valid overlay.', raw);
          continue;
        }
        pointers.set(`${pointer.issuerCik}:price_overlay`, pointer);
      }

      return Object.freeze({
        overlays: Object.freeze([...validOverlays.values()]),
        analyses: Object.freeze([...validAnalyses.values()]),
        pointers: Object.freeze([...pointers.values()]),
        commits: Object.freeze([...overlayCommits.values()]),
      });
    });
  }
}
