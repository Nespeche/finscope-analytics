import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
}

test('first analysis outputs are independently reproducible without price', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Issuer evidence');
  await expect(page.getByText('0000320193', { exact: true })).toBeVisible();
  await activateRoute(page, 'Facts');
  await expect(page.getByText('analysis-3ef1294ac4e87df48d4eb90561f1d047', { exact: true })).toBeVisible();
  await activateRoute(page, 'Fundamental metrics');
  await expect(page.locator('[data-metric-state]')).toHaveCount(24);
  await activateRoute(page, 'Insights');
  await expect(page.locator('[data-rule-id]')).toHaveCount(9);
  await expect(page.getByText('Price data is intentionally excluded.', { exact: true })).toBeVisible();
});

test('partial analysis preserves explicit unavailable states', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Facts');
  await expect(page.locator('[data-fact-state="unavailable"]')).toBeVisible();
  await activateRoute(page, 'Fundamental metrics');
  await expect(page.locator('[data-metric-state="not_available"]')).toBeVisible();
  await activateRoute(page, 'Insights');
  await expect(page.locator('[data-rule-outcome="not_evaluable"]')).toHaveCount(2);
});
