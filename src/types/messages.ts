const operationInstanceIdBrand: unique symbol = Symbol('OperationInstanceId');

export type OperationInstanceId = string & {
  readonly [operationInstanceIdBrand]: true;
};

export const WORKER_OPERATION_KINDS = Object.freeze([
  'acquireSecData',
  'activateFundamentalSnapshot',
  'analyzeFundamentals',
  'cancelOperation',
  'clearIssuerContext',
  'deleteLocalData',
  'deletePriceOverlay',
  'normalizeBundle',
  'publishPriceOverlay',
  'reanalyzeAffectedMappings',
  'reanalyzeAffectedMetrics',
  'reanalyzeRules',
  'refreshFundamentals',
  'selectIssuer',
  'showFailure',
  'showPartial',
  'useActiveSnapshot',
] as const);

export type WorkerOperationKind = typeof WORKER_OPERATION_KINDS[number];

export type WorkerProgressStage =
  | 'checking'
  | 'acquiring'
  | 'normalizing'
  | 'analyzing'
  | 'publishing';

export interface StartOperationMessage<TPayload = unknown> {
  readonly type: 'operation.start';
  readonly operationId: OperationInstanceId;
  readonly operation: WorkerOperationKind;
  readonly payload: TPayload;
}

export interface CancelOperationMessage {
  readonly type: 'operation.cancel';
  readonly operationId: OperationInstanceId;
  readonly reason: 'user_requested';
}

export type UiToWorkerMessage<TPayload = unknown> =
  | StartOperationMessage<TPayload>
  | CancelOperationMessage;

export interface OperationAcceptedMessage {
  readonly type: 'operation.accepted';
  readonly operationId: OperationInstanceId;
  readonly operation: WorkerOperationKind;
}

export interface OperationProgressMessage {
  readonly type: 'operation.progress';
  readonly operationId: OperationInstanceId;
  readonly stage: WorkerProgressStage;
  readonly completedUnits: number;
  readonly totalUnits?: number;
  readonly messageKey: string;
}

export interface OperationCompletedMessage<TResult = unknown> {
  readonly type: 'operation.completed';
  readonly operationId: OperationInstanceId;
  readonly result: TResult;
}

export interface OperationFailedMessage<TIssue = unknown> {
  readonly type: 'operation.failed';
  readonly operationId: OperationInstanceId;
  readonly issue: TIssue;
}

export interface OperationCancelledMessage<TIssue = unknown> {
  readonly type: 'operation.cancelled';
  readonly operationId: OperationInstanceId;
  readonly issue: TIssue;
}

export type WorkerToUiMessage<TResult = unknown, TIssue = unknown> =
  | OperationAcceptedMessage
  | OperationProgressMessage
  | OperationCompletedMessage<TResult>
  | OperationFailedMessage<TIssue>
  | OperationCancelledMessage<TIssue>;

const OPERATION_INSTANCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export class DuplicateOperationIdError extends Error {
  constructor(readonly operationId: OperationInstanceId) {
    super(`Duplicate operation ID: ${operationId}`);
    this.name = 'DuplicateOperationIdError';
  }
}

export function parseOperationInstanceId(value: string): OperationInstanceId {
  if (!OPERATION_INSTANCE_ID_PATTERN.test(value)) {
    throw new TypeError(`Invalid operation instance ID: ${JSON.stringify(value)}`);
  }
  return value as OperationInstanceId;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated message: ${JSON.stringify(value)}`);
}

export class OperationIdRegistry {
  readonly #active = new Set<OperationInstanceId>();

  register(operationId: OperationInstanceId): void {
    if (this.#active.has(operationId)) {
      throw new DuplicateOperationIdError(operationId);
    }
    this.#active.add(operationId);
  }

  release(operationId: OperationInstanceId): boolean {
    return this.#active.delete(operationId);
  }

  has(operationId: OperationInstanceId): boolean {
    return this.#active.has(operationId);
  }

  get size(): number {
    return this.#active.size;
  }
}

export function assertUniqueOperationIds(
  messages: readonly { readonly operationId: OperationInstanceId }[],
): void {
  const registry = new OperationIdRegistry();
  for (const message of messages) {
    registry.register(message.operationId);
  }
}
