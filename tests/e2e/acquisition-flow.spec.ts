import { expect, test } from '@playwright/test';

const submissionsEnvelope = {
  sourceKind: 'submissions',
  cik: '0000320193',
  payloadSha256: '1'.repeat(64),
  payload: { cik: '0000320193', filings: { recent: {} } },
};
const companyFactsEnvelope = {
  sourceKind: 'company_facts',
  cik: '0000320193',
  payloadSha256: '2'.repeat(64),
  payload: { cik: 320193, entityName: 'Apple Inc.', facts: {} },
};

test('manual consent gates SEC acquisition and announces completion', async ({ page }) => {
  const upstreamRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/issuers/')) upstreamRequests.push(request.url());
  });
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
    } catch {
      // The browser request may already be aborted by the user-facing cancellation action.
    }
  });
  await page.route('**/issuers/0000320193/company-facts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(companyFactsEnvelope) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'SEC acquisition' }).click();
  await expect(page.getByRole('heading', { name: 'Acquire SEC filings and Company Facts' })).toBeVisible();
  expect(upstreamRequests).toHaveLength(0);

  await page.getByRole('button', { name: 'Update fundamentals' }).click();
  await expect(page.locator('#acquisition-status')).toContainText('Grant network consent');
  expect(upstreamRequests).toHaveLength(0);

  await page.getByRole('checkbox', { name: /Allow this manual SEC refresh/u }).check();
  await page.getByRole('button', { name: 'Update fundamentals' }).click();
  await expect(page.locator('#acquisition-status')).toContainText('SEC acquisition completed');
  await expect(page.getByText('2 of 2 required SEC resources completed')).toBeVisible();
  expect(upstreamRequests).toHaveLength(2);
});

test('cancel and retry preserve the active snapshot and remain keyboard reachable', async ({ page }) => {
  let releaseSubmissions: (() => void) | undefined;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    await new Promise<void>((resolve) => { releaseSubmissions = resolve; });
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(submissionsEnvelope) });
    } catch {
      // Expected when the browser has already aborted the in-flight request.
    }
  });
  await page.route('**/issuers/0000320193/company-facts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(companyFactsEnvelope) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'SEC acquisition' }).click();
  await page.getByRole('checkbox', { name: /Allow this manual SEC refresh/u }).check();
  await page.getByRole('button', { name: 'Update fundamentals' }).click();

  const cancelButton = page.getByRole('button', { name: 'Cancel acquisition' });
  await expect(cancelButton).toBeEnabled();
  await cancelButton.focus();
  await expect(cancelButton).toBeFocused();
  await cancelButton.press('Enter');
  releaseSubmissions?.();

  await expect(page.getByRole('alert')).toContainText('cancelled');
  await expect(page.getByRole('heading', { name: 'Active snapshot protection' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry acquisition' })).toBeEnabled();
});
