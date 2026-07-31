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
const companyFactsEnvelope = {
  sourceKind: 'company_facts',
  cik: '0000320193',
  payloadSha256: '2'.repeat(64),
  payload: { cik: 320193, entityName: 'Apple Inc.', facts: {} },
};

test('manual refresh requires consent and double activation creates one operation and candidate', async ({ page }) => {
  let submissionsRequests = 0;
  let companyFactsRequests = 0;
  let releaseSubmissions: (() => void) | undefined;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    submissionsRequests += 1;
    await new Promise<void>((resolve) => { releaseSubmissions = resolve; });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
  });
  await page.route('**/issuers/0000320193/company-facts', async (route) => {
    companyFactsRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(companyFactsEnvelope) });
  });

  await page.goto('/');
  const refreshButton = page.getByTestId('refresh-fundamentals-button');
  await expect(refreshButton).toBeVisible();
  await expect(page.getByText(/forces a one-time SEC Submissions check/u)).toBeVisible();

  await refreshButton.click();
  await expect(page.getByTestId('refresh-status')).toContainText('Refresh consent is required');
  expect(submissionsRequests).toBe(0);
  expect(companyFactsRequests).toBe(0);

  await page.getByRole('checkbox', { name: 'Allow open, resume, and manual SEC refreshes' }).check();
  await refreshButton.click();
  await expect.poll(() => submissionsRequests).toBe(1);
  await expect(refreshButton).toHaveAttribute('aria-busy', 'true');
  await expect(refreshButton).toBeDisabled();

  await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    void refreshRuntime.requestManualRefresh();
  });
  await page.waitForTimeout(25);
  expect(submissionsRequests).toBe(1);

  releaseSubmissions?.();
  await expect(page.getByTestId('refresh-state')).toHaveText('ready');
  expect(companyFactsRequests).toBe(1);

  const runtime = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(runtime.operationCount).toBe(1);
  expect(runtime.candidateCount).toBe(1);
  expect(runtime.activePointerGeneration).toBe(2);
  expect(runtime.networkCallCount).toBe(2);
  expect(runtime.quota?.externalCallCount).toBe(2);
});

test('cancellation preserves the prior pointer and exposes keyboard recovery', async ({ page }) => {
  let releaseSubmissions: (() => void) | undefined;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    await new Promise<void>((resolve) => { releaseSubmissions = resolve; });
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
    } catch {
      // The browser request is expected to be aborted by cancellation.
    }
  });

  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Allow open, resume, and manual SEC refreshes' }).check();
  const refreshButton = page.getByTestId('refresh-fundamentals-button');
  await refreshButton.click();
  await expect(page.getByTestId('refresh-state')).toHaveText('acquiring');

  const cancelButton = page.getByTestId('cancel-refresh-button');
  await cancelButton.focus();
  await cancelButton.press('Enter');
  releaseSubmissions?.();

  await expect(page.getByTestId('refresh-state')).toHaveText('cancelled');
  await expect(page.getByRole('alert')).toContainText('previous active snapshot and pointer were preserved');
  await expect(refreshButton).toHaveAttribute('aria-disabled', 'true');
  const restartButton = page.getByRole('button', { name: 'Restart refresh' });
  await expect(restartButton).toBeVisible();
  await expect(restartButton).toBeFocused();
  await expect(page.getByRole('button', { name: 'Use last snapshot' })).toBeVisible();

  const runtime = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(runtime.activeSnapshotId).toBe('snapshot-0000320193-active');
  expect(runtime.activePointerGeneration).toBe(1);
  expect(runtime.candidateCount).toBe(0);
  expect(runtime.preservedCapabilities).toEqual([
    'issuer_identity',
    'local_snapshot',
    'definitions',
    'mappings',
    'evidence',
  ]);
});
