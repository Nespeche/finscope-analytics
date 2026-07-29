/// <reference types="vite/client" />

import {
  WORKER_OPERATION_KINDS,
  parseOperationInstanceId,
  type OperationInstanceId,
  type UiToWorkerMessage,
  type WorkerOperationKind,
  type WorkerProgressStage,
  type WorkerToUiMessage,
} from '../types/messages';
import {
  IssuerOperationBusyError,
  OperationRegistry,
  UnknownOperationIdError,
  parseIssuerOperationKey,
  type IssuerOperationKey,
} from './operation-registry';

export interface WorkerOperationContext {
  readonly issuerKey: IssuerOperationKey;
  readonly operationId: OperationInstanceId;
  readonly signal: AbortSignal;
  publishProgress(
    stage: WorkerProgressStage,
    completedUnits: number,
    totalUnits: number | undefined,
    messageKey: string,
  ): void;
}

export interface WorkerOperationDescriptor {
  readonly operationType: WorkerOperationKind;
  handle(context: WorkerOperationContext, payload: unknown): unknown | Promise<unknown>;
}

interface WorkerOperationModule {
  readonly descriptor?: WorkerOperationDescriptor;
  readonly default?: WorkerOperationDescriptor;
}

interface WorkerRuntime {
  readonly document?: unknown;
  addEventListener?(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage?(message: WorkerToUiMessage): void;
}

const descriptorLoaders = import.meta.glob<WorkerOperationModule>('./operations/*.ts');
const registry = new OperationRegistry<unknown>();
let descriptorPromise: Promise<ReadonlyMap<WorkerOperationKind, WorkerOperationDescriptor>> | undefined;

const CANCELLED_ISSUE = Object.freeze({
  accessibilityKey: 'a11y.error.cancelled',
  blockedOperations: Object.freeze(['active_operation'] as const),
  code: 'cancelled',
  messageKey: 'error.cancelled',
  pipelineState: 'cancelled',
  preservedCapabilities: Object.freeze([
    'issuer_identity',
    'local_snapshot',
    'definitions',
    'mappings',
    'evidence',
  ] as const),
  recoveryActions: Object.freeze(['restart', 'use_last_snapshot'] as const),
  retryability: 'after_user_action',
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkerOperationKind(value: unknown): value is WorkerOperationKind {
  return typeof value === 'string'
    && (WORKER_OPERATION_KINDS as readonly string[]).includes(value);
}

function parseMessage(value: unknown): UiToWorkerMessage<unknown> | undefined {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.operationId !== 'string') {
    return undefined;
  }

  let operationId: OperationInstanceId;
  try {
    operationId = parseOperationInstanceId(value.operationId);
  } catch {
    return undefined;
  }

  if (value.type === 'operation.cancel' && value.reason === 'user_requested') {
    return Object.freeze({
      type: 'operation.cancel',
      operationId,
      reason: 'user_requested',
    });
  }

  if (value.type === 'operation.start' && isWorkerOperationKind(value.operation)) {
    return Object.freeze({
      type: 'operation.start',
      operationId,
      operation: value.operation,
      payload: value.payload,
    });
  }

  return undefined;
}

function issuerKeyFromPayload(payload: unknown): IssuerOperationKey {
  if (!isRecord(payload) || typeof payload.issuerCik !== 'string') {
    throw new TypeError('Worker operation payload must include issuerCik.');
  }
  return parseIssuerOperationKey(payload.issuerCik);
}

function post(message: WorkerToUiMessage): void {
  const runtime = globalThis as unknown as WorkerRuntime;
  runtime.postMessage?.(message);
}

async function loadOperationDescriptors(): Promise<ReadonlyMap<WorkerOperationKind, WorkerOperationDescriptor>> {
  if (descriptorPromise !== undefined) return descriptorPromise;

  descriptorPromise = (async () => {
    const descriptors = new Map<WorkerOperationKind, WorkerOperationDescriptor>();
    const paths = Object.keys(descriptorLoaders).sort((left, right) => left.localeCompare(right, 'en'));

    for (const path of paths) {
      const module = await descriptorLoaders[path]?.();
      const descriptor = module?.descriptor ?? module?.default;
      if (descriptor === undefined || !isWorkerOperationKind(descriptor.operationType)) {
        throw new TypeError(`${path} does not export a valid Worker operation descriptor.`);
      }
      if (typeof descriptor.handle !== 'function') {
        throw new TypeError(`${path} exports a descriptor without handle(context, payload).`);
      }
      if (descriptors.has(descriptor.operationType)) {
        throw new Error(`Duplicate Worker operation descriptor: ${descriptor.operationType}`);
      }
      descriptors.set(descriptor.operationType, Object.freeze(descriptor));
    }

    return descriptors;
  })();

  return descriptorPromise;
}

function postFailure(operationIds: readonly OperationInstanceId[], issue: unknown): void {
  for (const operationId of operationIds) {
    post(Object.freeze({ type: 'operation.failed', operationId, issue }));
  }
}

async function startOperation(message: Extract<UiToWorkerMessage<unknown>, { type: 'operation.start' }>): Promise<void> {
  let issuerKey: IssuerOperationKey;
  try {
    issuerKey = issuerKeyFromPayload(message.payload);
  } catch (error: unknown) {
    post(Object.freeze({ type: 'operation.failed', operationId: message.operationId, issue: error }));
    return;
  }

  try {
    const registration = registry.register({
      issuerKey,
      operation: message.operation,
      operationId: message.operationId,
    });
    post(Object.freeze({
      type: 'operation.accepted',
      operationId: message.operationId,
      operation: message.operation,
    }));

    if (registration.status === 'coalesced') {
      return;
    }

    const descriptors = await loadOperationDescriptors();
    if (!registry.has(message.operationId) || registration.active.signal.aborted) {
      return;
    }
    const descriptor = descriptors.get(message.operation);
    if (descriptor === undefined) {
      const recipients = registry.fail(message.operationId);
      postFailure(recipients, Object.freeze({
        name: 'OperationDescriptorUnavailableError',
        operation: message.operation,
      }));
      return;
    }

    const result = await descriptor.handle(Object.freeze({
      issuerKey,
      operationId: message.operationId,
      signal: registration.active.signal,
      publishProgress: (
        stage: WorkerProgressStage,
        completedUnits: number,
        totalUnits: number | undefined,
        messageKey: string,
      ): void => {
        if (!registry.has(message.operationId)) return;
        for (const operationId of registry.getOperationIds(message.operationId)) {
          post(Object.freeze({
            type: 'operation.progress',
            operationId,
            stage,
            completedUnits,
            ...(totalUnits === undefined ? {} : { totalUnits }),
            messageKey,
          }));
        }
      },
    }), message.payload);

    if (!registry.has(message.operationId) || registration.active.signal.aborted) {
      return;
    }
    for (const completion of registry.publish(message.operationId, result).messages) {
      post(completion);
    }
  } catch (error: unknown) {
    if (error instanceof IssuerOperationBusyError) {
      post(Object.freeze({ type: 'operation.failed', operationId: message.operationId, issue: error }));
      return;
    }
    if (!registry.has(message.operationId)) {
      return;
    }
    const recipients = registry.fail(message.operationId);
    postFailure(recipients, error);
  }
}

function cancelOperation(message: Extract<UiToWorkerMessage<unknown>, { type: 'operation.cancel' }>): void {
  try {
    const cancelled = registry.cancel(message.operationId);
    for (const operationId of cancelled.operationIds) {
      post(Object.freeze({
        type: 'operation.cancelled',
        operationId,
        issue: CANCELLED_ISSUE,
      }));
    }
  } catch (error: unknown) {
    if (error instanceof UnknownOperationIdError) {
      post(Object.freeze({ type: 'operation.failed', operationId: message.operationId, issue: error }));
      return;
    }
    throw error;
  }
}

export async function handleWorkerMessage(value: unknown): Promise<void> {
  const message = parseMessage(value);
  if (message === undefined) return;

  if (message.type === 'operation.cancel') {
    cancelOperation(message);
    return;
  }
  await startOperation(message);
}

const runtime = globalThis as unknown as WorkerRuntime;
if (runtime.document === undefined && runtime.addEventListener !== undefined) {
  runtime.addEventListener('message', (event) => {
    void handleWorkerMessage(event.data);
  });
}
