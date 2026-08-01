import { expect, test, type Locator, type Page } from '@playwright/test';

async function pressButton(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

async function activateRoute(page: Page, name: string): Promise<void> {
  await pressButton(page.getByRole('button', { name, exact: true }));
}

async function selectRadio(page: Page, name: string): Promise<void> {
  const radio = page.getByLabel(name);
  await radio.focus();
  await radio.press('Space');
  await expect(radio).toBeChecked();
}

async function importCsv(page: Page): Promise<void> {
  await activateRoute(page, 'Price import');
  await selectRadio(page, 'CSV import');
  await page.getByLabel('CSV file').setInputFiles({
    name: 'analysis-prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,110\n2025-03-14,120\n'),
  });
  await pressButton(page.getByRole('button', { name: 'Create price preview', exact: true }));
  await pressButton(page.getByRole('button', { name: 'Import price overlay', exact: true }));
  const dialog = page.getByRole('dialog', { name: 'Confirm price import' });
  await pressButton(dialog.getByRole('button', { name: 'Import price overlay', exact: true }));
  await expect(page.locator('#price-import-status')).toContainText('version 1 imported');
}

test('fundamental-only analysis remains complete without a price overlay', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price analysis');

  await expect(page.getByRole('heading', { name: 'Historical price analysis' })).toBeVisible();
  await expect(page.getByTestId('fundamental-only-status')).toContainText('remains complete');
  await expect(page.getByRole('heading', { name: 'No active price overlay' })).toBeVisible();
  await expect(page.getByText(
    'Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.',
    { exact: true },
  )).toBeVisible();
  const context = page.getByRole('complementary', { name: 'Fundamental context remains visible' });
  await expect(context.getByText('0000320193', { exact: true })).toBeVisible();
  await expect(context.getByText('FY 2025', { exact: true })).toBeVisible();
  await expect(context.getByText('us-gaap-industrial-v1', { exact: true })).toBeVisible();
});

test('price analysis exposes summary, eight metrics and equivalent chart data', async ({ page }) => {
  await page.goto('/');
  await importCsv(page);
  await activateRoute(page, 'Price analysis');

  const summary = page.getByTestId('price-summary');
  await expect(summary).toContainText('2025-03-14');
  await expect(summary).toContainText('2025-01-03 to 2025-03-14');
  await expect(summary).toContainText('irregular');
  await expect(summary).toContainText('3');
  await expect(summary).toContainText('historical_descriptive_only');
  await expect(summary).toContainText('1');

  const metricRows = page.getByTestId('price-metric-row');
  await expect(metricRows).toHaveCount(8);
  for (const metric of [
    'MKT_LAST_OBSERVATION',
    'MKT_MIN',
    'MKT_MAX',
    'MKT_MEAN',
    'MKT_MEDIAN',
    'MKT_SIMPLE_RETURN',
    'MKT_MAX_DRAWDOWN',
    'MKT_TREND_DIRECTION',
  ]) {
    await expect(page.locator(`[data-metric-id="${metric}"]`)).toBeVisible();
  }

  await expect(page.getByRole('img', { name: 'Historical price line chart' })).toBeVisible();
  const valuesTable = page.getByRole('table', { name: 'Historical price observations' });
  await expect(valuesTable).toBeVisible();
  await expect(valuesTable.getByRole('row')).toHaveCount(4);
  await expect(page.locator('#historical-price-chart-description')).toContainText(
    'The last observation is above the first observation.',
  );
  await expect(page.getByText(
    'Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.',
    { exact: true },
  )).toBeVisible();
});

test('display age changes only presentation and leaves price fingerprints unchanged', async ({ page }) => {
  await page.goto('/');
  await importCsv(page);
  await activateRoute(page, 'Price analysis');

  const overlayFingerprint = await page.getByTestId('analysis-price-overlay-fingerprint').textContent();
  const analysisFingerprint = await page.getByTestId('analysis-price-analysis-fingerprint').textContent();
  await page.getByLabel('Evaluation date for displayed age').fill('2025-03-20');
  await expect(page.getByTestId('price-display-age')).toHaveText('6 days');
  await expect(page.getByTestId('analysis-price-overlay-fingerprint')).toHaveText(overlayFingerprint ?? '');
  await expect(page.getByTestId('analysis-price-analysis-fingerprint')).toHaveText(analysisFingerprint ?? '');
  await expect(page.getByText(/This presentation-only value is not stored in the overlay/u)).toBeVisible();
});
