import { defineConfig, devices } from '@playwright/test';

export const PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:4173';
export const PLAYWRIGHT_TIMEZONE = 'UTC';
export const PLAYWRIGHT_LOCALE = 'en-US';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    'e2e/**/*.spec.ts',
    'accessibility/**/*.spec.ts',
    'performance/**/*.spec.ts',
  ],
  outputDir: './test-results/playwright',
  globalSetup: './tests/e2e/global.setup.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: PLAYWRIGHT_BASE_URL,
    locale: PLAYWRIGHT_LOCALE,
    timezoneId: PLAYWRIGHT_TIMEZONE,
    colorScheme: 'light',
    contextOptions: {
      reducedMotion: 'reduce',
    },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: PLAYWRIGHT_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
