import {
  OperationQuotaGuard,
  SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST,
  type ExternalCallPermit,
  type LogicalRequestToken,
  type QuotaStopReason,
} from './quota-state';

export const SEC_RETRY_BACKOFF_MILLISECONDS = Object.freeze([1_000, 2_000, 4_000] as const);
export const SEC_MAXIMUM_JITTER_MILLISECONDS = 250 as const;
export const SEC_MAXIMUM_RETRY_AFTER_MILLISECONDS = 30_000 as const;

export type RetryFailureReason =
  | 'request_timeout'
  | 'provider_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'non_retryable_failure';

export type RetryAttemptResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
    ok: false;
    retryable: boolean;
    reasonCode: RetryFailureReason;
    retryAfter?: string | number;
  }>;

export interface RetryAttemptContext {
  readonly signal: AbortSignal;
  readonly permit: ExternalCallPermit;
}

export interface ExecuteWithRetryInput<T> {
  readonly guard: OperationQuotaGuard;
  readonly token: LogicalRequestToken;
  readonly attempt: (context: RetryAttemptContext) => Promise<RetryAttemptResult<T>>;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly jitterMilliseconds?: () => number;
}

export type ExecuteWithRetryResult<T> =
  | Readonly<{ status: 'succeeded'; value: T; attempts: number }>
  | Readonly<{
    status: 'failed';
    reasonCode: RetryFailureReason | 'retry_exhausted';
    attempts: number;
  }>
  | Readonly<{
    status: 'stopped';
    reasonCode: QuotaStopReason;
    attempts: number;
  }>;

function assertJitter(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > SEC_MAXIMUM_JITTER_MILLISECONDS) {
    throw new TypeError('SEC_JITTER_OUT_OF_RANGE');
  }
  return value;
}

export function parseRetryAfterMilliseconds(
  value: string | number | undefined,
  nowMilliseconds: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(nowMilliseconds)) throw new TypeError('INVALID_RETRY_CLOCK');
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.min(Math.floor(value * 1_000), SEC_MAXIMUM_RETRY_AFTER_MILLISECONDS);
  }
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    return Math.min(Number(trimmed) * 1_000, SEC_MAXIMUM_RETRY_AFTER_MILLISECONDS);
  }
  const absolute = Date.parse(trimmed);
  if (Number.isNaN(absolute)) return undefined;
  return Math.min(Math.max(0, absolute - nowMilliseconds), SEC_MAXIMUM_RETRY_AFTER_MILLISECONDS);
}

export interface RetryDelayInput {
  readonly failedAttemptNumber: number;
  readonly retryAfter?: string | number;
  readonly nowMilliseconds: number;
  readonly jitterMilliseconds: number;
}

export function computeRetryDelayMilliseconds(input: RetryDelayInput): number {
  if (
    !Number.isInteger(input.failedAttemptNumber)
    || input.failedAttemptNumber < 1
    || input.failedAttemptNumber > SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST
  ) {
    throw new TypeError('FAILED_ATTEMPT_NUMBER_OUT_OF_RANGE');
  }
  const retryAfter = parseRetryAfterMilliseconds(input.retryAfter, input.nowMilliseconds);
  if (retryAfter !== undefined) return retryAfter;
  const base = SEC_RETRY_BACKOFF_MILLISECONDS[input.failedAttemptNumber - 1];
  if (base === undefined) throw new Error('SEC_BACKOFF_AUTHORITY_MISSING');
  return base + assertJitter(input.jitterMilliseconds);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function abortError(reason: unknown): DOMException {
  return new DOMException(typeof reason === 'string' ? reason : 'Operation aborted.', 'AbortError');
}

async function defaultSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError(signal.reason);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortError(signal.reason));
    }, { once: true });
  });
}

async function runTimedAttempt<T>(
  attempt: (context: RetryAttemptContext) => Promise<RetryAttemptResult<T>>,
  permit: ExternalCallPermit,
  parentSignal: AbortSignal | undefined,
): Promise<RetryAttemptResult<T>> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortFromParent: (() => void) | undefined;

  const timeout = new Promise<RetryAttemptResult<T>>((resolve) => {
    timeoutHandle = setTimeout(() => {
      controller.abort('request_timeout');
      resolve(Object.freeze({
        ok: false as const,
        retryable: true,
        reasonCode: 'request_timeout' as const,
      }));
    }, permit.requestTimeoutMilliseconds);
  });

  const racers: Promise<RetryAttemptResult<T>>[] = [
    attempt(Object.freeze({ signal: controller.signal, permit })),
    timeout,
  ];
  if (parentSignal !== undefined) {
    racers.push(new Promise<RetryAttemptResult<T>>((_resolve, reject) => {
      abortFromParent = (): void => {
        controller.abort(parentSignal.reason ?? 'operation_cancelled');
        reject(abortError(parentSignal.reason));
      };
      if (parentSignal.aborted) abortFromParent();
      else parentSignal.addEventListener('abort', abortFromParent, { once: true });
    }));
  }

  try {
    return await Promise.race(racers);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (abortFromParent !== undefined) parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

/** Executes at most three attempts and charges every attempt to the shared 14-call guard. */
export async function executeWithRetry<T>(
  input: ExecuteWithRetryInput<T>,
): Promise<ExecuteWithRetryResult<T>> {
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? defaultSleep;
  const jitter = input.jitterMilliseconds ?? (() => 0);
  let attempts = 0;

  while (attempts < SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST) {
    if (input.signal?.aborted) {
      input.guard.cancel();
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_cancelled' as const, attempts });
    }
    const authorization = input.guard.authorizeAttempt(input.token, now());
    if (authorization.status === 'stopped') {
      return Object.freeze({ status: 'stopped' as const, reasonCode: authorization.reasonCode, attempts });
    }
    attempts = authorization.attemptNumber;

    let result: RetryAttemptResult<T>;
    try {
      result = await runTimedAttempt(input.attempt, authorization, input.signal);
    } catch (error: unknown) {
      if (input.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        input.guard.cancel();
        return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_cancelled' as const, attempts });
      }
      result = Object.freeze({
        ok: false as const,
        retryable: true,
        reasonCode: 'provider_unavailable' as const,
      });
    }

    if (result.ok) {
      input.guard.completeLogicalRequest(input.token);
      return Object.freeze({ status: 'succeeded' as const, value: result.value, attempts });
    }
    if (!result.retryable) {
      input.guard.completeLogicalRequest(input.token);
      return Object.freeze({ status: 'failed' as const, reasonCode: result.reasonCode, attempts });
    }
    if (attempts >= SEC_MAX_ATTEMPTS_PER_LOGICAL_REQUEST) {
      input.guard.completeLogicalRequest(input.token);
      return Object.freeze({ status: 'failed' as const, reasonCode: 'retry_exhausted' as const, attempts });
    }

    const delay = computeRetryDelayMilliseconds({
      failedAttemptNumber: attempts,
      ...(result.retryAfter === undefined ? {} : { retryAfter: result.retryAfter }),
      nowMilliseconds: now(),
      jitterMilliseconds: assertJitter(jitter()),
    });
    if (now() + delay >= authorization.operationDeadlineMilliseconds) {
      return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_timeout' as const, attempts });
    }
    try {
      await sleep(delay, input.signal ?? new AbortController().signal);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        input.guard.cancel();
        return Object.freeze({ status: 'stopped' as const, reasonCode: 'operation_cancelled' as const, attempts });
      }
      throw error;
    }
  }

  throw new Error('UNREACHABLE_RETRY_STATE');
}
