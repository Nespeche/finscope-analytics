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

async function previewCsv(page: Page, filename: string, body: string): Promise<void> {
  await selectRadio(page, 'CSV import');
  await page.getByLabel('CSV file').setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(body),
  });
  await expect(page.locator('#price-import-status')).toContainText('CSV parsed');
  await pressButton(page.getByRole('button', { name: 'Create price preview', exact: true }));
  await expect(page.getByTestId('price-import-preview')).toContainText('Preview valid');
}

async function confirmPriceMutation(page: Page, label: string, dialogName: string): Promise<void> {
  await pressButton(page.getByRole('button', { name: label, exact: true }));
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await pressButton(dialog.getByRole('button', { name: label, exact: true }));
}

test('price overlay lifecycle preserves fundamentals and maintains separate fingerprints', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price analysis');

  const fundamentalInput = await page.getByTestId('analysis-fundamental-input-fingerprint').textContent();
  const fundamentalAnalysis = await page.getByTestId('analysis-fundamental-analysis-fingerprint').textContent();
  await expect(page.getByTestId('fundamental-only-status')).toContainText('remains complete');
  await expect(page.getByText(
    'Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.',
    { exact: true },
  )).toBeVisible();

  await activateRoute(page, 'Price import');
  await previewCsv(
    page,
    'overlay-v1.csv',
    'date,close\n2025-01-03,100\n2025-02-21,90\n2025-05-09,120\n',
  );
  await confirmPriceMutation(page, 'Import price overlay', 'Confirm price import');
  await expect(page.locator('#price-import-status')).toContainText('Fundamental artifacts are unchanged');

  await activateRoute(page, 'Price analysis');
  await expect(page.getByTestId('analysis-fundamental-input-fingerprint')).toHaveText(fundamentalInput ?? '');
  await expect(page.getByTestId('analysis-fundamental-analysis-fingerprint')).toHaveText(fundamentalAnalysis ?? '');
  await expect(page.getByTestId('price-summary')).toContainText('irregular');
  await expect(page.getByTestId('price-summary')).toContainText('historical_descriptive_only');
  await expect(page.getByTestId('fundamental-isolation-status')).toContainText('remain unchanged');
  const overlayFingerprintV1 = await page.getByTestId('analysis-price-overlay-fingerprint').textContent();
  const analysisFingerprintV1 = await page.getByTestId('analysis-price-analysis-fingerprint').textContent();
  expect(overlayFingerprintV1).toMatch(/^sha256:[0-9a-f]{64}$/u);
  expect(analysisFingerprintV1).toMatch(/^sha256:[0-9a-f]{64}$/u);

  await activateRoute(page, 'Price import');
  await previewCsv(
    page,
    'overlay-v2.csv',
    'date,close\n2025-01-03,100\n2025-02-21,95\n2025-05-09,130\n',
  );
  await confirmPriceMutation(page, 'Replace price overlay', 'Confirm price replacement');
  await expect(page.getByTestId('active-price-pointer')).toContainText('2');

  await activateRoute(page, 'Price analysis');
  await expect(page.getByTestId('analysis-fundamental-input-fingerprint')).toHaveText(fundamentalInput ?? '');
  await expect(page.getByTestId('analysis-fundamental-analysis-fingerprint')).toHaveText(fundamentalAnalysis ?? '');
  const overlayFingerprintV2 = await page.getByTestId('analysis-price-overlay-fingerprint').textContent();
  const analysisFingerprintV2 = await page.getByTestId('analysis-price-analysis-fingerprint').textContent();
  expect(overlayFingerprintV2).not.toBe(overlayFingerprintV1);
  expect(analysisFingerprintV2).not.toBe(analysisFingerprintV1);
  await expect(page.getByText(
    'Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.',
    { exact: true },
  )).toBeVisible();

  await page.getByLabel('Evaluation date for displayed age').fill('2025-06-01');
  await expect(page.getByTestId('analysis-price-overlay-fingerprint')).toHaveText(overlayFingerprintV2 ?? '');
  await expect(page.getByTestId('analysis-price-analysis-fingerprint')).toHaveText(analysisFingerprintV2 ?? '');

  await activateRoute(page, 'Price import');
  await pressButton(page.getByRole('button', { name: 'Delete price overlay', exact: true }));
  const deleteDialog = page.getByRole('dialog', { name: 'Confirm price deletion' });
  await pressButton(deleteDialog.getByRole('button', { name: /Delete price overlay: Confirm price deletion/u }));
  await expect(page.locator('#price-import-status')).toContainText('Fundamental artifacts and the fundamental pointer are unchanged');

  await activateRoute(page, 'Price analysis');
  await expect(page.getByTestId('fundamental-only-status')).toContainText('remains complete');
  await expect(page.getByTestId('analysis-fundamental-input-fingerprint')).toHaveText(fundamentalInput ?? '');
  await expect(page.getByTestId('analysis-fundamental-analysis-fingerprint')).toHaveText(fundamentalAnalysis ?? '');
  await expect(page.getByTestId('analysis-price-overlay-fingerprint')).toHaveCount(0);
  await expect(page.getByText(
    'Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.',
    { exact: true },
  )).toBeVisible();
});
