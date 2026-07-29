export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export class CanonicalJsonError extends TypeError {
  constructor(
    readonly code:
      | 'INVALID_JSON_VALUE'
      | 'NON_FINITE_NUMBER'
      | 'NEGATIVE_ZERO'
      | 'INVALID_UNICODE'
      | 'CYCLIC_VALUE',
    message: string,
  ) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

const textEncoder = new TextEncoder();
const loneSurrogatePattern = /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF])/u;

function assertValidUnicode(value: string): void {
  if (loneSurrogatePattern.test(value)) {
    throw new CanonicalJsonError('INVALID_UNICODE', 'JCS input contains an unpaired UTF-16 surrogate.');
  }
}

function serializeString(value: string): string {
  assertValidUnicode(value);
  return JSON.stringify(value);
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CanonicalJsonError('NON_FINITE_NUMBER', 'JCS forbids NaN and infinities.');
  }
  if (Object.is(value, -0)) {
    throw new CanonicalJsonError('NEGATIVE_ZERO', 'FinScope canonical JSON forbids negative zero.');
  }
  return JSON.stringify(value);
}

function isPlainJsonObject(value: object): value is JsonObject {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serialize(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return serializeNumber(value);
    case 'string':
      return serializeString(value);
    case 'object': {
      if (ancestors.has(value)) {
        throw new CanonicalJsonError('CYCLIC_VALUE', 'JCS input must not contain cycles.');
      }
      ancestors.add(value);
      try {
        if (Array.isArray(value)) {
          const elements: string[] = [];
          for (let index = 0; index < value.length; index += 1) {
            if (!Object.prototype.hasOwnProperty.call(value, index)) {
              throw new CanonicalJsonError('INVALID_JSON_VALUE', 'JCS input must not contain sparse arrays.');
            }
            elements.push(serialize(value[index], ancestors));
          }
          return `[${elements.join(',')}]`;
        }
        if (!isPlainJsonObject(value)) {
          throw new CanonicalJsonError(
            'INVALID_JSON_VALUE',
            'JCS input must contain only plain JSON objects.',
          );
        }
        if (Object.getOwnPropertySymbols(value).length > 0) {
          throw new CanonicalJsonError('INVALID_JSON_VALUE', 'JCS input must not contain symbol keys.');
        }
        const keys = Object.keys(value).sort();
        const members = keys.map((key) => `${serializeString(key)}:${serialize(value[key], ancestors)}`);
        return `{${members.join(',')}}`;
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      throw new CanonicalJsonError(
        'INVALID_JSON_VALUE',
        `JCS cannot serialize a value of type ${typeof value}.`,
      );
  }
}

export function canonicalizeJson(value: JsonValue): string {
  return serialize(value, new Set<object>());
}

export function canonicalJsonBytes(value: JsonValue): Uint8Array {
  return textEncoder.encode(canonicalizeJson(value));
}
