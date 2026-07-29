import { describe, expect, it } from 'vitest';
import stateAndCapabilityCatalog from '../../../specs/001-fundamental-analysis-platform/definitions/state-and-capability-catalog.json';
import {
  assertNever,
  assertUniqueOperationIds,
  DuplicateOperationIdError,
  OperationIdRegistry,
  parseOperationInstanceId,
  WORKER_OPERATION_KINDS,
  type UiToWorkerMessage,
  type WorkerToUiMessage,
} from '../../../src/types/messages';

function handleUiMessage(message: UiToWorkerMessage): string {
  switch (message.type) {
    case 'operation.start':
      return message.operation;
    case 'operation.cancel':
      return message.reason;
    default:
      return assertNever(message);
  }
}

function handleWorkerMessage(message: WorkerToUiMessage): string {
  switch (message.type) {
    case 'operation.accepted':
      return message.operation;
    case 'operation.progress':
      return message.stage;
    case 'operation.completed':
      return 'completed';
    case 'operation.failed':
      return 'failed';
    case 'operation.cancelled':
      return 'cancelled';
    default:
      return assertNever(message);
  }
}

describe('discriminated UI and Web Worker messages', () => {
  it('matches the exact closed operationId set in the active state catalog', () => {
    const catalogOperations = [...new Set(
      stateAndCapabilityCatalog.transitions.map((transition) => transition.operationId),
    )].sort();
    expect([...WORKER_OPERATION_KINDS].sort()).toEqual(catalogOperations);
  });

  it('supports exhaustive UI-to-worker start and explicit cancellation messages', () => {
    const operationId = parseOperationInstanceId('issuer-0000320193:refresh:1');
    expect(handleUiMessage({
      type: 'operation.start',
      operationId,
      operation: 'refreshFundamentals',
      payload: { cik: '0000320193' },
    })).toBe('refreshFundamentals');
    expect(handleUiMessage({
      type: 'operation.cancel',
      operationId,
      reason: 'user_requested',
    })).toBe('user_requested');
  });

  it('supports exhaustive accepted, progress, completed, failed and cancelled worker messages', () => {
    const operationId = parseOperationInstanceId('op-1');
    expect(handleWorkerMessage({
      type: 'operation.accepted',
      operationId,
      operation: 'analyzeFundamentals',
    })).toBe('analyzeFundamentals');
    expect(handleWorkerMessage({
      type: 'operation.progress',
      operationId,
      stage: 'analyzing',
      completedUnits: 4,
      totalUnits: 10,
      messageKey: 'progress.analyzing',
    })).toBe('analyzing');
    expect(handleWorkerMessage({
      type: 'operation.completed',
      operationId,
      result: { snapshotId: 'snapshot-1' },
    })).toBe('completed');
    expect(handleWorkerMessage({ type: 'operation.failed', operationId, issue: { code: 'failed' } }))
      .toBe('failed');
    expect(handleWorkerMessage({
      type: 'operation.cancelled',
      operationId,
      issue: { code: 'cancelled' },
    })).toBe('cancelled');
  });

  it('detects duplicate operation instance IDs before duplicate work can start', () => {
    const operationId = parseOperationInstanceId('op-duplicate');
    const registry = new OperationIdRegistry();
    registry.register(operationId);
    expect(registry.has(operationId)).toBe(true);
    expect(() => registry.register(operationId)).toThrowError(DuplicateOperationIdError);
    expect(() => assertUniqueOperationIds([{ operationId }, { operationId }]))
      .toThrow(/Duplicate operation ID/u);
    expect(registry.release(operationId)).toBe(true);
    expect(registry.size).toBe(0);
  });

  it('rejects empty, whitespace, oversized and ambiguous operation instance IDs', () => {
    expect(() => parseOperationInstanceId('')).toThrow(/Invalid operation instance ID/u);
    expect(() => parseOperationInstanceId('contains space')).toThrow(/Invalid operation instance ID/u);
    expect(() => parseOperationInstanceId('../escape')).toThrow(/Invalid operation instance ID/u);
    expect(() => parseOperationInstanceId('x'.repeat(129))).toThrow(/Invalid operation instance ID/u);
  });
});
