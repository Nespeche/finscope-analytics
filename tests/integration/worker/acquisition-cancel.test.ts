import { describe, expect, it } from 'vitest';
import { createAcquisitionPlan } from '../../../src/domain/acquisition/acquisition-plan';
import { parseOperationInstanceId } from '../../../src/types/messages';
import {
  registerAcquisitionOperation,
  type AcquisitionOperationResult,
} from '../../../src/worker/acquisition-runner';
import {
  OperationRegistry,
  parseIssuerOperationKey,
} from '../../../src/worker/operation-registry';

const issuerKey = parseIssuerOperationKey('0000320193');

function plan(status: 'complete' | 'partial' = 'complete') {
  return createAcquisitionPlan({
    cik: '0000320193',
    maxExternalCalls: 14,
    requestedConceptIds: status === 'complete' ? ['revenue'] : ['revenue', 'netIncome'],
    cacheState: 'miss',
    companyFactsResolvedConceptIds: ['revenue'],
    eligibleFallbacks: [],
  });
}

function priorResult(operationIdText: string): AcquisitionOperationResult {
  return Object.freeze({
    operationId: parseOperationInstanceId(operationIdText),
    cik: '0000320193',
    status: 'complete' as const,
    attempts: Object.freeze([]),
    externalCallCount: 0,
    budgetRemaining: 14,
    unresolvedConceptIds: Object.freeze([]),
    candidatePublished: true,
    activePointerAction: 'replace' as const,
  });
}

describe('acquisition operation cancellation and publication', () => {
  it('registers a typed descriptor and publishes only a complete candidate', async () => {
    const registry = new OperationRegistry<AcquisitionOperationResult>();
    registerAcquisitionOperation(registry, {
      runAttempt: async () => ({ status: 'success', payloadSha256: 'a'.repeat(64) }),
    });
    expect(registry.hasDescriptor('acquireSecData')).toBe(true);

    const operationId = parseOperationInstanceId('acquisition-complete');
    const result = await registry.dispatch({
      issuerKey,
      operation: 'acquireSecData',
      operationId,
    }, {
      operationId,
      cik: '0000320193',
      plan: plan('complete'),
    });

    expect(result.status).toBe('published');
    if (result.status !== 'published') throw new Error('Expected complete publication.');
    expect(result.result).toMatchObject({
      status: 'complete', candidatePublished: true, activePointerAction: 'replace',
    });
    expect(result.progress.map((message) => message.stage)).toContain('publishing');
    expect(registry.getPublishedResult(issuerKey)).toBe(result.result);
  });

  it('preserves the prior active pointer for a partial candidate', async () => {
    const registry = new OperationRegistry<AcquisitionOperationResult>();
    const seedId = parseOperationInstanceId('seed-partial-protection');
    const prior = priorResult('prior-partial-protection');
    registry.register({ issuerKey, operation: 'acquireSecData', operationId: seedId });
    registry.publish(seedId, prior);
    registerAcquisitionOperation(registry, {
      runAttempt: async () => ({ status: 'success' }),
    });

    const operationId = parseOperationInstanceId('acquisition-partial');
    const result = await registry.dispatch({
      issuerKey,
      operation: 'acquireSecData',
      operationId,
    }, {
      operationId,
      cik: '0000320193',
      plan: plan('partial'),
    });

    expect(result.status).toBe('preserved');
    if (result.status !== 'preserved') throw new Error('Expected preserved partial result.');
    expect(result.result).toMatchObject({
      status: 'partial', candidatePublished: false, activePointerAction: 'preserve',
    });
    expect(result.priorPublishedResult).toEqual({ status: 'available', result: prior });
    expect(registry.getPublishedResult(issuerKey)).toBe(prior);
  });

  it('aborts an in-flight dispatch and preserves the prior active pointer', async () => {
    const registry = new OperationRegistry<AcquisitionOperationResult>();
    const seedId = parseOperationInstanceId('seed-cancel-protection');
    const prior = priorResult('prior-cancel-protection');
    registry.register({ issuerKey, operation: 'acquireSecData', operationId: seedId });
    registry.publish(seedId, prior);

    registerAcquisitionOperation(registry, {
      runAttempt: async (_attempt, signal) => new Promise<never>((_resolve, reject) => {
        if (signal.aborted) {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
          return;
        }
        signal.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      }),
    });

    const operationId = parseOperationInstanceId('acquisition-cancelled');
    const pending = registry.dispatch({
      issuerKey,
      operation: 'acquireSecData',
      operationId,
    }, {
      operationId,
      cik: '0000320193',
      plan: plan('complete'),
    });

    await Promise.resolve();
    const cancellation = registry.cancel(operationId);
    const result = await pending;

    expect(result.status).toBe('cancelled');
    expect(cancellation.priorPublishedResult).toEqual({ status: 'available', result: prior });
    if (result.status !== 'cancelled') throw new Error('Expected cancelled dispatch.');
    expect(result.cancellation.priorPublishedResult).toEqual({ status: 'available', result: prior });
    expect(registry.getPublishedResult(issuerKey)).toBe(prior);
    expect(registry.has(operationId)).toBe(false);
  });
});
