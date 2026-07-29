import { describe, expect, it } from 'vitest';
import {
  createOperationCorrelationId,
  createTelemetryRecord,
  emitTelemetryRecord,
  serializeTelemetryRecord,
  type TelemetrySink,
} from '../../src/core/telemetry';
import { createWorkerObservability } from '../../workers/sec-gateway/src/observability';

const deterministicUuid = (): string => '123e4567-e89b-42d3-a456-426614174000';
const forbiddenValues = [
  'secret-token-value',
  'analyst@example.com',
  'SEC_USER_AGENT',
  'SEC_CONTACT_EMAIL',
  '1234.56',
  '0000320193',
  'AAPL',
  'revenue',
  'password',
  'authorization',
  'cookie',
] as const;

function expectRedacted(serialized: string): void {
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  expect(Object.keys(parsed)).toEqual(['operation', 'status', 'reason']);
  for (const forbidden of forbiddenValues) {
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

describe('structured telemetry redaction', () => {
  it('emits exactly operation/status/reason with an opaque correlation identifier', () => {
    const operation = createOperationCorrelationId(deterministicUuid);
    const record = createTelemetryRecord(operation, 'failed', 'provider_unavailable');
    const serialized = serializeTelemetryRecord(record);

    expect(Object.keys(record)).toEqual(['operation', 'status', 'reason']);
    expect(record.operation).toBe('op-123e4567-e89b-42d3-a456-426614174000');
    expect(Object.isFrozen(record)).toBe(true);
    expectRedacted(serialized);
  });

  it('does not accept arbitrary status, reason or correlation values', () => {
    const operation = createOperationCorrelationId(deterministicUuid);
    expect(() => createTelemetryRecord(operation, 'secret-token-value' as never, 'none'))
      .toThrow(/INVALID_TELEMETRY_STATUS/u);
    expect(() => createTelemetryRecord(operation, 'failed', 'analyst@example.com' as never))
      .toThrow(/INVALID_TELEMETRY_REASON/u);
    expect(() => createTelemetryRecord('op-user-0000320193' as never, 'failed', 'unexpected_error'))
      .toThrow(/INVALID_TELEMETRY_OPERATION/u);
    expect(() => createOperationCorrelationId(() => 'analyst@example.com'))
      .toThrow(/INVALID_OPERATION_CORRELATION_ID/u);
  });

  it('uses the same redacted envelope in client and Worker sinks', () => {
    const writes: string[] = [];
    const sink: TelemetrySink = { write: (value) => writes.push(value) };
    const operation = createOperationCorrelationId(deterministicUuid);

    emitTelemetryRecord(sink, createTelemetryRecord(operation, 'started', 'none'));
    const worker = createWorkerObservability(sink, operation);
    worker.record('blocked', 'blocked_by_policy');

    expect(writes).toHaveLength(2);
    for (const serialized of writes) expectRedacted(serialized);
  });

  it('cannot leak extra properties supplied by an untrusted object', () => {
    const operation = createOperationCorrelationId(deterministicUuid);
    const untrusted = {
      operation,
      status: 'succeeded',
      reason: 'none',
      credential: 'secret-token-value',
      financialValue: '1234.56',
      contact: 'analyst@example.com',
    } as const;

    const serialized = serializeTelemetryRecord(untrusted);
    expectRedacted(serialized);
    expect(serialized).not.toContain('credential');
    expect(serialized).not.toContain('financialValue');
    expect(serialized).not.toContain('contact');
  });
});
