import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  ACTIVE_PRODUCT_SCHEMAS,
  type ProductSchemaDocument,
} from './schema-registry';

export interface NormalizedSchemaError {
  readonly instancePath: string;
  readonly schemaPath: string;
  readonly keyword: string;
  readonly message: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export type SchemaValidationResult<T> =
  | Readonly<{ valid: true; value: T }>
  | Readonly<{ valid: false; errors: readonly NormalizedSchemaError[] }>;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = daysByMonth[month - 1];
  return month >= 1 && month <= 12 && days !== undefined && day >= 1 && day <= days;
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    return false;
  }
  const [, yearText, monthText, dayText] = match;
  return yearText !== undefined
    && monthText !== undefined
    && dayText !== undefined
    && isCalendarDate(Number(yearText), Number(monthText), Number(dayText));
}

export function isRfc3339DateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/u.exec(value);
  if (match === null) {
    return false;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  if (
    yearText === undefined
    || monthText === undefined
    || dayText === undefined
    || hourText === undefined
    || minuteText === undefined
    || secondText === undefined
  ) {
    return false;
  }
  if (!isCalendarDate(Number(yearText), Number(monthText), Number(dayText))) {
    return false;
  }
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) {
    return false;
  }
  return offsetHourText === undefined
    || offsetMinuteText === undefined
    || (Number(offsetHourText) <= 23 && Number(offsetMinuteText) <= 59);
}

export function isAbsoluteUri(value: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) {
    return false;
  }
  try {
    const uri = new URL(value);
    return uri.protocol.length > 1;
  } catch {
    return false;
  }
}

function normalizeErrors(errors: readonly ErrorObject[] | null | undefined): readonly NormalizedSchemaError[] {
  const normalized = (errors ?? []).map((error) => Object.freeze({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? 'Schema validation failed.',
    params: Object.freeze({ ...error.params }) as Readonly<Record<string, unknown>>,
  }));
  normalized.sort((left, right) => left.instancePath.localeCompare(right.instancePath, 'en')
    || left.schemaPath.localeCompare(right.schemaPath, 'en')
    || left.keyword.localeCompare(right.keyword, 'en'));
  return Object.freeze(normalized);
}

export class ProductSchemaValidator {
  readonly compiledSchemaIds: readonly string[];
  readonly compilationCount: number;
  readonly #ajv: Ajv2020;
  readonly #validators: ReadonlyMap<string, ValidateFunction>;

  constructor(schemas: readonly ProductSchemaDocument[] = ACTIVE_PRODUCT_SCHEMAS) {
    this.#ajv = new Ajv2020({
      allErrors: true,
      strictSchema: true,
      strictNumbers: true,
      strictTuples: true,
      allowUnionTypes: false,
      strictRequired: false,
      strictTypes: false,
      validateFormats: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
    });
    this.#ajv.addFormat('date', { type: 'string', validate: isIsoDate });
    this.#ajv.addFormat('date-time', { type: 'string', validate: isRfc3339DateTime });
    this.#ajv.addFormat('uri', { type: 'string', validate: isAbsoluteUri });

    for (const schema of schemas) {
      this.#ajv.addSchema(schema, schema.$id);
    }

    const validators = new Map<string, ValidateFunction>();
    for (const schema of schemas) {
      const validator = this.#ajv.getSchema(schema.$id);
      if (validator === undefined) {
        throw new Error(`Ajv did not compile active product schema: ${schema.$id}`);
      }
      validators.set(schema.$id, validator);
    }

    this.#validators = validators;
    this.compiledSchemaIds = Object.freeze([...validators.keys()]);
    this.compilationCount = validators.size;
  }

  validate<T = unknown>(schemaReference: string, input: unknown): SchemaValidationResult<T> {
    const validator = this.#validators.get(schemaReference) ?? this.#ajv.getSchema(schemaReference);
    if (validator === undefined) {
      throw new Error(`Unknown or uncompiled product schema reference: ${schemaReference}`);
    }
    if (validator(input)) {
      return Object.freeze({ valid: true, value: input as T });
    }
    return Object.freeze({ valid: false, errors: normalizeErrors(validator.errors) });
  }
}

export function createProductSchemaValidator(
  schemas: readonly ProductSchemaDocument[] = ACTIVE_PRODUCT_SCHEMAS,
): ProductSchemaValidator {
  return new ProductSchemaValidator(schemas);
}
