const operationIdBrand: unique symbol = Symbol('OperationCorrelationId');

export type OperationCorrelationId = `op-${string}` & {
  readonly [operationIdBrand]: true;
};

export const OPERATION_ID_PATTERN =
  /^op-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const TELEMETRY_STATUSES = Object.freeze([
  'started',
  'succeeded',
  'partial',
  'failed',
  'cancelled',
  'blocked',
] as const);

export const TELEMETRY_REASONS = Object.freeze([
  'none',
  'invalid_request',
  'blocked_by_policy',
  'payload_too_large',
  'provider_unavailable',
  'invalid_payload',
  'upstream_timeout',
  'resource_not_found',
  'identity_ambiguous',
  'quality_gate_failed',
  'storage_consent_required',
  'invalid_fact_value',
  'budget_exhausted',
  'unexpected_error',
] as const);

export type TelemetryStatus = (typeof TELEMETRY_STATUSES)[number];
export type TelemetryReason = (typeof TELEMETRY_REASONS)[number];

export interface TelemetryRecord {
  readonly operation: OperationCorrelationId;
  readonly status: TelemetryStatus;
  readonly reason: TelemetryReason;
}

export interface TelemetrySink {
  readonly write: (serializedRecord: string) => void;
}

export function isOperationCorrelationId(value: unknown): value is OperationCorrelationId {
  return typeof value === 'string' && OPERATION_ID_PATTERN.test(value);
}

export function createOperationCorrelationId(
  uuidFactory: () => string = () => globalThis.crypto.randomUUID(),
): OperationCorrelationId {
  const operation = `op-${uuidFactory()}`;
  if (!OPERATION_ID_PATTERN.test(operation)) {
    throw new TypeError('INVALID_OPERATION_CORRELATION_ID');
  }
  return operation as OperationCorrelationId;
}

export function createTelemetryRecord(
  operation: OperationCorrelationId,
  status: TelemetryStatus,
  reason: TelemetryReason,
): TelemetryRecord {
  if (!isOperationCorrelationId(operation)) {
    throw new TypeError('INVALID_TELEMETRY_OPERATION');
  }
  if (!TELEMETRY_STATUSES.includes(status)) {
    throw new TypeError('INVALID_TELEMETRY_STATUS');
  }
  if (!TELEMETRY_REASONS.includes(reason)) {
    throw new TypeError('INVALID_TELEMETRY_REASON');
  }
  return Object.freeze({ operation, status, reason });
}

export function serializeTelemetryRecord(record: TelemetryRecord): string {
  const validated = createTelemetryRecord(record.operation, record.status, record.reason);
  return JSON.stringify(validated);
}

export function emitTelemetryRecord(
  sink: TelemetrySink,
  record: TelemetryRecord,
): void {
  sink.write(serializeTelemetryRecord(record));
}
