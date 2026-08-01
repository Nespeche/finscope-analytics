import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
}

async function importCsv(page: Page): Promise<void> {
  await activateRoute(page, 'Price import');
  await page.getByLabel('CSV import').check();
  await page.getByLabel('CSV file').setInputFiles({
    name: 'analysis-prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,110\n2025-03-14,120\n'),
  });
  await page.getByRole('button', { name: 'Create price preview', exact: true }).click();
  await page.getByRole('button', { name: 'Import price overlay', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm price import' });
  await dialog.getByRole('button', { name: 'Import price overlay', exact: true }).click();
  await expect(page.locator('#price-import-status')).toContainText('version 1 imported');
}

test('fundamental-only analysis remains complete without a price overlay', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price analysis');

  await expect(page.getByRole('heading', { name: 'Historical price analysis' })).toBeVisible();
  await expect(page.getByTestId('fundamental-only-status')).toContainText('remains complete');
  await expect(page.getByRole('heading', { name: 'No active price overlay' })).toBeVisible();
  await expect(page.getByText('No valuation is generated.')).toBeVisible();
  await expect(page.getByText('0000320193')).toBeVisible();
  await expect(page.getByText('FY 2025')).toBeVisible();
  await expect(page.getByText('us-gaap-industrial-v1')).toBeVisible();
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
  await expect(page.getByRole('table', { name: 'Historical price observations' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Historical price observations' }).getByRole('row')).toHaveCount(4);
  await expect(page.getByText('The last observation is above the first observation.')).toBeVisible();
  await expect(page.getByText('No valuation is generated.')).toBeVisible();
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
  await expect(page.getByText('not stored in the overlay')).toBeVisible();
});
