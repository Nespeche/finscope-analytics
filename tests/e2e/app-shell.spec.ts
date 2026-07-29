import { expect, test } from '@playwright/test';

test('application shell exposes keyboard-reachable landmarks', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name.startsWith('mobile') ? 'mobile' : 'desktop';
  const viewportSize = page.viewportSize();
  expect(viewportSize, `${viewport} project must define a viewport`).not.toBeNull();
  if (viewportSize !== null) {
    if (viewport === 'mobile') {
      expect(viewportSize.width).toBeLessThan(768);
    } else {
      expect(viewportSize.width).toBeGreaterThanOrEqual(1024);
    }
  }

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'FinScope Analytics' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Workspace ready');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await page.getByRole('button', { name: 'Home' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('tabindex', '-1');
  await status.focus();
  await expect(status).toBeFocused();
});
