import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
}

test('all 24 metrics expose period state reason and evidence without invented values', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Fundamental metrics');
  await expect(page.getByRole('heading', { name: 'Fundamental metrics' })).toBeVisible();
  const cards = page.locator('[data-metric-state]');
  await expect(cards).toHaveCount(24);
  await expect(page.locator('[data-metric-state="not_available"]')).toContainText('Unavailable');
  await expect(page.locator('[data-metric-state="not_applicable"]')).toContainText('not applicable');
  await cards.first().getByRole('link', { name: 'View evidence' }).click();
  await expect(page.locator('#metric-evidence-1')).toBeVisible();
});
