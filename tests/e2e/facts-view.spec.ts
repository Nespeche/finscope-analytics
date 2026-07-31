import { expect, test } from '@playwright/test';

test('raw normalized and unavailable facts are semantically distinct', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Facts' }).click();
  await expect(page.getByRole('heading', { name: 'Fact lineage and normalization' })).toBeVisible();
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Raw SEC fact');
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Normalized fact');
  await expect(page.locator('[data-fact-state="unavailable"]')).toContainText('Unavailable');
  await expect(page.getByText('high')).toBeVisible();
});
