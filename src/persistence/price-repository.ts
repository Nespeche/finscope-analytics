import type { ConfirmedHistoricalPriceImport } from '../domain/price/import-preview';
import type { PriceEventResult } from '../domain/orchestration/price-events';
import {
  parseHistoricalPriceOverlay,
  parsePriceAnalysis,
  type HistoricalPriceOverlay,
  type PriceAnalysis,
} from '../domain/price/types';
import type { Cik } from '../domain/model';
import type { FinScopeStoreName } from './db-schema';
import {
  type ActivePointerRecord,
  type AtomicRepositoryStorage,
  type CommitRecord,
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
  constructor(private readonly storage: AtomicRepositoryStorage) {}

  async publishConfirmed(input: ConfirmedPricePublication): Promise<PublishedPriceVersion> {
    const resolved = resolveConfirmedPublication(input);
    const expectedGeneration = requireGeneration(input.expectedPointerGeneration);
    const transactionId = requireId(input.transactionId, 'PRICE_TRANSACTION_ID_REQUIRED');
    const issuerCik = resolved.overlay.issuerCik;

    return await this.storage.run(PRICE_STORES, 'readwrite', async (transaction) => {
      const current = await transaction.get<ActivePointerRecord>('activePointers', pointerKey(issuerCik));
      if (current !== undefined && current.pointerKind !== 'price_overlay') {
        throw new TypeError('ACTIVE_POINTER_KIND_MISMATCH');
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
      const pointer = await transaction.get<ActivePointerRecord>('activePointers', pointerKey(input.issuerCik));
      if (pointer === undefined || pointer.pointerKind !== 'price_overlay') throw new TypeError('PRICE_HISTORY_NOT_FOUND');
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

  async readAllRecords(): Promise<PriceRepositoryRecords> {
    return await this.storage.run(PRICE_STORES, 'readonly', async (transaction) => {
      const [overlays, analyses, pointers, commits] = await Promise.all([
        transaction.getAll<HistoricalPriceOverlay>('priceOverlays'),
        transaction.getAll<PriceAnalysis>('priceAnalyses'),
        transaction.getAll<ActivePointerRecord>('activePointers'),
        transaction.getAll<CommitRecord>('commitLog'),
      ]);
      return Object.freeze({
        overlays: Object.freeze([...overlays]), analyses: Object.freeze([...analyses]),
        pointers: Object.freeze(pointers.filter((pointer) => pointer.pointerKind === 'price_overlay')),
        commits: Object.freeze(commits.filter((commit) => commit.pointerUpdates.some((p) => p.endsWith(':price_overlay')))),
      });
    });
  }
}
