import { freezeDomainRecord } from '../model';
import { normalizeHistoricalPriceObservation } from './csv-parser';
import type { HistoricalPriceObservation } from './types';

export interface ManualHistoricalPriceEntry {
  readonly date: unknown;
  readonly priceDecimal: unknown;
}

/** Normalizes manual input through the exact same canonical observation path as CSV. */
export function normalizeManualHistoricalPriceEntries(
  entries: readonly ManualHistoricalPriceEntry[],
): readonly HistoricalPriceObservation[] {
  if (entries.length === 0) {
    throw new TypeError('MANUAL_PRICE_ENTRIES_EMPTY');
  }
  return freezeDomainRecord(entries.map((entry, index) => (
    normalizeHistoricalPriceObservation(entry.date, entry.priceDecimal, { row: index + 1 })
  )));
}
