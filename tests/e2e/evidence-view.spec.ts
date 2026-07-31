import { expect, test } from '@playwright/test';

test('issuer identity and filing evidence remain visible and accessible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Issuer evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Issuer identity and filings' })).toBeVisible();
  const identity = page.getByRole('complementary', { name: 'Issuer identity' });
  await expect(identity).toContainText('0000320193');
  await expect(page.getByRole('table', { name: 'SEC filings used as source evidence' })).toBeVisible();
  await expect(page.getByText('0000320193-25-000079')).toBeVisible();
});
