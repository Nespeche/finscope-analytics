import { describe, expect, it } from 'vitest';
import {
  parseOperationInstanceId,
  type WorkerOperationKind,
} from '../../../src/types/messages';
import {
  IssuerOperationBusyError,
  OperationRegistry,
  parseIssuerOperationKey,
} from '../../../src/worker/operation-registry';

const issuer = parseIssuerOperationKey('0000320193');
const refresh: WorkerOperationKind = 'refreshFundamentals';

describe('OperationRegistry', () => {
  it('coalesces duplicate actions for one issuer into one active operation', () => {
    const registry = new OperationRegistry<{ readonly snapshotId: string }>();
    const firstId = parseOperationInstanceId('refresh-1');
    const secondId = parseOperationInstanceId('refresh-2');

    const first = registry.register({ issuerKey: issuer, operation: refresh, operationId: firstId });
    const second = registry.register({ issuerKey: issuer, operation: refresh, operationId: secondId });

    expect(first.status).toBe('started');
    expect(second.status).toBe('coalesced');
    expect(second.active.primaryOperationId).toBe(firstId);
    expect(second.active.operationIds).toEqual([firstId, secondId]);
    expect(registry.getActiveByIssuer(issuer)?.operationIds).toEqual([firstId, secondId]);
  });

  it('rejects a different concurrent operation for the same issuer', () => {
    const registry = new OperationRegistry();
    registry.register({
      issuerKey: issuer,
      operation: refresh,
      operationId: parseOperationInstanceId('refresh-active'),
    });

    expect(() => registry.register({
      issuerKey: issuer,
      operation: 'deleteLocalData',
      operationId: parseOperationInstanceId('delete-conflict'),
    })).toThrow(IssuerOperationBusyError);
  });

  it('publishes one result atomically to every coalesced operation ID', () => {
    const registry = new OperationRegistry<{ readonly snapshotId: string }>();
    const firstId = parseOperationInstanceId('publish-1');
    const secondId = parseOperationInstanceId('publish-2');
    registry.register({ issuerKey: issuer, operation: refresh, operationId: firstId });
    registry.register({ issuerKey: issuer, operation: refresh, operationId: secondId });

    const result = Object.freeze({ snapshotId: 'snapshot-B' });
    const publication = registry.publish(secondId, result);

    expect(publication.messages).toEqual([
      { type: 'operation.completed', operationId: firstId, result },
      { type: 'operation.completed', operationId: secondId, result },
    ]);
    expect(registry.getPublishedResult(issuer)).toBe(result);
    expect(registry.getActiveByIssuer(issuer)).toBeUndefined();
  });

  it('cancellation preserves the previously published result and releases aliases', () => {
    const registry = new OperationRegistry<{ readonly snapshotId: string }>();
    const publishedId = parseOperationInstanceId('publish-A');
    const prior = Object.freeze({ snapshotId: 'snapshot-A' });
    registry.register({ issuerKey: issuer, operation: refresh, operationId: publishedId });
    registry.publish(publishedId, prior);

    const activeId = parseOperationInstanceId('refresh-B');
    const aliasId = parseOperationInstanceId('refresh-B-alias');
    const active = registry.register({ issuerKey: issuer, operation: refresh, operationId: activeId });
    registry.register({ issuerKey: issuer, operation: refresh, operationId: aliasId });

    const cancellation = registry.cancel(aliasId);

    expect(active.active.signal.aborted).toBe(true);
    expect(cancellation.operationIds).toEqual([activeId, aliasId]);
    expect(cancellation.priorPublishedResult).toEqual({ status: 'available', result: prior });
    expect(registry.getPublishedResult(issuer)).toBe(prior);
    expect(registry.has(activeId)).toBe(false);
    expect(registry.has(aliasId)).toBe(false);
  });
});
