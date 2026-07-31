import { expect, test } from '@playwright/test';

test('all 24 metrics expose period state reason and evidence without invented values', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fundamental metrics' }).click();
  await expect(page.getByRole('heading', { name: 'Fundamental metrics' })).toBeVisible();
  const cards = page.locator('[data-metric-state]');
  await expect(cards).toHaveCount(24);
  await expect(page.locator('[data-metric-state="not_available"]')).toContainText('Unavailable');
  await expect(page.locator('[data-metric-state="not_applicable"]')).toContainText('not applicable');
  await cards.first().getByRole('link', { name: 'View evidence' }).click();
  await expect(page.locator('#metric-evidence-1')).toBeVisible();
});
