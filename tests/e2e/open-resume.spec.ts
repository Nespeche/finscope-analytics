import { expect, test } from '@playwright/test';

const submissionsEnvelope = {
  sourceKind: 'submissions',
  cik: '0000320193',
  payloadSha256: '1'.repeat(64),
  payload: {
    cik: '0000320193',
    filings: {
      recent: {
        accessionNumber: ['0000320193-26-000001'],
        form: ['10-Q'],
        filingDate: ['2026-07-30'],
        reportDate: ['2026-06-30'],
        primaryDocument: ['aapl-20260630.htm'],
      },
    },
  },
};

test('open and resume with refresh consent disabled make zero network calls', async ({ page }) => {
  let issuerRequests = 0;
  await page.route('**/issuers/**', async (route) => {
    issuerRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
  });

  await page.goto('/');
  await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    refreshRuntime.resetForTesting();
    window.dispatchEvent(new Event('resume'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });

  await expect(page.getByTestId('refresh-state')).toHaveText('ready');
  await expect(page.getByTestId('refresh-status')).toContainText('zero network calls');
  expect(issuerRequests).toBe(0);

  const runtime = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(runtime.pluginInstallationCount).toBe(1);
  expect(runtime.networkCallCount).toBe(0);
  expect(runtime.activeSnapshotId).toBe('snapshot-0000320193-active');
});

test('duplicate resume events coalesce and a closed application performs no work', async ({ page }) => {
  let submissionsRequests = 0;
  let releaseSubmissions: (() => void) | undefined;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    submissionsRequests += 1;
    await new Promise<void>((resolve) => { releaseSubmissions = resolve; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
  });

  await page.goto('/');
  await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    refreshRuntime.resetForTesting();
    refreshRuntime.setRefreshConsent(true);
    refreshRuntime.setCacheAgeSeconds(21_600);
    window.dispatchEvent(new Event('resume'));
    window.dispatchEvent(new Event('resume'));
  });

  await expect.poll(() => submissionsRequests).toBe(1);
  await expect(page.getByTestId('refresh-state')).toHaveText('acquiring');
  releaseSubmissions?.();
  await expect(page.getByTestId('refresh-state')).toHaveText('ready');

  const completed = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(completed.operationCount).toBe(1);
  expect(completed.candidateCount).toBe(0);
  expect(completed.activePointerGeneration).toBe(1);

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    window.dispatchEvent(new Event('resume'));
  });
  await page.waitForTimeout(50);
  expect(submissionsRequests).toBe(1);

  const closed = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(closed.foregroundActive).toBe(false);
  expect(closed.lastReasonCode).toBe('closed_application');
});
