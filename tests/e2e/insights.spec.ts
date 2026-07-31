import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
}

test('nine deterministic rules and synthesis share one fingerprint and disclose limitations', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Insights');
  await expect(page.locator('[data-rule-id]')).toHaveCount(9);
  await expect(page.getByText('Not investment advice.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthesis: mixed with limitations' })).toBeVisible();
  const fingerprints = await page.locator('[data-rule-id] code').allTextContents();
  expect(new Set(fingerprints).size).toBe(1);
  await expect(page.getByText('target price')).toBeVisible();
});
