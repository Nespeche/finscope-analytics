import { describe, expect, it } from 'vitest';
import { parseHistoricalPriceCsv } from '../../../src/domain/price/csv-parser';
import { normalizeManualHistoricalPriceEntries } from '../../../src/domain/price/manual-entry';

describe('manual historical price entry', () => {
  it('produces the exact canonical observation model used by CSV', () => {
    const csv = parseHistoricalPriceCsv('date,close\n2025-01-31,10\n2025-02-28,12');
    const manual = normalizeManualHistoricalPriceEntries([
      { date: ' 2025-01-31 ', priceDecimal: ' 10 ' },
      { date: '2025-02-28', priceDecimal: '12' },
    ]);
    expect(manual).toEqual(csv.observations);
    expect(Object.isFrozen(manual)).toBe(true);
  });

  it('rejects empty, invalid-date and non-canonical price input', () => {
    expect(() => normalizeManualHistoricalPriceEntries([])).toThrow('MANUAL_PRICE_ENTRIES_EMPTY');
    expect(() => normalizeManualHistoricalPriceEntries([
      { date: '2025-02-30', priceDecimal: '10' },
    ])).toThrow();
    expect(() => normalizeManualHistoricalPriceEntries([
      { date: '2025-02-28', priceDecimal: '10.0' },
    ])).toThrow();
  });
});
