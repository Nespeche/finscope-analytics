const cikBrand: unique symbol = Symbol('Cik');

export type Cik = string & { readonly [cikBrand]: true };

export const CIK_PATTERN = /^[0-9]{10}$/u;
const CIK_ALIAS_PATTERN = /^[0-9]{1,10}$/u;

export function isCik(value: unknown): value is Cik {
  return typeof value === 'string' && CIK_PATTERN.test(value);
}

export function parseCik(value: unknown): Cik {
  if (!isCik(value)) {
    throw new TypeError('INVALID_CIK');
  }
  return value;
}

export function normalizeCik(value: unknown): Cik {
  let digits: string;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0 || value > 9_999_999_999) {
      throw new TypeError('INVALID_CIK');
    }
    digits = String(value);
  } else if (typeof value === 'string') {
    digits = value.trim();
  } else {
    throw new TypeError('INVALID_CIK');
  }

  if (!CIK_ALIAS_PATTERN.test(digits)) {
    throw new TypeError('INVALID_CIK');
  }
  return parseCik(digits.padStart(10, '0'));
}

export function toSecCikPathSegment(cik: Cik): `CIK${Cik}` {
  return `CIK${parseCik(cik)}`;
}

export function toSecCikFilename(cik: Cik): `CIK${Cik}.json` {
  return `${toSecCikPathSegment(cik)}.json`;
}
