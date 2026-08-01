import { describe, expect, it, vi } from 'vitest';
import {
  CSV_IMPORT_LIMITS,
  PriceCsvError,
  parseHistoricalPriceCsv,
} from '../../../src/domain/price/csv-parser';

function expectCode(action: () => unknown, code: PriceCsvError['code']): void {
  try {
    action();
    throw new Error('Expected PriceCsvError.');
  } catch (error) {
    expect(error).toBeInstanceOf(PriceCsvError);
    expect((error as PriceCsvError).code).toBe(code);
  }
}

describe('historical price CSV fail-closed security gates', () => {
  it('rejects size before parsing or persistence', () => {
    const persist = vi.fn();
    const bytes = new Uint8Array(CSV_IMPORT_LIMITS.maximumBytes + 1);
    expectCode(() => parseHistoricalPriceCsv(bytes), 'CSV_TOO_LARGE');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects more than 50,000 data rows before persistence', () => {
    const persist = vi.fn();
    const rows = Array.from(
      { length: CSV_IMPORT_LIMITS.maximumRows + 1 },
      (_, index) => `2025-01-01,${index + 1}`,
    );
    expectCode(() => parseHistoricalPriceCsv(`date,close\n${rows.join('\n')}`), 'CSV_TOO_MANY_ROWS');
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects more than eight columns and cells longer than 128 characters', () => {
    expectCode(
      () => parseHistoricalPriceCsv('date,close,a,b,c,d,e,f,g\n2025-01-01,1,,,,,,,'),
      'CSV_TOO_MANY_COLUMNS',
    );
    expectCode(
      () => parseHistoricalPriceCsv(`date,close,note\n2025-01-01,1,${'x'.repeat(129)}`, {
        ignorableColumns: ['note'],
      }),
      'CSV_CELL_TOO_LONG',
    );
  });

  it.each(['=1+1', '+SUM(A1)', '-1', '@cmd'])('rejects spreadsheet formula prefix %s', (value: string) => {
    expectCode(() => parseHistoricalPriceCsv(`date,close\n2025-01-01,${value}`), 'CSV_FORMULA_INJECTION');
  });

  it('rejects NUL/control content, invalid UTF-8 and malformed quoting', () => {
    expectCode(() => parseHistoricalPriceCsv('date,close\n2025-01-01,1\0'), 'CSV_BINARY_CONTENT');
    expectCode(
      () => parseHistoricalPriceCsv(Uint8Array.from([0x64, 0x61, 0x74, 0x65, 0xff])),
      'CSV_INVALID_UTF8',
    );
    expectCode(() => parseHistoricalPriceCsv('date,close\n"2025-01-01,1'), 'CSV_INVALID_STRUCTURE');
  });
});
