import { expect, test } from '@playwright/test';

const routes = [
  'Home',
  'Issuer search',
  'SEC acquisition',
  'Issuer evidence',
  'Facts',
  'Fundamental metrics',
  'Insights',
  'Price import',
  'Price analysis',
  'Privacy settings',
  'Data management',
];

test('the global disclaimer is mounted and all outputs remain descriptive', async ({ page }) => {
  await page.goto('/');
  for (const route of routes) {
    await page.getByRole('button', { name: route }).click();
    const disclaimer = page.getByTestId('analysis-disclaimer');
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText('not personalized investment advice');
    await expect(disclaimer).toContainText('does not issue buy, sell or hold instructions');
    await expect(disclaimer).toContainText('Historical prices are an optional descriptive overlay');
  }
});

test('no interactive action provides a recommendation, target price or return promise', async ({ page }) => {
  await page.goto('/');
  const prohibitedAction = /^(?:buy|sell|hold)\b|target price|guaranteed return|expected return|personalized recommendation/iu;
  for (const route of routes) {
    await page.getByRole('button', { name: route }).click();
    const interactiveNames = await page.locator('button, a, input, select, textarea').evaluateAll((elements) => elements.map((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return element.getAttribute('aria-label') ?? element.getAttribute('name') ?? '';
      }
      return element.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
    }));
    for (const name of interactiveNames) expect(name).not.toMatch(prohibitedAction);
  }

  await page.getByRole('button', { name: 'Insights' }).click();
  await expect(page.getByText('Not investment advice.', { exact: true })).toBeVisible();
  await expect(page.getByText(/do not provide a recommendation, target price or confidence score/u)).toBeVisible();
});
