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

export interface WorkerRequestMetrics {
  readonly requestCount: 1;
  readonly cpuMilliseconds: number;
  readonly subrequestCount: number;
  readonly responseBytes: number;
  readonly errorCode: string | null;
}

export function createWorkerRequestMetrics(input: Omit<WorkerRequestMetrics, 'requestCount'>): WorkerRequestMetrics {
  for (const [name, value] of Object.entries(input)) {
    if (name !== 'errorCode' && (!Number.isFinite(value) || (value as number) < 0)) {
      throw new TypeError(`INVALID_WORKER_METRIC:${name}`);
    }
  }
  if (!Number.isSafeInteger(input.subrequestCount) || !Number.isSafeInteger(input.responseBytes)) {
    throw new TypeError('INVALID_WORKER_METRIC_INTEGER');
  }
  return Object.freeze({ requestCount: 1 as const, ...input });
}

export function serializeWorkerRequestMetrics(metrics: WorkerRequestMetrics): string {
  return JSON.stringify(metrics);
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
