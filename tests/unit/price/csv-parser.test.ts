import { describe, expect, it } from 'vitest';
import {
  CSV_IMPORT_LIMITS,
  PriceCsvError,
  parseHistoricalPriceCsv,
} from '../../../src/domain/price/csv-parser';

describe('historical price CSV parser', () => {
  it('accepts UTF-8 BOM, CRLF and RFC 4180 quoted ignorable cells', () => {
    const csv = '\uFEFFdate,close,note\r\n2025-01-31,10,"monthly, close"\r\n2025-02-28,12,ok\r\n';
    const parsed = parseHistoricalPriceCsv(csv, { ignorableColumns: ['note'] });
    expect(parsed.headers).toEqual(['date', 'close', 'note']);
    expect(parsed.observations).toEqual([
      { date: '2025-01-31', priceDecimal: '10' },
      { date: '2025-02-28', priceDecimal: '12' },
    ]);
    expect(parsed.rowCount).toBe(2);
    expect(parsed.byteLength).toBe(new TextEncoder().encode(csv).byteLength);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it('matches headers only after trim and case-fold and rejects unknown columns', () => {
    expect(parseHistoricalPriceCsv(' Date , CLOSE \n2025-01-31,10').observations).toHaveLength(1);
    expect(() => parseHistoricalPriceCsv('date,close,volume\n2025-01-31,10,2')).toThrowError(
      expect.objectContaining({ code: 'CSV_UNKNOWN_COLUMN' }),
    );
  });

  it('rejects missing, duplicate and structurally inconsistent headers', () => {
    expect(() => parseHistoricalPriceCsv('date\n2025-01-31')).toThrowError(
      expect.objectContaining({ code: 'CSV_REQUIRED_COLUMN_MISSING' }),
    );
    expect(() => parseHistoricalPriceCsv('date,DATE,close\n2025-01-31,x,10')).toThrowError(
      expect.objectContaining({ code: 'CSV_DUPLICATE_HEADER' }),
    );
    expect(() => parseHistoricalPriceCsv('date,close\n2025-01-31')).toThrowError(
      expect.objectContaining({ code: 'CSV_INVALID_STRUCTURE' }),
    );
  });

  it('requires valid dates and positive canonical DecimalString prices', () => {
    for (const value of ['10.0', '01', '0', '-1', '1e2']) {
      expect(() => parseHistoricalPriceCsv(`date,close\n2025-01-31,${value}`)).toThrow(PriceCsvError);
    }
    expect(() => parseHistoricalPriceCsv('date,close\n2025-02-30,10')).toThrowError(
      expect.objectContaining({ code: 'CSV_INVALID_DATE' }),
    );
  });

  it('publishes its normative resource limits as constants', () => {
    expect(CSV_IMPORT_LIMITS).toEqual({
      maximumBytes: 5 * 1024 * 1024,
      maximumRows: 50_000,
      maximumColumns: 8,
      maximumCellCharacters: 128,
    });
  });
});
