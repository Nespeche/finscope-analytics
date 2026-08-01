import {
  assertDecimalString,
  parseDecimalString,
  type DecimalString,
} from '../../core/decimal';
import { freezeDomainRecord } from '../model';
import type { HistoricalPriceObservation } from './types';

export const CSV_IMPORT_LIMITS = Object.freeze({
  maximumBytes: 5 * 1024 * 1024,
  maximumRows: 50_000,
  maximumColumns: 8,
  maximumCellCharacters: 128,
});

export type PriceCsvErrorCode =
  | 'CSV_TOO_LARGE'
  | 'CSV_INVALID_UTF8'
  | 'CSV_BINARY_CONTENT'
  | 'CSV_INVALID_STRUCTURE'
  | 'CSV_TOO_MANY_ROWS'
  | 'CSV_TOO_MANY_COLUMNS'
  | 'CSV_CELL_TOO_LONG'
  | 'CSV_EMPTY'
  | 'CSV_DUPLICATE_HEADER'
  | 'CSV_UNKNOWN_COLUMN'
  | 'CSV_REQUIRED_COLUMN_MISSING'
  | 'CSV_FORMULA_INJECTION'
  | 'CSV_INVALID_DATE'
  | 'CSV_INVALID_PRICE';

export class PriceCsvError extends TypeError {
  constructor(
    readonly code: PriceCsvErrorCode,
    message: string,
    readonly row?: number,
    readonly column?: number,
  ) {
    super(message);
    this.name = 'PriceCsvError';
  }
}

export interface PriceCsvMapping {
  readonly dateColumn?: string;
  readonly priceColumn?: string;
  readonly ignorableColumns?: readonly string[];
}

export interface ParsedHistoricalPriceCsv {
  readonly headers: readonly string[];
  readonly observations: readonly HistoricalPriceObservation[];
  readonly rowCount: number;
  readonly byteLength: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const SPREADSHEET_FORMULA_PREFIX = /^[\t\v\f \u00a0]*[=+\-@]/u;

function error(
  code: PriceCsvErrorCode,
  message: string,
  row?: number,
  column?: number,
): never {
  throw new PriceCsvError(code, message, row, column);
}

function cellCharacterCount(value: string): number {
  return Array.from(value).length;
}

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function validateIsoDate(value: string, row?: number, column?: number): string {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return error('CSV_INVALID_DATE', `Invalid ISO date ${JSON.stringify(value)}.`, row, column);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return error('CSV_INVALID_DATE', `Invalid calendar date ${JSON.stringify(value)}.`, row, column);
  }
  return value;
}

function validatePrice(value: string, row?: number, column?: number): DecimalString {
  try {
    assertDecimalString(value);
    if (parseDecimalString(value).lessThanOrEqualTo(0)) {
      return error('CSV_INVALID_PRICE', 'Historical prices must be greater than zero.', row, column);
    }
    return value;
  } catch (caught) {
    if (caught instanceof PriceCsvError) throw caught;
    return error(
      'CSV_INVALID_PRICE',
      `Historical price must be a positive canonical DecimalString: ${JSON.stringify(value)}.`,
      row,
      column,
    );
  }
}

/** Shared normalizer used by both CSV and manual-entry paths. */
export function normalizeHistoricalPriceObservation(
  dateInput: unknown,
  priceInput: unknown,
  location: Readonly<{ row?: number; dateColumn?: number; priceColumn?: number }> = {},
): HistoricalPriceObservation {
  if (typeof dateInput !== 'string') {
    return error('CSV_INVALID_DATE', 'Historical price date must be a string.', location.row, location.dateColumn);
  }
  if (typeof priceInput !== 'string') {
    return error('CSV_INVALID_PRICE', 'Historical price must be a string.', location.row, location.priceColumn);
  }
  const date = validateIsoDate(dateInput.trim(), location.row, location.dateColumn);
  const priceDecimal = validatePrice(priceInput.trim(), location.row, location.priceColumn);
  return freezeDomainRecord({ date, priceDecimal });
}

function decodeUtf8(input: Uint8Array | string): Readonly<{ text: string; byteLength: number }> {
  const encoded = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (encoded.byteLength > CSV_IMPORT_LIMITS.maximumBytes) {
    return error(
      'CSV_TOO_LARGE',
      `CSV exceeds ${CSV_IMPORT_LIMITS.maximumBytes} bytes.`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
  } catch {
    return error('CSV_INVALID_UTF8', 'CSV must be valid UTF-8.');
  }
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0 || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d)) {
      return error('CSV_BINARY_CONTENT', `CSV contains forbidden control byte at character ${index}.`);
    }
  }
  return Object.freeze({ text, byteLength: encoded.byteLength });
}

function parseRfc4180(text: string): readonly (readonly string[])[] {
  if (text.length === 0) return error('CSV_EMPTY', 'CSV is empty.');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quotedField = false;
  let afterClosingQuote = false;

  const pushField = (): void => {
    if (cellCharacterCount(field) > CSV_IMPORT_LIMITS.maximumCellCharacters) {
      error(
        'CSV_CELL_TOO_LONG',
        `Cell exceeds ${CSV_IMPORT_LIMITS.maximumCellCharacters} characters.`,
        rows.length + 1,
        row.length + 1,
      );
    }
    row.push(field);
    if (row.length > CSV_IMPORT_LIMITS.maximumColumns) {
      error(
        'CSV_TOO_MANY_COLUMNS',
        `Row exceeds ${CSV_IMPORT_LIMITS.maximumColumns} columns.`,
        rows.length + 1,
        row.length,
      );
    }
    field = '';
    quotedField = false;
    afterClosingQuote = false;
  };

  const pushRow = (): void => {
    pushField();
    rows.push(row);
    if (rows.length - 1 > CSV_IMPORT_LIMITS.maximumRows) {
      error('CSV_TOO_MANY_ROWS', `CSV exceeds ${CSV_IMPORT_LIMITS.maximumRows} data rows.`);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === undefined) continue;

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        field += character;
      }
    } else if (afterClosingQuote) {
      if (character === ',') {
        pushField();
      } else if (character === '\n') {
        pushRow();
      } else if (character === '\r' && text[index + 1] === '\n') {
        pushRow();
        index += 1;
      } else {
        error(
          'CSV_INVALID_STRUCTURE',
          'Only delimiter or line ending may follow a closing quote.',
          rows.length + 1,
          row.length + 1,
        );
      }
    } else if (character === '"') {
      if (field.length !== 0 || quotedField) {
        error(
          'CSV_INVALID_STRUCTURE',
          'Quote may only begin an empty field.',
          rows.length + 1,
          row.length + 1,
        );
      }
      inQuotes = true;
      quotedField = true;
    } else if (character === ',') {
      pushField();
    } else if (character === '\n') {
      pushRow();
    } else if (character === '\r') {
      if (text[index + 1] !== '\n') {
        error('CSV_INVALID_STRUCTURE', 'CSV line endings must be LF or CRLF.', rows.length + 1);
      }
      pushRow();
      index += 1;
    } else {
      field += character;
    }

    if (cellCharacterCount(field) > CSV_IMPORT_LIMITS.maximumCellCharacters) {
      error(
        'CSV_CELL_TOO_LONG',
        `Cell exceeds ${CSV_IMPORT_LIMITS.maximumCellCharacters} characters.`,
        rows.length + 1,
        row.length + 1,
      );
    }
  }

  if (inQuotes) {
    return error('CSV_INVALID_STRUCTURE', 'CSV contains an unterminated quoted field.');
  }
  if (row.length > 0 || field.length > 0 || afterClosingQuote || text.endsWith(',')) {
    pushRow();
  }
  if (rows.length === 0) return error('CSV_EMPTY', 'CSV is empty.');
  return Object.freeze(rows.map((item) => Object.freeze(item)));
}

function ensureNoFormulaInjection(value: string, row: number, column: number): void {
  if (SPREADSHEET_FORMULA_PREFIX.test(value)) {
    error(
      'CSV_FORMULA_INJECTION',
      `Spreadsheet formula prefix is forbidden at row ${row}, column ${column}.`,
      row,
      column,
    );
  }
}

export function parseHistoricalPriceCsv(
  input: Uint8Array | string,
  mapping: PriceCsvMapping = {},
): ParsedHistoricalPriceCsv {
  const decoded = decodeUtf8(input);
  const rows = parseRfc4180(decoded.text);
  const headerRow = rows[0];
  if (headerRow === undefined || headerRow.length === 0) {
    return error('CSV_EMPTY', 'CSV header is missing.');
  }

  const normalizedHeaders = headerRow.map(normalizeHeader);
  const duplicateHeaders = normalizedHeaders.filter(
    (header, index) => normalizedHeaders.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    return error('CSV_DUPLICATE_HEADER', `Duplicate CSV header: ${duplicateHeaders[0]}.`, 1);
  }

  const dateHeader = normalizeHeader(mapping.dateColumn ?? 'date');
  const priceHeader = normalizeHeader(mapping.priceColumn ?? 'close');
  const ignorable = new Set((mapping.ignorableColumns ?? []).map(normalizeHeader));
  const allowed = new Set([dateHeader, priceHeader, ...ignorable]);
  for (const header of normalizedHeaders) {
    if (!allowed.has(header)) {
      return error('CSV_UNKNOWN_COLUMN', `Unknown CSV column: ${header}.`, 1);
    }
  }

  const dateIndex = normalizedHeaders.indexOf(dateHeader);
  const priceIndex = normalizedHeaders.indexOf(priceHeader);
  if (dateIndex < 0) {
    return error('CSV_REQUIRED_COLUMN_MISSING', `Required date column ${dateHeader} is missing.`, 1);
  }
  if (priceIndex < 0) {
    return error('CSV_REQUIRED_COLUMN_MISSING', `Required price column ${priceHeader} is missing.`, 1);
  }

  const observations: HistoricalPriceObservation[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    if (values === undefined) continue;
    if (values.length !== headerRow.length) {
      return error(
        'CSV_INVALID_STRUCTURE',
        `Row ${index + 1} has ${values.length} columns; expected ${headerRow.length}.`,
        index + 1,
      );
    }
    if (values.every((value) => value === '')) continue;
    for (let column = 0; column < values.length; column += 1) {
      const value = values[column];
      if (value !== undefined) ensureNoFormulaInjection(value, index + 1, column + 1);
    }
    observations.push(normalizeHistoricalPriceObservation(
      values[dateIndex],
      values[priceIndex],
      { row: index + 1, dateColumn: dateIndex + 1, priceColumn: priceIndex + 1 },
    ));
  }

  if (observations.length === 0) {
    return error('CSV_EMPTY', 'CSV contains no historical price observations.');
  }

  return freezeDomainRecord({
    headers: normalizedHeaders,
    observations,
    rowCount: observations.length,
    byteLength: decoded.byteLength,
  });
}
