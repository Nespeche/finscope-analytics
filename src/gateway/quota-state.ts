export const SEC_MAX_EXTERNAL_CALLS_PER_OPERATION = 14 as const;
export const SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST = 3 as const;
export const SEC_REQUEST_TIMEOUT_MILLISECONDS = 20_000 as const;
export const SEC_OPERATION_TIMEOUT_MILLISECONDS = 120_000 as const;

const logicalRequestTokenBrand: unique symbol = Symbol('LogicalRequestToken');

export interface LogicalRequestToken {
  readonly requestKey: string;
  readonly [logicalRequestTokenBrand]: true;
}

export type QuotaStopReason =
  | 'quota_exhausted'
  | 'retry_exhausted'
  | 'operation_timeout'
  | 'operation_cancelled'
  | 'nonessential_refresh_stopped';

export interface OpenLogicalRequestInput {
  readonly requestKey: string;
  readonly essential: boolean;
  readonly reserveCalls?: number;
}

export type OpenLogicalRequestResult =
  | Readonly<{ status: 'opened'; token: LogicalRequestToken }>
  | Readonly<{ status: 'stopped'; reasonCode: QuotaStopReason }>;

export interface ExternalCallPermit {
  readonly status: 'permitted';
  readonly requestKey: string;
  readonly attemptNumber: number;
  readonly externalCallNumber: number;
  readonly remainingExternalCalls: number;
  readonly requestTimeoutMilliseconds: 20_000;
  readonly operationDeadlineMilliseconds: number;
}

export type ExternalCallAuthorization =
  | ExternalCallPermit
  | Readonly<{ status: 'stopped'; reasonCode: QuotaStopReason }>;

export interface OperationQuotaSnapshot {
  readonly externalCallCount: number;
  readonly remainingExternalCalls: number;
  readonly logicalRequestCount: number;
  readonly cancelled: boolean;
  readonly operationDeadlineMilliseconds: number;
}

interface LogicalRequestState {
  readonly requestKey: string;
  readonly essential: boolean;
  readonly reserveCalls: number;
  attempts: number;
  completed: boolean;
}

export class DuplicateSecRequestKeyError extends Error {
  constructor(readonly requestKey: string) {
    super(`Duplicate SEC request key within one operation: ${requestKey}`);
    this.name = 'DuplicateSecRequestKeyError';
  }
}

export class UnknownLogicalRequestTokenError extends Error {
  constructor() {
    super('Logical request token is not owned by this quota guard.');
    this.name = 'UnknownLogicalRequestTokenError';
  }
}

function validateNonNegativeInteger(value: number, code: string): number {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

/** One shared fail-closed guard for SEC call count, attempts, timeouts and cancellation. */
export class OperationQuotaGuard {
  readonly #startedAtMilliseconds: number;
  readonly #requestKeys = new Set<string>();
  readonly #requests = new WeakMap<LogicalRequestToken, LogicalRequestState>();
  #externalCallCount = 0;
  #logicalRequestCount = 0;
  #cancelled = false;

  constructor(startedAtMilliseconds: number) {
    if (!Number.isFinite(startedAtMilliseconds)) {
      throw new TypeError('INVALID_OPERATION_START_TIME');
    }
    this.#startedAtMilliseconds = startedAtMilliseconds;
  }

  get operationDeadlineMilliseconds(): number {
    return this.#startedAtMilliseconds + SEC_OPERATION_TIMEOUT_MILLISECONDS;
  }

  openLogicalRequest(input: OpenLogicalRequestInput): OpenLogicalRequestResult {
    if (input.requestKey.length === 0) throw new TypeError('EMPTY_SEC_REQUEST_KEY');
    if (this.#cancelled) return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_cancelled' as const });
    if (this.#requestKeys.has(input.requestKey)) throw new DuplicateSecRequestKeyError(input.requestKey);
    const reserveCalls = validateNonNegativeInteger(
      input.reserveCalls ?? 0,
      'RESERVE_CALLS_MUST_BE_A_NON_NEGATIVE_INTEGER',
    );
    const remaining = SEC_MAX_EXTERNAL_CALLS_PER_OPERATION - this.#externalCallCount;
    if (!input.essential && remaining <= reserveCalls) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'nonessential_refresh_stopped' as const });
    }
    if (remaining === 0) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'quota_exhausted' as const });
    }

    const token = Object.freeze({
      requestKey: input.requestKey,
      [logicalRequestTokenBrand]: true as const,
    }) as LogicalRequestToken;
    this.#requestKeys.add(input.requestKey);
    this.#logicalRequestCount += 1;
    this.#requests.set(token, {
      requestKey: input.requestKey,
      essential: input.essential,
      reserveCalls,
      attempts: 0,
      completed: false,
    });
    return Object.freeze({ status: 'opened' as const, token });
  }

  authorizeAttempt(
    token: LogicalRequestToken,
    nowMilliseconds: number,
  ): ExternalCallAuthorization {
    const request = this.#requests.get(token);
    if (request === undefined || request.completed) throw new UnknownLogicalRequestTokenError();
    if (!Number.isFinite(nowMilliseconds)) throw new TypeError('INVALID_OPERATION_CLOCK');
    if (this.#cancelled) return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_cancelled' as const });
    if (nowMilliseconds >= this.operationDeadlineMilliseconds) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_timeout' as const });
    }
    if (request.attempts >= SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'retry_exhausted' as const });
    }
    const remainingBeforeCall = SEC_MAX_EXTERNAL_CALLS_PER_OPERATION - this.#externalCallCount;
    if (!request.essential && remainingBeforeCall <= request.reserveCalls) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'nonessential_refresh_stopped' as const });
    }
    if (remainingBeforeCall === 0) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'quota_exhausted' as const });
    }

    request.attempts += 1;
    this.#externalCallCount += 1;
    return Object.freeze({
      status: 'permitted' as const,
      requestKey: request.requestKey,
      attemptNumber: request.attempts,
      externalCallNumber: this.#externalCallCount,
      remainingExternalCalls: SEC_MAX_EXTERNAL_CALLS_PER_OPERATION - this.#externalCallCount,
      requestTimeoutMilliseconds: SEC_REQUEST_TIMEOUT_MILLISECONDS,
      operationDeadlineMilliseconds: this.operationDeadlineMilliseconds,
    });
  }

  completeLogicalRequest(token: LogicalRequestToken): void {
    const request = this.#requests.get(token);
    if (request === undefined || request.completed) throw new UnknownLogicalRequestTokenError();
    request.completed = true;
  }

  cancel(): void {
    this.#cancelled = true;
  }

  snapshot(): OperationQuotaSnapshot {
    return Object.freeze({
      externalCallCount: this.#externalCallCount,
      remainingExternalCalls: SEC_MAX_EXTERNAL_CALLS_PER_OPERATION - this.#externalCallCount,
      logicalRequestCount: this.#logicalRequestCount,
      cancelled: this.#cancelled,
      operationDeadlineMilliseconds: this.operationDeadlineMilliseconds,
    });
  }
}
