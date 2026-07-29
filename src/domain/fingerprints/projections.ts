import { assertDecimalString } from '../../core/decimal';
import { isSha256Digest } from '../../core/sha256';
import type { JsonObject, JsonValue } from '../../core/canonical-json';

export type FingerprintProjectionId =
  | 'fundamentalInputFingerprint'
  | 'fundamentalAnalysisFingerprint'
  | 'historicalPriceOverlayFingerprint'
  | 'priceAnalysisFingerprint'
  | 'sourceEvidenceFingerprint';

export interface SourceEvidenceReferenceInput {
  readonly sourceKind: string;
  readonly sourceId?: string;
  readonly canonicalUrl?: string;
  readonly accessionNumber?: string;
  readonly payloadSha256: string;
  readonly retrievedVersion: string;
}

export class FingerprintProjectionError extends TypeError {
  constructor(
    readonly code:
      | 'INVALID_PROJECTION_INPUT'
      | 'MISSING_PROJECTION_FIELD'
      | 'NULL_NOT_ALLOWED'
      | 'FORBIDDEN_PROJECTION_FIELD'
      | 'INVALID_DECIMAL_STRING'
      | 'INVALID_SHA256'
      | 'UNSORTED_OBSERVATIONS'
      | 'AMBIGUOUS_EVIDENCE_ID',
    message: string,
  ) {
    super(message);
    this.name = 'FingerprintProjectionError';
  }
}

const RAW_SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const FINGERPRINT_KEY_PATTERN = /Fingerprint$/u;
const LOCAL_CLOCK_KEYS = new Set([
  'asOfLocalDate',
  'localDate',
  'localTime',
  'localTimezone',
  'localTimestamp',
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new FingerprintProjectionError(
      'INVALID_PROJECTION_INPUT',
      `${path} must be a JSON object.`,
    );
  }
  return value;
}

function array(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new FingerprintProjectionError(
      'INVALID_PROJECTION_INPUT',
      `${path} must be an array.`,
    );
  }
  return value;
}

function required(source: Readonly<Record<string, unknown>>, key: string, path: string): unknown {
  if (!Object.hasOwn(source, key) || source[key] === undefined) {
    throw new FingerprintProjectionError(
      'MISSING_PROJECTION_FIELD',
      `${path}.${key} is required by the active projection.`,
    );
  }
  return source[key];
}

function rejectNull(value: unknown, path: string): void {
  if (value === null) {
    throw new FingerprintProjectionError('NULL_NOT_ALLOWED', `${path} must be absent rather than null.`);
  }
}

function validateRawSha256(value: unknown, path: string): string {
  if (typeof value !== 'string' || !RAW_SHA256_PATTERN.test(value)) {
    throw new FingerprintProjectionError('INVALID_SHA256', `${path} must be 64 lowercase hex characters.`);
  }
  return value;
}

function validateFingerprint(value: unknown, path: string): string {
  if (!isSha256Digest(value)) {
    throw new FingerprintProjectionError('INVALID_SHA256', `${path} must be sha256:<64 lowercase hex>.`);
  }
  return value;
}

function sanitizeJson(
  value: unknown,
  path: string,
  allowedFingerprintKeys: ReadonlySet<string> = new Set<string>(),
): JsonValue {
  rejectNull(value, path);
  switch (typeof value) {
    case 'string': {
      const key = path.split('.').at(-1) ?? '';
      if (key.endsWith('Decimal')) {
        try {
          assertDecimalString(value);
        } catch (error) {
          throw new FingerprintProjectionError(
            'INVALID_DECIMAL_STRING',
            `${path} is not a canonical DecimalString: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return value;
    }
    case 'number':
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        throw new FingerprintProjectionError(
          'INVALID_PROJECTION_INPUT',
          `${path} contains a non-finite number or negative zero.`,
        );
      }
      return value;
    case 'boolean':
      return value;
    case 'object':
      if (Array.isArray(value)) {
        return value.map((item, index) => sanitizeJson(item, `${path}[${index}]`, allowedFingerprintKeys));
      }
      if (!isRecord(value)) {
        throw new FingerprintProjectionError('INVALID_PROJECTION_INPUT', `${path} is not plain JSON.`);
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        if (LOCAL_CLOCK_KEYS.has(key)) {
          throw new FingerprintProjectionError(
            'FORBIDDEN_PROJECTION_FIELD',
            `${path}.${key} is a prohibited local-clock field.`,
          );
        }
        if (FINGERPRINT_KEY_PATTERN.test(key) && !allowedFingerprintKeys.has(key)) {
          throw new FingerprintProjectionError(
            'FORBIDDEN_PROJECTION_FIELD',
            `${path}.${key} is a prohibited nested fingerprint field.`,
          );
        }
        return [key, sanitizeJson(child, `${path}.${key}`, allowedFingerprintKeys)];
      })) as JsonObject;
    default:
      throw new FingerprintProjectionError(
        'INVALID_PROJECTION_INPUT',
        `${path} contains a non-JSON value of type ${typeof value}.`,
      );
  }
}

function rejectForbiddenKeys(
  source: Readonly<Record<string, unknown>>,
  path: string,
  allowedFingerprintKeys: ReadonlySet<string>,
): void {
  for (const key of Object.keys(source)) {
    if (LOCAL_CLOCK_KEYS.has(key)) {
      throw new FingerprintProjectionError(
        'FORBIDDEN_PROJECTION_FIELD',
        `${path}.${key} is a prohibited local-clock field.`,
      );
    }
    if (FINGERPRINT_KEY_PATTERN.test(key) && !allowedFingerprintKeys.has(key)) {
      throw new FingerprintProjectionError(
        'FORBIDDEN_PROJECTION_FIELD',
        `${path}.${key} is a prohibited nested fingerprint field.`,
      );
    }
  }
}

function selectObject(
  sourceValue: unknown,
  fields: readonly string[],
  path: string,
  requiredFields: ReadonlySet<string> = new Set(fields),
  allowedFingerprintKeys: ReadonlySet<string> = new Set<string>(),
): JsonObject {
  const source = record(sourceValue, path);
  rejectForbiddenKeys(source, path, allowedFingerprintKeys);
  const projected: Record<string, JsonValue> = {};
  for (const field of fields) {
    if (!Object.hasOwn(source, field) || source[field] === undefined) {
      if (requiredFields.has(field)) {
        throw new FingerprintProjectionError(
          'MISSING_PROJECTION_FIELD',
          `${path}.${field} is required by the active projection.`,
        );
      }
      continue;
    }
    const value = source[field];
    rejectNull(value, `${path}.${field}`);
    if (FINGERPRINT_KEY_PATTERN.test(field) && allowedFingerprintKeys.has(field)) {
      projected[field] = validateFingerprint(value, `${path}.${field}`);
    } else {
      projected[field] = sanitizeJson(value, `${path}.${field}`, allowedFingerprintKeys);
    }
  }
  return projected;
}

function selectArray(
  source: Readonly<Record<string, unknown>>,
  field: string,
  fields: readonly string[],
  optionalFields: readonly string[] = [],
  allowedFingerprintKeys: ReadonlySet<string> = new Set<string>(),
): JsonObject[] {
  const values = array(required(source, field, '$'), `$.${field}`);
  const requiredFields = new Set(fields.filter((item) => !optionalFields.includes(item)));
  return values.map((item, index) => selectObject(
    item,
    fields,
    `$.${field}[${index}]`,
    requiredFields,
    allowedFingerprintKeys,
  ));
}

function compareText(left: unknown, right: unknown): number {
  return String(left ?? '').localeCompare(String(right ?? ''), 'en');
}

function compareOptionalTextAbsentFirst(left: unknown, right: unknown): number {
  const leftMissing = left === undefined;
  const rightMissing = right === undefined;
  if (leftMissing !== rightMissing) return leftMissing ? -1 : 1;
  return compareText(left, right);
}

function sortStrings(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new FingerprintProjectionError('INVALID_PROJECTION_INPUT', `${path} must contain strings only.`);
  }
  return Object.freeze([...value].sort((left, right) => String(left).localeCompare(String(right), 'en'))) as readonly string[];
}

function projectFundamentalInput(sourceValue: unknown): JsonObject {
  const source = record(sourceValue, '$');
  const filings = selectArray(source, 'filings', ['accessionNumber', 'filedDate', 'form'])
    .sort((left, right) => compareText(left.filedDate, right.filedDate)
      || compareText(left.accessionNumber, right.accessionNumber));
  const reportingPeriods = selectArray(source, 'reportingPeriods', [
    'periodId', 'kind', 'endDate', 'scopeId', 'startDate', 'fiscalYear', 'fiscalPeriod',
    'classification', 'currency', 'durationDays', 'restatementLineageId',
  ], ['startDate', 'fiscalYear', 'fiscalPeriod', 'classification', 'currency', 'durationDays', 'restatementLineageId'])
    .sort((left, right) => compareText(left.endDate, right.endDate)
      || compareOptionalTextAbsentFirst(left.startDate, right.startDate)
      || compareText(left.periodId, right.periodId));
  const facts = selectArray(source, 'facts', [
    'canonicalConceptId', 'factId', 'mappingId', 'mappingVersion', 'periodId', 'scopeId',
    'valueDecimal', 'sourceRef', 'unit',
  ], ['sourceRef', 'unit'])
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.periodId, right.periodId)
      || compareText(left.scopeId, right.scopeId)
      || compareText(left.factId, right.factId));
  const conceptResolutions = selectArray(source, 'conceptResolutions', [
    'canonicalConceptId', 'periodId', 'scopeId', 'state', 'factId', 'reasonCode',
  ], ['factId', 'reasonCode'])
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.periodId, right.periodId)
      || compareText(left.scopeId, right.scopeId)
      || compareText(left.factId, right.factId));
  const mappings = selectArray(source, 'mappings', ['mappingId', 'mappingVersion'])
    .sort((left, right) => compareText(left.mappingId, right.mappingId)
      || compareText(left.mappingVersion, right.mappingVersion));
  const coverage = selectArray(source, 'coverage', [
    'canonicalConceptId', 'profileId', 'state', 'resolvedMappingIds', 'reasonCode',
  ], ['reasonCode'])
    .map((item): JsonObject => ({
      ...item,
      resolvedMappingIds: sortStrings(
        required(item, 'resolvedMappingIds', '$.coverage[]'),
        '$.coverage[].resolvedMappingIds',
      ),
    }))
    .sort((left, right) => compareText(left.canonicalConceptId, right.canonicalConceptId)
      || compareText(left.profileId, right.profileId));

  return {
    contractVersion: sanitizeJson(required(source, 'contractVersion', '$'), '$.contractVersion'),
    issuer: selectObject(
      required(source, 'issuer', '$'),
      ['cik', 'accountingStandard', 'entityType', 'analysisProfile'],
      '$.issuer',
    ),
    filings,
    reportingPeriods,
    facts,
    conceptResolutions,
    mappings,
    coverage,
    currencies: sortStrings(sanitizeJson(required(source, 'currencies', '$'), '$.currencies'), '$.currencies'),
    units: sortStrings(sanitizeJson(required(source, 'units', '$'), '$.units'), '$.units'),
    scopes: sortStrings(sanitizeJson(required(source, 'scopes', '$'), '$.scopes'), '$.scopes'),
    versions: sanitizeJson(required(source, 'versions', '$'), '$.versions'),
  };
}

const METRIC_FIELDS = [
  'metricId', 'state', 'qualityClassification', 'periodKey', 'unit', 'valueDecimal',
  'valueEnum', 'reasonCodes',
] as const;
const METRIC_OPTIONAL_FIELDS = ['periodKey', 'unit', 'valueDecimal', 'valueEnum', 'reasonCodes'] as const;
const RULE_FIELDS = ['ruleId', 'state', 'reasonCodes'] as const;
const RULE_OPTIONAL_FIELDS = ['reasonCodes'] as const;

function normalizeReasonCodes(item: JsonObject): JsonObject {
  if (item.reasonCodes === undefined) return item;
  return { ...item, reasonCodes: sortStrings(item.reasonCodes, '$.reasonCodes') };
}

function projectFundamentalAnalysis(sourceValue: unknown): JsonObject {
  const source = record(sourceValue, '$');
  const metrics = selectArray(source, 'metricResults', METRIC_FIELDS, METRIC_OPTIONAL_FIELDS)
    .map(normalizeReasonCodes)
    .sort((left, right) => compareText(left.metricId, right.metricId)
      || compareOptionalTextAbsentFirst(left.periodKey, right.periodKey));
  const rules = selectArray(source, 'ruleEvaluations', RULE_FIELDS, RULE_OPTIONAL_FIELDS)
    .map(normalizeReasonCodes)
    .sort((left, right) => compareText(left.ruleId, right.ruleId));
  const selectedSynthesis = selectObject(
    required(source, 'synthesis', '$'),
    ['state', 'triggeredRuleIds', 'limitations'],
    '$.synthesis',
    new Set(['state', 'triggeredRuleIds']),
  );
  const synthesis: JsonObject = {
    state: sanitizeJson(required(selectedSynthesis, 'state', '$.synthesis'), '$.synthesis.state'),
    triggeredRuleIds: sortStrings(
      required(selectedSynthesis, 'triggeredRuleIds', '$.synthesis'),
      '$.synthesis.triggeredRuleIds',
    ),
    ...(selectedSynthesis.limitations === undefined
      ? {}
      : {
        limitations: sortStrings(
          selectedSynthesis.limitations,
          '$.synthesis.limitations',
        ),
      }),
  };
  return {
    fundamentalInputFingerprint: validateFingerprint(
      required(source, 'fundamentalInputFingerprint', '$'),
      '$.fundamentalInputFingerprint',
    ),
    metricResults: metrics,
    ruleEvaluations: rules,
    synthesis,
    versions: sanitizeJson(required(source, 'versions', '$'), '$.versions'),
  };
}


function projectOverlayOrigin(sourceValue: unknown): JsonObject {
  const source = record(sourceValue, '$.origin');
  const selected = selectObject(
    source,
    ['profileId', 'method', 'sourceFileSha256'],
    '$.origin',
    new Set(['profileId', 'method']),
  );
  return {
    profileId: sanitizeJson(required(selected, 'profileId', '$.origin'), '$.origin.profileId'),
    method: sanitizeJson(required(selected, 'method', '$.origin'), '$.origin.method'),
    ...(selected.sourceFileSha256 === undefined
      ? {}
      : {
        sourceFileSha256: validateRawSha256(
          selected.sourceFileSha256,
          '$.origin.sourceFileSha256',
        ),
      }),
  };
}

function projectHistoricalPriceOverlay(sourceValue: unknown): JsonObject {
  const source = record(sourceValue, '$');
  const observations = selectArray(source, 'observations', ['date', 'priceDecimal']);
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    if (previous === undefined || current === undefined || compareText(previous.date, current.date) >= 0) {
      throw new FingerprintProjectionError(
        'UNSORTED_OBSERVATIONS',
        'Historical price observations must be strictly ordered by date before projection.',
      );
    }
  }
  const warnings = sortStrings(sanitizeJson(required(source, 'warnings', '$'), '$.warnings'), '$.warnings');
  return {
    contractVersion: sanitizeJson(required(source, 'contractVersion', '$'), '$.contractVersion'),
    instrument: selectObject(
      required(source, 'instrument', '$'),
      ['symbol', 'venueMic', 'instrumentId'],
      '$.instrument',
      new Set(['symbol', 'venueMic']),
    ),
    currency: sanitizeJson(required(source, 'currency', '$'), '$.currency'),
    frequency: sanitizeJson(required(source, 'frequency', '$'), '$.frequency'),
    observations,
    adjustmentStatus: sanitizeJson(required(source, 'adjustmentStatus', '$'), '$.adjustmentStatus'),
    origin: projectOverlayOrigin(required(source, 'origin', '$')),
    warnings,
    priceUse: sanitizeJson(required(source, 'priceUse', '$'), '$.priceUse'),
  };
}

function projectPriceAnalysis(sourceValue: unknown): JsonObject {
  const source = record(sourceValue, '$');
  const metrics = selectArray(source, 'priceMetricResults', METRIC_FIELDS, METRIC_OPTIONAL_FIELDS)
    .map(normalizeReasonCodes)
    .sort((left, right) => compareText(left.metricId, right.metricId)
      || compareOptionalTextAbsentFirst(left.periodKey, right.periodKey));
  return {
    historicalPriceOverlayFingerprint: validateFingerprint(
      required(source, 'historicalPriceOverlayFingerprint', '$'),
      '$.historicalPriceOverlayFingerprint',
    ),
    priceQuality: sanitizeJson(required(source, 'priceQuality', '$'), '$.priceQuality'),
    priceMetricResults: metrics,
    versions: sanitizeJson(required(source, 'versions', '$'), '$.versions'),
  };
}

function evidenceSourceId(item: Readonly<Record<string, unknown>>, path: string): string {
  const candidates = ['sourceId', 'canonicalUrl', 'accessionNumber']
    .filter((key) => typeof item[key] === 'string' && item[key] !== '')
    .map((key) => item[key] as string);
  if (candidates.length !== 1) {
    throw new FingerprintProjectionError(
      'AMBIGUOUS_EVIDENCE_ID',
      `${path} must provide exactly one sourceId, canonicalUrl or accessionNumber.`,
    );
  }
  return candidates[0] as string;
}

function projectSourceEvidence(sourceValue: unknown): JsonObject {
  const sourceArray = Array.isArray(sourceValue)
    ? sourceValue
    : array(
      required(record(sourceValue, '$'), 'evidenceReferences', '$'),
      '$.evidenceReferences',
    );
  const evidenceReferences = sourceArray.map((value, index): JsonObject => {
    const itemPath = `$.evidenceReferences[${index}]`;
    const item = record(value, itemPath);
    rejectForbiddenKeys(item, itemPath, new Set<string>());
    const sourceKind = required(item, 'sourceKind', itemPath);
    const payloadSha256 = required(item, 'payloadSha256', `$.evidenceReferences[${index}]`);
    const retrievedVersion = required(item, 'retrievedVersion', `$.evidenceReferences[${index}]`);
    if (typeof sourceKind !== 'string' || typeof retrievedVersion !== 'string') {
      throw new FingerprintProjectionError(
        'INVALID_PROJECTION_INPUT',
        `$.evidenceReferences[${index}] contains an invalid sourceKind or retrievedVersion.`,
      );
    }
    return {
      sourceKind,
      sourceId: evidenceSourceId(item, `$.evidenceReferences[${index}]`),
      payloadSha256: validateRawSha256(payloadSha256, `$.evidenceReferences[${index}].payloadSha256`),
      retrievedVersion,
    };
  }).sort((left, right) => compareText(left.sourceKind, right.sourceKind)
    || compareText(left.sourceId, right.sourceId)
    || compareText(left.payloadSha256, right.payloadSha256));
  return { evidenceReferences };
}

/** Selects and orders exactly one active fingerprint projection. */
export function projectFingerprintInput(
  projectionId: FingerprintProjectionId,
  input: unknown,
): JsonObject {
  switch (projectionId) {
    case 'fundamentalInputFingerprint': return projectFundamentalInput(input);
    case 'fundamentalAnalysisFingerprint': return projectFundamentalAnalysis(input);
    case 'historicalPriceOverlayFingerprint': return projectHistoricalPriceOverlay(input);
    case 'priceAnalysisFingerprint': return projectPriceAnalysis(input);
    case 'sourceEvidenceFingerprint': return projectSourceEvidence(input);
  }
}
