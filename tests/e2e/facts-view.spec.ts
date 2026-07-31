import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
}

test('raw normalized and unavailable facts are semantically distinct', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Facts');
  await expect(page.getByRole('heading', { name: 'Fact lineage and normalization' })).toBeVisible();
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Raw SEC fact');
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Normalized fact');
  await expect(page.locator('[data-fact-state="unavailable"]')).toContainText('Unavailable');
  await expect(page.getByText('high')).toBeVisible();
});
