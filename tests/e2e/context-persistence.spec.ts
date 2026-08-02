import { expect, test } from '@playwright/test';

async function selectAlphabet(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Issuer search' }).click();
  await page.getByLabel('Ticker alias or CIK').fill('GOOGL');
  await page.getByRole('button', { name: 'Find issuer' }).click();
  await expect(page.getByRole('complementary', { name: 'Active issuer context' })).toContainText('Alphabet Inc.');
}

test('explicit issuer context stays visible across navigation and reload', async ({ page }) => {
  await page.goto('/');
  await selectAlphabet(page);

  const context = page.getByTestId('analysis-context');
  await expect(context).toContainText('Alphabet Inc.');
  await expect(page.getByTestId('context-cik')).toHaveText('0001652044');
  await expect(page.getByTestId('context-profile')).toHaveText('us-gaap-industrial-v1');
  await expect(page.getByTestId('context-period')).toHaveText('Not selected');
  await expect(page.getByTestId('context-snapshot')).toHaveText('No local snapshot');

  await page.getByRole('button', { name: 'Price analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Historical price analysis' })).toBeVisible();
  await expect(context).toContainText('Alphabet Inc.');
  await expect(page.getByTestId('context-cik')).toHaveText('0001652044');

  await page.reload();
  await expect(page.getByTestId('analysis-context')).toContainText('Alphabet Inc.');
  await expect(page.getByTestId('context-cik')).toHaveText('0001652044');
});

test('navigation never replaces an explicit context with a view fixture silently', async ({ page }) => {
  await page.goto('/');
  await selectAlphabet(page);
  for (const route of ['Issuer evidence', 'Facts', 'Fundamental metrics', 'Insights', 'Price import']) {
    await page.getByRole('button', { name: route }).click();
    await expect(page.getByTestId('context-issuer')).toHaveText('Alphabet Inc.');
    await expect(page.getByTestId('context-cik')).toHaveText('0001652044');
  }
});
