import { expect, test, type Locator, type Page } from '@playwright/test';

const routes = [
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
] as const;

async function press(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press('Enter');
}

async function openRoute(page: Page, route: string): Promise<void> {
  await press(page.getByRole('button', { name: route, exact: true }));
  await expect(page.getByRole('main')).toBeFocused();
}

async function auditControlNames(page: Page, route: string): Promise<void> {
  const audit = await page.getByRole('main').evaluate((main) => {
    function textFromIds(ids: string | null): string {
      if (ids === null) return '';
      return ids.split(/\s+/u)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    }

    function controlName(control: HTMLElement): string {
      const ariaLabel = control.getAttribute('aria-label')?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = textFromIds(control.getAttribute('aria-labelledby'));
      if (labelledBy) return labelledBy;
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
        const labels = [...control.labels ?? []].map((label) => label.textContent?.trim() ?? '').filter(Boolean);
        if (labels.length > 0) return labels.join(' ');
      }
      return control.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
    }

    const controls = [...main.querySelectorAll<HTMLElement>('button, input:not([type="hidden"]), select, textarea, a[href]')]
      .filter((control) => !control.hasAttribute('hidden'));
    const names = controls.map((control) => ({
      tag: control.tagName.toLocaleLowerCase('en-US'),
      type: control instanceof HTMLInputElement ? control.type : undefined,
      name: controlName(control),
      placeholder: control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
        ? control.placeholder.trim()
        : '',
    }));
    const empty = names.filter((entry) => entry.name.length === 0);
    const placeholderOnly = names.filter((entry) => entry.placeholder.length > 0 && entry.name === entry.placeholder);
    const duplicates = [...new Set(names.map((entry) => entry.name).filter((name, index, all) => (
      name.length > 0 && all.indexOf(name) !== index
    )))];
    return { names, empty, placeholderOnly, duplicates };
  });

  expect(audit.empty, `${route}: every control needs a programmatic name`).toEqual([]);
  expect(audit.placeholderOnly, `${route}: no control may depend only on placeholder text`).toEqual([]);
  expect(audit.duplicates, `${route}: control names must be unique and unambiguous within the view`).toEqual([]);
}

test('all B20 views expose explicit, unique control names without placeholder-only labels', async ({ page }) => {
  await page.goto('/');
  for (const route of routes) {
    await openRoute(page, route);
    await auditControlNames(page, route);
  }
});

test('issuer and acquisition errors are programmatically associated and actionable', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Issuer search');
  const issuerQuery = page.getByLabel('Ticker alias or CIK');
  await issuerQuery.fill('UNKNOWN');
  await press(page.getByRole('button', { name: 'Find issuer', exact: true }));
  await expect(issuerQuery).toHaveAttribute('aria-invalid', 'true');
  await expect(issuerQuery).toHaveAttribute('aria-errormessage', 'issuer-search-status');
  await expect(page.locator('#issuer-search-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#issuer-search-status')).toContainText('Correct the ticker or enter a CIK');

  await openRoute(page, 'SEC acquisition');
  const cik = page.getByLabel('Issuer CIK');
  await cik.fill('123');
  await press(page.getByRole('button', { name: 'Update fundamentals', exact: true }));
  await expect(cik).toHaveAttribute('aria-invalid', 'true');
  await expect(cik).toHaveAttribute('aria-errormessage', 'acquisition-cik-error');
  await expect(page.locator('#acquisition-cik-error')).toContainText('exactly ten digits');
  await expect(page.locator('#acquisition-status')).toHaveAttribute('role', 'alert');
});

test('price and data-management validation links each error to the exact field', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Price import');
  const date = page.getByLabel('Observation date (YYYY-MM-DD)');
  const price = page.getByLabel('Closing price');
  await date.fill('2025-02-30');
  await price.fill('-1');
  await press(page.getByRole('button', { name: 'Add manual observation', exact: true }));
  await expect(date).toHaveAttribute('aria-errormessage', 'manual-price-date-error');
  await expect(price).toHaveAttribute('aria-errormessage', 'manual-price-value-error');
  await expect(page.locator('#price-import-status')).toHaveAttribute('role', 'alert');

  await openRoute(page, 'Data management');
  await page.getByRole('checkbox', { name: 'Allow this view to open and change IndexedDB' }).check();
  const deleteCik = page.getByLabel('Issuer CIK');
  await deleteCik.fill('12');
  await press(page.getByRole('button', { name: 'Delete price history', exact: true }));
  await expect(deleteCik).toHaveAttribute('aria-invalid', 'true');
  await expect(deleteCik).toHaveAttribute('aria-errormessage', 'price-delete-cik-error');
  await expect(page.locator('#price-delete-cik-error')).toContainText('ten-digit CIK');
  await expect(page.getByTestId('data-management-status')).toHaveAttribute('role', 'alert');
});

test('statuses, busy states and destructive consequences remain explicit', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Privacy settings');
  const privacyStatus = page.getByTestId('privacy-status');
  await expect(privacyStatus).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByRole('button', { name: 'Revoke refresh consent' })).toHaveAttribute('aria-describedby', 'refresh-consent-consequence');
  await expect(page.getByRole('button', { name: 'Revoke storage consent' })).toHaveAttribute('aria-describedby', 'storage-consent-consequence');

  await openRoute(page, 'Data management');
  await expect(page.getByRole('button', { name: 'Delete price history' })).toHaveAttribute('aria-describedby', 'delete-price-consequence');
  await expect(page.getByRole('button', { name: 'Export backup and delete all data' })).toHaveAttribute('aria-describedby', 'delete-all-consequence');
  await expect(page.getByTestId('data-management-status')).toHaveAttribute('aria-atomic', 'true');

  await openRoute(page, 'Price import');
  await expect(page.locator('#price-import-status')).toHaveAttribute('aria-atomic', 'true');
  await expect(page.getByRole('button', { name: 'Delete price overlay' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete price overlay' })).toHaveAttribute('aria-describedby', 'delete-price-overlay-help');
});

test('financial tables and charts provide equivalent textual evidence', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Issuer evidence');
  const filingTable = page.getByRole('table', { name: 'SEC filings used as source evidence' });
  await expect(filingTable).toBeVisible();
  await expect(filingTable.locator('caption')).toHaveText('SEC filings used as source evidence');
  await expect(filingTable.getByRole('columnheader')).toHaveCount(5);

  await openRoute(page, 'Price import');
  await page.getByLabel('CSV import').check();
  await page.getByLabel('CSV file').setInputFiles({
    name: 'wcag-prices.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,110\n2025-03-14,120\n'),
  });
  await press(page.getByRole('button', { name: 'Create price preview', exact: true }));
  await press(page.getByRole('button', { name: 'Import price overlay', exact: true }));
  const dialog = page.getByRole('dialog', { name: 'Confirm price import' });
  await press(dialog.getByRole('button', { name: 'Import price overlay', exact: true }));
  await openRoute(page, 'Price analysis');

  const chart = page.getByRole('img', { name: 'Historical price line chart' });
  const values = page.getByRole('table', { name: 'Historical price observations' });
  await expect(chart).toBeVisible();
  await expect(chart.locator('desc')).toContainText('3 observations in USD');
  await expect(values.locator('caption')).toHaveText('Equivalent data table for the chart');
  await expect(values.getByRole('row')).toHaveCount(4);
  await expect(page.locator('#historical-price-chart-description')).toContainText('complete values table');
});

test('recovery actions are named by issue and reachable from the rendered UI', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Issuer search');
  await page.getByLabel('Ticker alias or CIK').fill('ALPHA');
  await press(page.getByRole('button', { name: 'Find issuer', exact: true }));

  const recovery = page.getByTestId('recovery-panel');
  await expect(recovery).toBeVisible();
  const action = recovery.getByRole('button', { name: /Select issuer by CIK for/u });
  await action.focus();
  await expect(action).toBeFocused();
  await action.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose the authoritative CIK' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'available in Issuer search' })).toBeVisible();
});
