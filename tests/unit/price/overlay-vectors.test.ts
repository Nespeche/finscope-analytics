import { describe, expect, it } from 'vitest';
import overlayVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/price/historical-price-overlay-test-vectors.json';
import { parseCik } from '../../../src/domain/model';
import {
  confirmHistoricalPriceImport,
  createHistoricalPriceImportPreview,
} from '../../../src/domain/price/import-preview';
import { normalizeManualHistoricalPriceEntries } from '../../../src/domain/price/manual-entry';
import {
  buildHistoricalPriceOverlay,
  type HistoricalPriceOverlayBuilderInput,
} from '../../../src/domain/price/overlay-builder';
import { parseHistoricalPriceOverlay } from '../../../src/domain/price/types';

const normativeValid = overlayVectorsJson.fixtures.find(
  (fixture) => fixture.fixtureId === 'PRICE-OVERLAY-VALID',
)?.input;

function confirmedImport(prices: readonly string[] = ['10', '12', '11', '15']) {
  const observations = normalizeManualHistoricalPriceEntries(prices.map((priceDecimal, index) => ({
    date: `2025-0${index + 1}-${index === 1 ? '28' : '30'}`,
    priceDecimal,
  })));
  const preview = createHistoricalPriceImportPreview({
    previewId: 'preview-overlay',
    scope: {
      issuerCik: parseCik('0000320193'),
      instrument: { symbol: 'AAPL', venueMic: 'XNAS' },
      currency: 'USD',
      frequency: 'monthly',
      adjustmentStatus: 'unadjusted',
    },
    source: { method: 'manual_entry', profileId: 'local_csv_manual_v1' },
    observations,
  });
  return confirmHistoricalPriceImport(preview, true);
}

describe('versioned historical price overlay builder', () => {
  it('accepts the normative valid schema fixture and rejects its local-clock vector', () => {
    expect(parseHistoricalPriceOverlay(normativeValid)).toBeDefined();
    const clockVector = overlayVectorsJson.fixtures.find(
      (fixture) => fixture.fixtureId === 'PRICE-OVERLAY-LOCAL-CLOCK-FORBIDDEN',
    );
    expect(() => parseHistoricalPriceOverlay(clockVector?.input)).toThrow('INVALID_HISTORICAL_PRICE_OVERLAY');
  });

  it('builds deterministic immutable versions without clock-derived fields', async () => {
    const first = await buildHistoricalPriceOverlay({
      overlayId: 'price-overlay-0000320193-aapl',
      overlayVersion: 1,
      confirmedImport: confirmedImport(),
    });
    const same = await buildHistoricalPriceOverlay({
      overlayId: 'price-overlay-0000320193-aapl',
      overlayVersion: 1,
      confirmedImport: confirmedImport(),
    });
    expect(first.historicalPriceOverlayFingerprint).toBe(same.historicalPriceOverlayFingerprint);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first).not.toHaveProperty('displayAgeDays');
    expect(first).not.toHaveProperty('evaluationDate');

    const second = await buildHistoricalPriceOverlay({
      overlayId: first.overlayId,
      overlayVersion: 2,
      previousOverlay: first,
      confirmedImport: confirmedImport(['10', '12', '11', '16']),
    });
    expect(second.overlayVersion).toBe(2);
    expect(second.historicalPriceOverlayFingerprint).not.toBe(first.historicalPriceOverlayFingerprint);
    expect(first.overlayVersion).toBe(1);
    expect(first.observations.at(-1)?.priceDecimal).toBe('15');
  });

  it('rejects forbidden clock fields and non-sequential replacement versions', async () => {
    const withClockField = {
      overlayId: 'price-overlay-0000320193-aapl',
      overlayVersion: 1,
      confirmedImport: confirmedImport(),
      displayAgeDays: 1,
    } as unknown as HistoricalPriceOverlayBuilderInput;
    await expect(buildHistoricalPriceOverlay(withClockField)).rejects.toThrow(
      'FORBIDDEN_PRICE_CLOCK_FIELD',
    );

    const first = await buildHistoricalPriceOverlay({
      overlayId: 'price-overlay-0000320193-aapl', overlayVersion: 1, confirmedImport: confirmedImport(),
    });
    await expect(buildHistoricalPriceOverlay({
      overlayId: first.overlayId,
      overlayVersion: 3,
      previousOverlay: first,
      confirmedImport: confirmedImport(),
    })).rejects.toThrow('PRICE_OVERLAY_VERSION_MUST_INCREMENT_BY_ONE');
  });
});
