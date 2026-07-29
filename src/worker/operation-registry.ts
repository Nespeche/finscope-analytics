import {
  DuplicateOperationIdError,
  type OperationCompletedMessage,
  type OperationInstanceId,
  type OperationProgressMessage,
  type WorkerOperationKind,
} from '../types/messages';

const issuerOperationKeyBrand: unique symbol = Symbol('IssuerOperationKey');

export type IssuerOperationKey = string & {
  readonly [issuerOperationKeyBrand]: true;
};

export interface RegisterOperationInput {
  readonly issuerKey: IssuerOperationKey;
  readonly operation: WorkerOperationKind;
  readonly operationId: OperationInstanceId;
}

export interface ActiveOperationSnapshot {
  readonly issuerKey: IssuerOperationKey;
  readonly operation: WorkerOperationKind;
  readonly primaryOperationId: OperationInstanceId;
  readonly operationIds: readonly OperationInstanceId[];
  readonly signal: AbortSignal;
}

export type RegisterOperationResult =
  | Readonly<{ status: 'started'; active: ActiveOperationSnapshot }>
  | Readonly<{ status: 'coalesced'; active: ActiveOperationSnapshot }>;

export interface PublishedOperationResult<TResult> {
  readonly issuerKey: IssuerOperationKey;
  readonly operation: WorkerOperationKind;
  readonly result: TResult;
  readonly messages: readonly OperationCompletedMessage<TResult>[];
}

export interface CancelledOperationResult<TResult> {
  readonly issuerKey: IssuerOperationKey;
  readonly operation: WorkerOperationKind;
  readonly operationIds: readonly OperationInstanceId[];
  readonly priorPublishedResult:
    | Readonly<{ status: 'none' }>
    | Readonly<{ status: 'available'; result: TResult }>;
}

export interface OperationExecutionContext {
  readonly signal: AbortSignal;
  readonly reportProgress: (message: Omit<OperationProgressMessage, 'type' | 'operationId'>) => void;
}

export interface TypedOperationDescriptor<
  TPayload,
  TOperationResult,
  TPublishedResult = TOperationResult,
> {
  readonly operation: WorkerOperationKind;
  readonly execute: (
    payload: TPayload,
    context: OperationExecutionContext,
  ) => Promise<TOperationResult>;
  readonly mayPublish: (result: TOperationResult) => boolean;
  readonly toPublishedResult?: (result: TOperationResult) => TPublishedResult;
}

export type DispatchOperationResult<TResult, TPublishedResult> =
  | Readonly<{
      status: 'coalesced';
      active: ActiveOperationSnapshot;
    }>
  | Readonly<{
      status: 'published';
      result: TResult;
      publication: PublishedOperationResult<TPublishedResult>;
      progress: readonly OperationProgressMessage[];
    }>
  | Readonly<{
      status: 'preserved';
      result: TResult;
      priorPublishedResult:
        | Readonly<{ status: 'none' }>
        | Readonly<{ status: 'available'; result: TPublishedResult }>;
      progress: readonly OperationProgressMessage[];
    }>
  | Readonly<{
      status: 'cancelled';
      cancellation: CancelledOperationResult<TPublishedResult>;
      progress: readonly OperationProgressMessage[];
    }>;

interface ActiveOperation {
  readonly issuerKey: IssuerOperationKey;
  readonly operation: WorkerOperationKind;
  readonly primaryOperationId: OperationInstanceId;
  readonly operationIds: Set<OperationInstanceId>;
  readonly controller: AbortController;
}

export class IssuerOperationBusyError extends Error {
  constructor(
    readonly issuerKey: IssuerOperationKey,
    readonly activeOperation: WorkerOperationKind,
    readonly requestedOperation: WorkerOperationKind,
  ) {
    super(
      `Issuer ${issuerKey} already has active operation ${activeOperation}; cannot start ${requestedOperation}.`,
    );
    this.name = 'IssuerOperationBusyError';
  }
}

export class UnknownOperationIdError extends Error {
  constructor(readonly operationId: OperationInstanceId) {
    super(`Unknown active operation ID: ${operationId}`);
    this.name = 'UnknownOperationIdError';
  }
}

export class CancelledOperationPublicationError extends Error {
  constructor(readonly operationId: OperationInstanceId) {
    super(`Cancelled operation cannot publish a result: ${operationId}`);
    this.name = 'CancelledOperationPublicationError';
  }
}

export class DuplicateOperationDescriptorError extends Error {
  constructor(readonly operation: WorkerOperationKind) {
    super(`Duplicate operation descriptor: ${operation}`);
    this.name = 'DuplicateOperationDescriptorError';
  }
}

export class UnknownOperationDescriptorError extends Error {
  constructor(readonly operation: WorkerOperationKind) {
    super(`Unknown operation descriptor: ${operation}`);
    this.name = 'UnknownOperationDescriptorError';
  }
}

export function parseIssuerOperationKey(value: string): IssuerOperationKey {
  if (!/^\d{10}$/u.test(value)) {
    throw new TypeError(`Issuer operation key must be a normalized ten-digit CIK: ${value}`);
  }
  return value as IssuerOperationKey;
}

function freezeOperationIds(values: Iterable<OperationInstanceId>): readonly OperationInstanceId[] {
  return Object.freeze([...values]);
}

function snapshot(active: ActiveOperation): ActiveOperationSnapshot {
  return Object.freeze({
    issuerKey: active.issuerKey,
    operation: active.operation,
    primaryOperationId: active.primaryOperationId,
    operationIds: freezeOperationIds(active.operationIds),
    signal: active.controller.signal,
  });
}

function priorPublishedResult<TResult>(value: TResult | undefined):
  | Readonly<{ status: 'none' }>
  | Readonly<{ status: 'available'; result: TResult }> {
  return value === undefined
    ? Object.freeze({ status: 'none' as const })
    : Object.freeze({ status: 'available' as const, result: value });
}

export class OperationRegistry<TResult = unknown> {
  readonly #activeByIssuer = new Map<IssuerOperationKey, ActiveOperation>();
  readonly #activeByOperationId = new Map<OperationInstanceId, ActiveOperation>();
  readonly #publishedByIssuer = new Map<IssuerOperationKey, TResult>();
  readonly #descriptors = new Map<
    WorkerOperationKind,
    TypedOperationDescriptor<unknown, unknown, TResult>
  >();
  readonly #cancelledByOperationId = new Map<OperationInstanceId, CancelledOperationResult<TResult>>();

  registerDescriptor<TPayload, TOperationResult>(
    descriptor: TypedOperationDescriptor<TPayload, TOperationResult, TResult>,
  ): void {
    if (this.#descriptors.has(descriptor.operation)) {
      throw new DuplicateOperationDescriptorError(descriptor.operation);
    }
    this.#descriptors.set(
      descriptor.operation,
      descriptor as TypedOperationDescriptor<unknown, unknown, TResult>,
    );
  }

  hasDescriptor(operation: WorkerOperationKind): boolean {
    return this.#descriptors.has(operation);
  }

  register(input: RegisterOperationInput): RegisterOperationResult {
    if (this.#activeByOperationId.has(input.operationId)) {
      throw new DuplicateOperationIdError(input.operationId);
    }

    const existing = this.#activeByIssuer.get(input.issuerKey);
    if (existing !== undefined) {
      if (existing.operation !== input.operation) {
        throw new IssuerOperationBusyError(
          input.issuerKey,
          existing.operation,
          input.operation,
        );
      }
      existing.operationIds.add(input.operationId);
      this.#activeByOperationId.set(input.operationId, existing);
      return Object.freeze({ status: 'coalesced', active: snapshot(existing) });
    }

    const active: ActiveOperation = {
      issuerKey: input.issuerKey,
      operation: input.operation,
      primaryOperationId: input.operationId,
      operationIds: new Set([input.operationId]),
      controller: new AbortController(),
    };
    this.#activeByIssuer.set(input.issuerKey, active);
    this.#activeByOperationId.set(input.operationId, active);
    return Object.freeze({ status: 'started', active: snapshot(active) });
  }

  async dispatch<TPayload, TOperationResult>(
    input: RegisterOperationInput,
    payload: TPayload,
  ): Promise<DispatchOperationResult<TOperationResult, TResult>> {
    const descriptor = this.#descriptors.get(input.operation);
    if (descriptor === undefined) throw new UnknownOperationDescriptorError(input.operation);
    const registration = this.register(input);
    if (registration.status === 'coalesced') {
      return Object.freeze({ status: 'coalesced' as const, active: registration.active });
    }

    const progress: OperationProgressMessage[] = [];
    const context: OperationExecutionContext = Object.freeze({
      signal: registration.active.signal,
      reportProgress: (message: Omit<OperationProgressMessage, 'type' | 'operationId'>) => {
        progress.push(Object.freeze({
          type: 'operation.progress' as const,
          operationId: input.operationId,
          ...message,
        }));
      },
    });

    let result: TOperationResult;
    try {
      result = await descriptor.execute(payload, context) as TOperationResult;
    } catch (error: unknown) {
      const cancellation = this.#consumeCancellation(input.operationId);
      if (cancellation !== undefined) {
        return Object.freeze({
          status: 'cancelled' as const,
          cancellation,
          progress: Object.freeze(progress),
        });
      }
      if (this.has(input.operationId)) this.fail(input.operationId);
      throw error;
    }

    const cancellation = this.#consumeCancellation(input.operationId);
    if (cancellation !== undefined) {
      return Object.freeze({
        status: 'cancelled' as const,
        cancellation,
        progress: Object.freeze(progress),
      });
    }

    if ((descriptor.mayPublish as (value: TOperationResult) => boolean)(result)) {
      const publishedResult = descriptor.toPublishedResult === undefined
        ? result as unknown as TResult
        : (descriptor.toPublishedResult as (value: TOperationResult) => TResult)(result);
      const publication = this.publish(input.operationId, publishedResult);
      return Object.freeze({
        status: 'published' as const,
        result,
        publication,
        progress: Object.freeze(progress),
      });
    }

    const prior = priorPublishedResult(this.#publishedByIssuer.get(input.issuerKey));
    this.fail(input.operationId);
    return Object.freeze({
      status: 'preserved' as const,
      result,
      priorPublishedResult: prior,
      progress: Object.freeze(progress),
    });
  }

  getActiveByIssuer(issuerKey: IssuerOperationKey): ActiveOperationSnapshot | undefined {
    const active = this.#activeByIssuer.get(issuerKey);
    return active === undefined ? undefined : snapshot(active);
  }

  getOperationIds(operationId: OperationInstanceId): readonly OperationInstanceId[] {
    const active = this.#requireActive(operationId);
    return freezeOperationIds(active.operationIds);
  }

  has(operationId: OperationInstanceId): boolean {
    return this.#activeByOperationId.has(operationId);
  }

  getPublishedResult(issuerKey: IssuerOperationKey): TResult | undefined {
    return this.#publishedByIssuer.get(issuerKey);
  }

  publish(operationId: OperationInstanceId, result: TResult): PublishedOperationResult<TResult> {
    const active = this.#requireActive(operationId);
    if (active.controller.signal.aborted) {
      throw new CancelledOperationPublicationError(operationId);
    }

    const operationIds = freezeOperationIds(active.operationIds);
    this.#publishedByIssuer.set(active.issuerKey, result);
    this.#release(active);

    return Object.freeze({
      issuerKey: active.issuerKey,
      operation: active.operation,
      result,
      messages: Object.freeze(operationIds.map((recipientOperationId) => Object.freeze({
        type: 'operation.completed' as const,
        operationId: recipientOperationId,
        result,
      }))),
    });
  }

  cancel(operationId: OperationInstanceId): CancelledOperationResult<TResult> {
    const active = this.#requireActive(operationId);
    const operationIds = freezeOperationIds(active.operationIds);
    const priorResult = this.#publishedByIssuer.get(active.issuerKey);
    active.controller.abort('user_requested');
    const cancellation = Object.freeze({
      issuerKey: active.issuerKey,
      operation: active.operation,
      operationIds,
      priorPublishedResult: priorPublishedResult(priorResult),
    });
    for (const registeredOperationId of operationIds) {
      this.#cancelledByOperationId.set(registeredOperationId, cancellation);
    }
    this.#release(active);
    return cancellation;
  }

  fail(operationId: OperationInstanceId): readonly OperationInstanceId[] {
    const active = this.#requireActive(operationId);
    const operationIds = freezeOperationIds(active.operationIds);
    this.#release(active);
    return operationIds;
  }

  #consumeCancellation(operationId: OperationInstanceId): CancelledOperationResult<TResult> | undefined {
    const cancellation = this.#cancelledByOperationId.get(operationId);
    if (cancellation === undefined) return undefined;
    for (const registeredOperationId of cancellation.operationIds) {
      this.#cancelledByOperationId.delete(registeredOperationId);
    }
    return cancellation;
  }

  #requireActive(operationId: OperationInstanceId): ActiveOperation {
    const active = this.#activeByOperationId.get(operationId);
    if (active === undefined) {
      throw new UnknownOperationIdError(operationId);
    }
    return active;
  }

  #release(active: ActiveOperation): void {
    this.#activeByIssuer.delete(active.issuerKey);
    for (const operationId of active.operationIds) {
      this.#activeByOperationId.delete(operationId);
    }
  }
}
