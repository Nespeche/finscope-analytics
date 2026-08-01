import { describe, expect, it } from 'vitest';
import {
  applyHistoricalPriceDeletion,
  applyHistoricalPriceImport,
  applyHistoricalPriceReplacement,
  type PricePersistenceState,
} from '../../../src/domain/orchestration/price-events';
import { parseHistoricalPriceOverlay, parsePriceAnalysis } from '../../../src/domain/price/types';

function overlay(version: number, fingerprintCharacter: string) {
  return parseHistoricalPriceOverlay({
    overlayId: 'price-overlay-0000320193-aapl',
    overlayVersion: version,
    contractVersion: '5.0.0',
    issuerCik: '0000320193',
    instrument: { symbol: 'AAPL', venueMic: 'XNAS' },
    currency: 'USD',
    frequency: 'monthly',
    observations: [{ date: '2025-01-31', priceDecimal: String(9 + version) }],
    adjustmentStatus: 'unadjusted',
    origin: { profileId: 'local_csv_manual_v1', method: 'manual_entry' },
    warnings: [],
    priceUse: 'historical_descriptive_only',
    historicalPriceOverlayFingerprint: `sha256:${fingerprintCharacter.repeat(64)}`,
    priceQuality: {
      classification: 'verified',
      axes: {
        rowValidity: 'all_valid',
        dateIntegrity: 'unique_sorted',
        currencyIntegrity: 'single_declared',
        adjustmentDisclosure: 'declared',
      },
    },
  });
}

function analysis(id: string, overlayFingerprint: string, fingerprintCharacter: string) {
  return parsePriceAnalysis({
    analysisKind: 'historical_price_descriptive',
    analysisId: id,
    issuerCik: '0000320193',
    historicalPriceOverlayFingerprint: overlayFingerprint,
    priceQuality: {
      classification: 'verified',
      axes: {
        rowValidity: 'all_valid',
        dateIntegrity: 'unique_sorted',
        currencyIntegrity: 'single_declared',
        adjustmentDisclosure: 'declared',
      },
    },
    priceMetricResults: [],
    versions: { metricCatalog: '5.0.1' },
    priceAnalysisFingerprint: `sha256:${fingerprintCharacter.repeat(64)}`,
  });
}

function initialState(): PricePersistenceState {
  const fundamental = {
    bundles: Object.freeze({ bundle: { id: 'bundle-1' } }),
    analyses: Object.freeze({ analysis: { id: 'fundamental-analysis-1' } }),
    snapshots: Object.freeze({ snapshot: { id: 'snapshot-1' } }),
    activeSnapshotPointers: Object.freeze({ '0000320193': { snapshotId: 'snapshot-1' } }),
    fingerprints: Object.freeze({
      fundamentalInputFingerprint: `sha256:${'1'.repeat(64)}`,
      fundamentalAnalysisFingerprint: `sha256:${'2'.repeat(64)}`,
    }),
  };
  return Object.freeze({
    fundamental,
    priceOverlays: Object.freeze({}),
    priceAnalyses: Object.freeze({}),
    activePricePointers: Object.freeze({}),
  });
}

function expectFundamentalsIdentical(before: PricePersistenceState, after: PricePersistenceState): void {
  expect(after.fundamental).toBe(before.fundamental);
  expect(after.fundamental.bundles).toBe(before.fundamental.bundles);
  expect(after.fundamental.analyses).toBe(before.fundamental.analyses);
  expect(after.fundamental.snapshots).toBe(before.fundamental.snapshots);
  expect(after.fundamental.activeSnapshotPointers).toBe(before.fundamental.activeSnapshotPointers);
  expect(after.fundamental.fingerprints).toBe(before.fundamental.fingerprints);
  expect(after.fundamental.fingerprints).toEqual(before.fundamental.fingerprints);
}

describe('price event isolation from the fundamental domain', () => {
  it('imports, replaces and deletes price while preserving all fundamental artifacts', () => {
    const initial = initialState();
    const firstOverlay = overlay(1, 'a');
    const firstAnalysis = analysis('price-analysis-1', firstOverlay.historicalPriceOverlayFingerprint, 'b');
    const imported = applyHistoricalPriceImport(initial, {
      overlay: firstOverlay,
      analysis: firstAnalysis,
      expectedPointerGeneration: 0,
    });
    expectFundamentalsIdentical(initial, imported.state);
    expect(imported.state.activePricePointers['0000320193']?.generation).toBe(1);

    const secondOverlay = overlay(2, 'c');
    const secondAnalysis = analysis('price-analysis-2', secondOverlay.historicalPriceOverlayFingerprint, 'd');
    const replaced = applyHistoricalPriceReplacement(imported.state, {
      overlay: secondOverlay,
      analysis: secondAnalysis,
      expectedPointerGeneration: 1,
    });
    expectFundamentalsIdentical(imported.state, replaced.state);
    expect(replaced.state.activePricePointers['0000320193']).toMatchObject({
      overlayVersion: 2,
      analysisId: 'price-analysis-2',
      generation: 2,
    });
    expect(Object.keys(replaced.state.priceOverlays)).toHaveLength(2);

    const deleted = applyHistoricalPriceDeletion(replaced.state, '0000320193', 2);
    expectFundamentalsIdentical(replaced.state, deleted.state);
    expect(deleted.state.activePricePointers).toEqual({});
    expect(deleted.state.priceOverlays).toEqual({});
    expect(deleted.state.priceAnalyses).toEqual({});
  });

  it('fails atomically on fingerprint mismatch or stale pointer generation', () => {
    const initial = initialState();
    const candidateOverlay = overlay(1, 'a');
    const mismatched = analysis('price-analysis-bad', `sha256:${'f'.repeat(64)}`, 'b');
    expect(() => applyHistoricalPriceImport(initial, {
      overlay: candidateOverlay,
      analysis: mismatched,
    })).toThrow('PRICE_ANALYSIS_OVERLAY_FINGERPRINT_MISMATCH');
    expect(initial.priceOverlays).toEqual({});
    expect(initial.activePricePointers).toEqual({});

    const valid = analysis('price-analysis-1', candidateOverlay.historicalPriceOverlayFingerprint, 'b');
    const imported = applyHistoricalPriceImport(initial, { overlay: candidateOverlay, analysis: valid });
    expect(() => applyHistoricalPriceDeletion(imported.state, '0000320193', 0)).toThrow(
      'PRICE_POINTER_COMPARE_AND_SWAP_FAILED',
    );
    expect(imported.state.activePricePointers['0000320193']?.generation).toBe(1);
  });
});
