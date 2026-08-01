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

async function addManualObservation(page: Page, date: string, price: string): Promise<void> {
  await page.getByLabel('Observation date (YYYY-MM-DD)').fill(date);
  await page.getByLabel('Closing price').fill(price);
  await pressButton(page.getByRole('button', { name: 'Add manual observation', exact: true }));
}

async function confirmMutation(page: Page, label: string, dialogName: RegExp): Promise<void> {
  await pressButton(page.getByRole('button', { name: label, exact: true }));
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await pressButton(dialog.getByRole('button', { name: label, exact: true }));
}

test('manual import binds invalid date and price errors to their fields before preview', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price import');

  const dateField = page.getByLabel('Observation date (YYYY-MM-DD)');
  const priceField = page.getByLabel('Closing price');
  await dateField.fill('2025-02-30');
  await priceField.fill('-1');
  await pressButton(page.getByRole('button', { name: 'Add manual observation', exact: true }));

  await expect(dateField).toHaveAttribute('aria-invalid', 'true');
  await expect(dateField).toHaveAttribute('aria-describedby', /manual-price-date-error/u);
  await expect(page.locator('#manual-price-date-error')).toContainText('Invalid calendar date');
  await expect(priceField).toHaveAttribute('aria-invalid', 'true');
  await expect(priceField).toHaveAttribute('aria-describedby', /manual-price-value-error/u);
  await expect(page.locator('#manual-price-value-error')).toContainText('greater than zero');
  await expect(page.getByTestId('price-import-preview')).toHaveCount(0);
  await expect(page.getByTestId('active-price-pointer')).toContainText('No active price overlay');
});

test('manual preview requires confirmation and restores focus after cancellation and import', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price import');

  await addManualObservation(page, '2025-01-03', '100');
  await addManualObservation(page, '2025-01-31', '110');
  await addManualObservation(page, '2025-03-14', '105');
  await pressButton(page.getByRole('button', { name: 'Create price preview', exact: true }));

  const preview = page.getByTestId('price-import-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('2025-01-03 to 2025-03-14');
  await expect(preview).toContainText('3');
  await expect(preview).toContainText('Preview valid');
  await expect(page.getByTestId('active-price-pointer')).toContainText('No active price overlay');

  const importButton = page.getByRole('button', { name: 'Import price overlay', exact: true });
  await pressButton(importButton);
  const dialog = page.getByRole('dialog', { name: 'Confirm price import' });
  await expect(dialog).toBeVisible();
  await pressButton(dialog.getByRole('button', { name: 'Cancel', exact: true }));
  await expect(importButton).toBeFocused();
  await expect(page.getByTestId('active-price-pointer')).toContainText('No active price overlay');

  await pressButton(importButton);
  await pressButton(dialog.getByRole('button', { name: 'Import price overlay', exact: true }));
  await expect(page.locator('#price-import-status')).toContainText('version 1 imported');
  await expect(page.getByRole('button', { name: 'Replace price overlay', exact: true })).toBeFocused();
  await expect(page.getByTestId('active-price-pointer')).toContainText('Version');
  await expect(page.getByTestId('active-price-pointer')).toContainText('1');
  await expect(page.getByText('Last price event:')).toContainText('historical_price_imported');
  await expect(page.getByText('Unaffected:')).toContainText('fundamental fingerprints');
});

test('CSV import, replacement and deletion each use an explicit confirmation gate', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price import');
  await selectRadio(page, 'CSV import');

  const csvInput = page.getByLabel('CSV file');
  await csvInput.setInputFiles({
    name: 'prices-v1.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,110\n2025-03-14,105\n'),
  });
  await expect(page.locator('#price-import-status')).toContainText('CSV parsed: 3 observations');
  await pressButton(page.getByRole('button', { name: 'Create price preview', exact: true }));
  await confirmMutation(page, 'Import price overlay', /Confirm price import/u);
  await expect(page.locator('#price-import-status')).toContainText('version 1 imported');

  await csvInput.setInputFiles({
    name: 'prices-v2.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,112\n2025-03-14,120\n'),
  });
  await pressButton(page.getByRole('button', { name: 'Create price preview', exact: true }));
  await confirmMutation(page, 'Replace price overlay', /Confirm price replacement/u);
  await expect(page.locator('#price-import-status')).toContainText('version 2 replaced');
  await expect(page.getByTestId('active-price-pointer')).toContainText('2');
  await expect(page.getByText('Last price event:')).toContainText('historical_price_replaced');

  const deleteButton = page.getByRole('button', { name: 'Delete price overlay', exact: true });
  await pressButton(deleteButton);
  const deleteDialog = page.getByRole('dialog', { name: 'Confirm price deletion' });
  await expect(deleteDialog).toBeVisible();
  await pressButton(deleteDialog.getByRole('button', { name: /Delete price overlay: Confirm price deletion/u }));
  await expect(page.locator('#price-import-status')).toContainText('Price overlay deleted');
  await expect(deleteButton).toBeFocused();
  await expect(page.getByTestId('active-price-pointer')).toContainText('No active price overlay');
  await expect(page.getByText('Last price event:')).toContainText('historical_price_deleted');
});
