import { expect, test } from '@playwright/test';

test('ambiguous aliases remain local and keyboard selection preserves issuer context', async ({ page }) => {
  let gatewayRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/issuers/')) gatewayRequests += 1;
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Issuer search' }).click();
  await expect(page.getByRole('heading', { name: 'Select an issuer' })).toBeVisible();

  await page.getByLabel('Ticker alias or CIK').fill('ALPHA');
  await page.getByRole('button', { name: 'Find issuer' }).click();

  await expect(page.getByRole('alert')).toContainText('More than one issuer matches');
  const firstCandidate = page.getByRole('button', { name: /Select Alphabet Inc., CIK 0001652044/u });
  await firstCandidate.focus();
  await page.keyboard.press('Enter');

  const context = page.getByRole('complementary', { name: 'Active issuer context' });
  await expect(context).toContainText('Alphabet Inc.');
  await expect(context).toContainText('0001652044');
  await expect(context).toContainText('us-gaap-industrial-v1');
  await expect(context).toContainText('Not selected');
  await expect(context).toContainText('No local snapshot');
  expect(gatewayRequests).toBe(0);
});
