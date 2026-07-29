import { defineConfig } from 'vitest/config';

export const DETERMINISTIC_TEST_INSTANT = '2025-01-15T12:00:00.000Z';
export const DETERMINISTIC_TEST_LOCALE = 'en-US';
export const DETERMINISTIC_TEST_TIMEZONE = 'UTC';
export const DETERMINISTIC_FIXTURE_SEED = 20250115;

const deterministicProjectOptions = {
  environment: 'node',
  setupFiles: ['./tests/setup/deterministic-environment.ts'],
  passWithNoTests: true,
  fileParallelism: false,
  maxWorkers: 1,
  minWorkers: 1,
  retry: 0,
  sequence: {
    concurrent: false,
    shuffle: false,
    setupFiles: 'list' as const,
  },
};

export default defineConfig({
  test: {
    allowOnly: false,
    bail: 1,
    reporters: ['default'],
    projects: [
      {
        extends: true,
        test: {
          ...deterministicProjectOptions,
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...deterministicProjectOptions,
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...deterministicProjectOptions,
          name: 'contract',
          include: ['tests/contract/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...deterministicProjectOptions,
          name: 'negative',
          include: ['tests/negative/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          ...deterministicProjectOptions,
          name: 'performance',
          include: ['tests/performance/**/*.test.ts'],
        },
      },
    ],
  },
});
