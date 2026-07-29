import { afterEach, beforeEach, vi } from 'vitest';

export const FIXED_TEST_INSTANT = '2025-01-15T12:00:00.000Z';
export const FIXED_TEST_LOCALE = 'en-US';
export const FIXED_TEST_TIMEZONE = 'UTC';
export const FIXED_FIXTURE_SEED = 20250115;
export const NETWORK_DISABLED_REASON =
  'Live network access is disabled in deterministic tests. Use a frozen fixture and record any explicit skip reason.';

const originalFetch = globalThis.fetch;

process.env.TZ = FIXED_TEST_TIMEZONE;
process.env.LANG = 'en_US.UTF-8';
process.env.LC_ALL = 'en_US.UTF-8';

beforeEach((): void => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_TEST_INSTANT));
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (..._arguments: unknown[]): Promise<never> => {
      throw new Error(NETWORK_DISABLED_REASON);
    },
  });
});

afterEach((): void => {
  vi.useRealTimers();
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: originalFetch,
  });
});
