import type {
  AcquisitionPlan,
  AcquisitionPlanAttempt,
} from '../domain/acquisition/acquisition-plan';
import type { OperationInstanceId } from '../types/messages';
import {
  OperationRegistry,
  type OperationExecutionContext,
  type TypedOperationDescriptor,
} from './operation-registry';

export interface AcquisitionOperationPayload {
  readonly operationId: OperationInstanceId;
  readonly cik: string;
  readonly plan: AcquisitionPlan;
}

export interface AcquisitionAttemptOutcome {
  readonly status: 'success' | 'not_found' | 'invalid_payload' | 'blocked' | 'timeout' | 'provider_error';
  readonly payloadSha256?: string;
}

export interface AcquisitionAttemptRecord extends AcquisitionPlanAttempt {
  readonly status: AcquisitionAttemptOutcome['status'];
  readonly payloadSha256?: string;
}

export interface AcquisitionCandidate {
  readonly candidateId: string;
  readonly cik: string;
  readonly attempts: readonly AcquisitionAttemptRecord[];
  readonly unresolvedConceptIds: readonly string[];
}

export interface AcquisitionOperationResult {
  readonly operationId: OperationInstanceId;
  readonly cik: string;
  readonly status: 'complete' | 'partial' | 'failed' | 'cancelled';
  readonly attempts: readonly AcquisitionAttemptRecord[];
  readonly externalCallCount: number;
  readonly budgetRemaining: number;
  readonly unresolvedConceptIds: readonly string[];
  readonly candidate?: AcquisitionCandidate;
  readonly candidatePublished: boolean;
  readonly activePointerAction: 'replace' | 'preserve';
}

export interface AcquisitionRunnerDependencies {
  readonly runAttempt: (
    attempt: AcquisitionPlanAttempt,
    signal: AbortSignal,
  ) => Promise<AcquisitionAttemptOutcome>;
  readonly createCandidateId?: (
    payload: AcquisitionOperationPayload,
    attempts: readonly AcquisitionAttemptRecord[],
  ) => string;
}

function abortError(): Error {
  const error = new Error('Acquisition cancelled.');
  error.name = 'AbortError';
  return error;
}

function freezeAttemptRecord(
  attempt: AcquisitionPlanAttempt,
  outcome: AcquisitionAttemptOutcome,
): AcquisitionAttemptRecord {
  const base = { ...attempt, status: outcome.status };
  return outcome.payloadSha256 === undefined
    ? Object.freeze(base)
    : Object.freeze({ ...base, payloadSha256: outcome.payloadSha256 });
}

function createCancelledResult(
  payload: AcquisitionOperationPayload,
  attempts: readonly AcquisitionAttemptRecord[],
): AcquisitionOperationResult {
  return Object.freeze({
    operationId: payload.operationId,
    cik: payload.cik,
    status: 'cancelled' as const,
    attempts: Object.freeze([...attempts]),
    externalCallCount: attempts.length,
    budgetRemaining: Math.max(0, 14 - attempts.length),
    unresolvedConceptIds: payload.plan.unresolvedConceptIds,
    candidatePublished: false as const,
    activePointerAction: 'preserve' as const,
  });
}

export function createAcquisitionOperationDescriptor(
  dependencies: AcquisitionRunnerDependencies,
): TypedOperationDescriptor<AcquisitionOperationPayload, AcquisitionOperationResult> {
  return Object.freeze({
    operation: 'acquireSecData' as const,
    mayPublish: (result: AcquisitionOperationResult) => result.status === 'complete',
    execute: async (
      payload: AcquisitionOperationPayload,
      context: OperationExecutionContext,
    ): Promise<AcquisitionOperationResult> => {
      const attempts: AcquisitionAttemptRecord[] = [];
      context.reportProgress({
        stage: 'checking',
        completedUnits: 0,
        totalUnits: payload.plan.attempts.length,
        messageKey: 'acquisition.checking',
      });

      for (const attempt of payload.plan.attempts) {
        if (context.signal.aborted) return createCancelledResult(payload, attempts);
        context.reportProgress({
          stage: 'acquiring',
          completedUnits: attempts.length,
          totalUnits: payload.plan.attempts.length,
          messageKey: `acquisition.${attempt.sourceKind}`,
        });
        try {
          const outcome = await dependencies.runAttempt(attempt, context.signal);
          attempts.push(freezeAttemptRecord(attempt, outcome));
        } catch (error: unknown) {
          if (context.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            return createCancelledResult(payload, attempts);
          }
          throw error;
        }
      }

      if (context.signal.aborted) throw abortError();
      const failedConcepts = new Set(
        attempts
          .filter((attempt) => attempt.sourceKind === 'company_concept' && attempt.status !== 'success')
          .flatMap((attempt) => attempt.canonicalConceptId === undefined ? [] : [attempt.canonicalConceptId]),
      );
      const unresolved = Object.freeze([
        ...new Set([...payload.plan.unresolvedConceptIds, ...failedConcepts]),
      ]);
      const successfulAttemptCount = attempts.filter((attempt) => attempt.status === 'success').length;
      const hasFailedAttempt = attempts.some((attempt) => attempt.status !== 'success');
      const status = successfulAttemptCount === 0 && attempts.length > 0
        ? 'failed' as const
        : payload.plan.status === 'partial' || unresolved.length > 0 || hasFailedAttempt
          ? 'partial' as const
          : 'complete' as const;
      const candidateId = dependencies.createCandidateId?.(payload, attempts)
        ?? `${payload.cik}:${payload.operationId}`;
      const candidate = Object.freeze({
        candidateId,
        cik: payload.cik,
        attempts: Object.freeze([...attempts]),
        unresolvedConceptIds: unresolved,
      });

      context.reportProgress({
        stage: 'publishing',
        completedUnits: attempts.length,
        totalUnits: payload.plan.attempts.length,
        messageKey: status === 'complete'
          ? 'acquisition.complete'
          : status === 'failed'
            ? 'acquisition.failed'
            : 'acquisition.partial',
      });
      return Object.freeze({
        operationId: payload.operationId,
        cik: payload.cik,
        status,
        attempts: Object.freeze([...attempts]),
        externalCallCount: attempts.length,
        budgetRemaining: Math.max(0, 14 - attempts.length),
        unresolvedConceptIds: unresolved,
        candidate,
        candidatePublished: status === 'complete',
        activePointerAction: status === 'complete' ? 'replace' as const : 'preserve' as const,
      });
    },
  });
}

export function registerAcquisitionOperation(
  registry: OperationRegistry<AcquisitionOperationResult>,
  dependencies: AcquisitionRunnerDependencies,
): void {
  registry.registerDescriptor(createAcquisitionOperationDescriptor(dependencies));
}
