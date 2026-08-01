import type { HistoricalPriceOverlay, PriceAnalysis } from '../price/types';

export interface FundamentalArtifacts {
  readonly bundles: Readonly<Record<string, unknown>>;
  readonly analyses: Readonly<Record<string, unknown>>;
  readonly snapshots: Readonly<Record<string, unknown>>;
  readonly activeSnapshotPointers: Readonly<Record<string, unknown>>;
  readonly fingerprints: Readonly<Record<string, string>>;
}

export interface PriceOverlayPointer {
  readonly issuerCik: string;
  readonly pointerKind: 'price_overlay';
  readonly overlayId: string;
  readonly overlayVersion: number;
  readonly analysisId: string;
  readonly generation: number;
}

export interface PricePersistenceState {
  readonly fundamental: FundamentalArtifacts;
  readonly priceOverlays: Readonly<Record<string, HistoricalPriceOverlay>>;
  readonly priceAnalyses: Readonly<Record<string, PriceAnalysis>>;
  readonly activePricePointers: Readonly<Record<string, PriceOverlayPointer>>;
}

export interface PublishPriceEventInput {
  readonly overlay: HistoricalPriceOverlay;
  readonly analysis: PriceAnalysis;
  readonly expectedPointerGeneration?: number;
}

export interface PriceEventResult {
  readonly state: PricePersistenceState;
  readonly event: 'historical_price_imported' | 'historical_price_replaced' | 'historical_price_deleted';
  readonly affected: readonly ['price overlay', 'price quality', 'price metrics', 'price pointer'];
  readonly unaffected: readonly [
    'fundamental bundle',
    'fundamental analysis',
    'fundamental snapshot',
    'fundamental snapshot pointer',
    'fundamental fingerprints',
  ];
}

const AFFECTED = Object.freeze([
  'price overlay',
  'price quality',
  'price metrics',
  'price pointer',
] as const);
const UNAFFECTED = Object.freeze([
  'fundamental bundle',
  'fundamental analysis',
  'fundamental snapshot',
  'fundamental snapshot pointer',
  'fundamental fingerprints',
] as const);

function overlayKey(overlay: HistoricalPriceOverlay): string {
  return `${overlay.overlayId}:${overlay.overlayVersion}`;
}

function validatePublication(input: PublishPriceEventInput): void {
  if (input.analysis.issuerCik !== input.overlay.issuerCik) {
    throw new TypeError('PRICE_ANALYSIS_ISSUER_MISMATCH');
  }
  if (
    input.analysis.historicalPriceOverlayFingerprint
    !== input.overlay.historicalPriceOverlayFingerprint
  ) {
    throw new TypeError('PRICE_ANALYSIS_OVERLAY_FINGERPRINT_MISMATCH');
  }
}

function publish(
  state: PricePersistenceState,
  input: PublishPriceEventInput,
  event: PriceEventResult['event'],
): PriceEventResult {
  validatePublication(input);
  const currentPointer = state.activePricePointers[input.overlay.issuerCik];
  const actualGeneration = currentPointer?.generation ?? 0;
  if (
    input.expectedPointerGeneration !== undefined
    && input.expectedPointerGeneration !== actualGeneration
  ) {
    throw new TypeError('PRICE_POINTER_COMPARE_AND_SWAP_FAILED');
  }
  const key = overlayKey(input.overlay);
  if (Object.hasOwn(state.priceOverlays, key)) {
    throw new TypeError('IMMUTABLE_PRICE_OVERLAY_ALREADY_EXISTS');
  }
  if (Object.hasOwn(state.priceAnalyses, input.analysis.analysisId)) {
    throw new TypeError('IMMUTABLE_PRICE_ANALYSIS_ALREADY_EXISTS');
  }
  const pointer: PriceOverlayPointer = Object.freeze({
    issuerCik: input.overlay.issuerCik,
    pointerKind: 'price_overlay',
    overlayId: input.overlay.overlayId,
    overlayVersion: input.overlay.overlayVersion,
    analysisId: input.analysis.analysisId,
    generation: actualGeneration + 1,
  });
  const nextState: PricePersistenceState = Object.freeze({
    fundamental: state.fundamental,
    priceOverlays: Object.freeze({ ...state.priceOverlays, [key]: input.overlay }),
    priceAnalyses: Object.freeze({ ...state.priceAnalyses, [input.analysis.analysisId]: input.analysis }),
    activePricePointers: Object.freeze({
      ...state.activePricePointers,
      [input.overlay.issuerCik]: pointer,
    }),
  });
  return Object.freeze({ state: nextState, event, affected: AFFECTED, unaffected: UNAFFECTED });
}

export function applyHistoricalPriceImport(
  state: PricePersistenceState,
  input: PublishPriceEventInput,
): PriceEventResult {
  if (state.activePricePointers[input.overlay.issuerCik] !== undefined) {
    throw new TypeError('PRICE_HISTORY_ALREADY_EXISTS_USE_REPLACEMENT');
  }
  return publish(state, input, 'historical_price_imported');
}

export function applyHistoricalPriceReplacement(
  state: PricePersistenceState,
  input: PublishPriceEventInput,
): PriceEventResult {
  const pointer = state.activePricePointers[input.overlay.issuerCik];
  if (pointer === undefined) throw new TypeError('PRICE_HISTORY_NOT_FOUND');
  if (input.overlay.overlayId !== pointer.overlayId) {
    throw new TypeError('PRICE_OVERLAY_ID_CHANGED');
  }
  if (input.overlay.overlayVersion !== pointer.overlayVersion + 1) {
    throw new TypeError('PRICE_OVERLAY_VERSION_MUST_INCREMENT_BY_ONE');
  }
  return publish(state, input, 'historical_price_replaced');
}

export function applyHistoricalPriceDeletion(
  state: PricePersistenceState,
  issuerCik: string,
  expectedPointerGeneration?: number,
): PriceEventResult {
  const pointer = state.activePricePointers[issuerCik];
  if (pointer === undefined) throw new TypeError('PRICE_HISTORY_NOT_FOUND');
  if (
    expectedPointerGeneration !== undefined
    && expectedPointerGeneration !== pointer.generation
  ) {
    throw new TypeError('PRICE_POINTER_COMPARE_AND_SWAP_FAILED');
  }
  const priceOverlays = Object.fromEntries(
    Object.entries(state.priceOverlays).filter(([, overlay]) => overlay.issuerCik !== issuerCik),
  );
  const priceAnalyses = Object.fromEntries(
    Object.entries(state.priceAnalyses).filter(([, analysis]) => analysis.issuerCik !== issuerCik),
  );
  const activePricePointers = Object.fromEntries(
    Object.entries(state.activePricePointers).filter(([key]) => key !== issuerCik),
  );
  const nextState: PricePersistenceState = Object.freeze({
    fundamental: state.fundamental,
    priceOverlays: Object.freeze(priceOverlays),
    priceAnalyses: Object.freeze(priceAnalyses),
    activePricePointers: Object.freeze(activePricePointers),
  });
  return Object.freeze({
    state: nextState,
    event: 'historical_price_deleted' as const,
    affected: AFFECTED,
    unaffected: UNAFFECTED,
  });
}
