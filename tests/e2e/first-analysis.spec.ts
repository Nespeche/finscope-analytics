import { expect, test } from '@playwright/test';

test('first analysis outputs are independently reproducible without price', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Issuer evidence' }).click();
  await expect(page.getByText('0000320193')).toBeVisible();
  await page.getByRole('button', { name: 'Facts' }).click();
  await expect(page.getByText('analysis-3ef1294ac4e87df48d4eb90561f1d047')).toBeVisible();
  await page.getByRole('button', { name: 'Fundamental metrics' }).click();
  await expect(page.locator('[data-metric-state]')).toHaveCount(24);
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.locator('[data-rule-id]')).toHaveCount(9);
  await expect(page.getByText('Price data is intentionally excluded.')).toBeVisible();
});

test('partial analysis preserves explicit unavailable states', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Facts' }).click();
  await expect(page.locator('[data-fact-state="unavailable"]')).toBeVisible();
  await page.getByRole('button', { name: 'Fundamental metrics' }).click();
  await expect(page.locator('[data-metric-state="not_available"]')).toBeVisible();
  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.locator('[data-rule-outcome="not_evaluable"]')).toHaveCount(2);
});
