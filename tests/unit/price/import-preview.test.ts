import { describe, expect, it, vi } from 'vitest';
import { parseCik } from '../../../src/domain/model';
import {
  confirmHistoricalPriceImport,
  createHistoricalPriceImportPreview,
  publishConfirmedHistoricalPriceImport,
} from '../../../src/domain/price/import-preview';
import { normalizeManualHistoricalPriceEntries } from '../../../src/domain/price/manual-entry';

const observations = normalizeManualHistoricalPriceEntries([
  { date: '2025-02-28', priceDecimal: '12' },
  { date: '2025-01-31', priceDecimal: '10' },
]);
const scope = {
  issuerCik: parseCik('0000320193'),
  instrument: { symbol: 'AAPL', venueMic: 'XNAS' },
  currency: 'USD',
  frequency: 'irregular' as const,
  adjustmentStatus: 'unadjusted' as const,
};
const source = { method: 'manual_entry' as const, profileId: 'local_csv_manual_v1' as const };

describe('historical price import preview and confirmation', () => {
  it('sorts observations, exposes scope/window and never persists on selection', () => {
    const persist = vi.fn();
    const preview = createHistoricalPriceImportPreview({
      previewId: 'preview-1', scope, source, observations,
    });
    expect(preview.observations.map((item) => item.date)).toEqual(['2025-01-31', '2025-02-28']);
    expect(preview.scope.window).toEqual({ startDate: '2025-01-31', endDate: '2025-02-28' });
    expect(preview.publicationAllowed).toBe(true);
    expect(preview.priceQuality.classification).toBe('verified');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects duplicate dates unless keep_last is chosen explicitly', () => {
    const duplicate = normalizeManualHistoricalPriceEntries([
      { date: '2025-01-31', priceDecimal: '10' },
      { date: '2025-01-31', priceDecimal: '11' },
    ]);
    const rejected = createHistoricalPriceImportPreview({
      previewId: 'preview-duplicates', scope, source, observations: duplicate,
    });
    expect(rejected.publicationAllowed).toBe(false);
    expect(rejected.priceQuality.classification).toBe('insufficient');
    expect(rejected.issues).toMatchObject([{ code: 'DUPLICATE_DATE', date: '2025-01-31' }]);

    const resolved = createHistoricalPriceImportPreview({
      previewId: 'preview-resolved', scope, source, observations: duplicate,
      duplicateResolution: 'keep_last',
    });
    expect(resolved.publicationAllowed).toBe(true);
    expect(resolved.observations).toEqual([{ date: '2025-01-31', priceDecimal: '11' }]);
    expect(resolved.priceQuality.axes.dateIntegrity).toBe('duplicates_resolved');
  });

  it('does not persist without confirmation or with an invalid preview', async () => {
    const preview = createHistoricalPriceImportPreview({
      previewId: 'preview-2', scope, source, observations,
    });
    const persist = vi.fn(() => 'persisted');
    expect(() => confirmHistoricalPriceImport(preview, false)).toThrow('PRICE_IMPORT_CONFIRMATION_REQUIRED');
    await expect(publishConfirmedHistoricalPriceImport(undefined, persist)).rejects.toThrow(
      'PRICE_IMPORT_CONFIRMATION_REQUIRED',
    );
    expect(persist).not.toHaveBeenCalled();

    const confirmed = confirmHistoricalPriceImport(preview, true);
    await expect(publishConfirmedHistoricalPriceImport(confirmed, persist)).resolves.toBe('persisted');
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
