import { expect, test } from '@playwright/test';

test('nine deterministic rules and synthesis share one fingerprint and disclose limitations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.locator('[data-rule-id]')).toHaveCount(9);
  await expect(page.getByText('Not investment advice.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthesis: mixed with limitations' })).toBeVisible();
  const fingerprints = await page.locator('[data-rule-id] code').allTextContents();
  expect(new Set(fingerprints).size).toBe(1);
  await expect(page.getByText('target price')).toBeVisible();
});
