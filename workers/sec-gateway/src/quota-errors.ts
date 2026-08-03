export type QuotaProblemCode = 'quota_exhausted' | 'nonessential_refresh_stopped';

const DEFAULT_RETRY_AFTER_SECONDS = 3_600;

export function createQuotaProblemResponse(
  code: QuotaProblemCode,
  retryAfterSeconds: number = DEFAULT_RETRY_AFTER_SECONDS,
): Response {
  if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 1) {
    throw new TypeError('INVALID_RETRY_AFTER_SECONDS');
  }
  const status = code === 'quota_exhausted' ? 429 : 503;
  const body = Object.freeze({
    type: `https://finscope.local/problems/${code}`,
    title: code === 'quota_exhausted' ? 'Cloudflare Free quota exhausted' : 'Refresh temporarily disabled',
    status,
    code,
    detail: 'Network refresh is unavailable; the last valid local snapshot remains active.',
    retryability: 'after_retry_after',
    preservedState: 'last_valid_local_snapshot',
    paidFallback: false,
  });
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/problem+json',
      'retry-after': String(retryAfterSeconds),
      'cache-control': 'no-store',
    },
  });
}
