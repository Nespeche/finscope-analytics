import {
  createOperationCorrelationId,
  createTelemetryRecord,
  emitTelemetryRecord,
  type OperationCorrelationId,
  type TelemetryReason,
  type TelemetryRecord,
  type TelemetrySink,
  type TelemetryStatus,
} from '../../../src/core/telemetry';

export interface WorkerObservability {
  readonly operation: OperationCorrelationId;
  readonly record: (status: TelemetryStatus, reason: TelemetryReason) => TelemetryRecord;
}

export function createRedactedTelemetrySink(
  sink: TelemetrySink,
  forbiddenValues: readonly string[],
): TelemetrySink {
  const values = forbiddenValues.map((value) => value.trim()).filter((value) => value.length > 0);
  return Object.freeze({
    write(serializedRecord: string): void {
      if (values.some((value) => serializedRecord.includes(value))) {
        throw new Error('SENSITIVE_VALUE_IN_TELEMETRY');
      }
      sink.write(serializedRecord);
    },
  });
}

export function createWorkerObservability(
  sink: TelemetrySink,
  operation: OperationCorrelationId = createOperationCorrelationId(),
): WorkerObservability {
  return Object.freeze({
    operation,
    record(status: TelemetryStatus, reason: TelemetryReason): TelemetryRecord {
      const record = createTelemetryRecord(operation, status, reason);
      emitTelemetryRecord(sink, record);
      return record;
    },
  });
}
