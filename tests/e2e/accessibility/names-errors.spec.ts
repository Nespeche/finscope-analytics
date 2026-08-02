import { expect, test, type Page } from '@playwright/test';

async function activateRoute(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
}

async function auditAccessibleNames(page: Page, route: string): Promise<void> {
  const controls = await page.locator('button, input, select, textarea, a[href]').evaluateAll((elements) => elements
    .filter((control) => {
      if (!(control instanceof HTMLElement)) return false;
      if (control.closest('[hidden], [aria-hidden="true"]') !== null) return false;
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
    })
    .map((control) => {
      const labels = control instanceof HTMLElement && control.labels !== undefined
        ? Array.from(control.labels).map((label) => label.textContent ?? '').join(' ')
        : '';
      const labelledby = control.getAttribute('aria-labelledby')?.split(/\s+/u).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') ?? '';
      const text = [control.getAttribute('aria-label'), labelledby, labels, control.textContent, control.getAttribute('title')]
        .filter((value): value is string => value !== null && value !== undefined)
        .join(' ')
        .replace(/\s+/gu, ' ')
        .trim();
      return { tag: control.tagName, name: text, type: control.getAttribute('type') ?? '' };
    })
    .filter((control) => control.type !== 'hidden'));

  for (const control of controls) {
    expect(control.name, `${route}: ${control.tag} must expose a non-empty accessible name`).not.toBe('');
  }

  const actionable = controls.filter((control) => control.tag === 'BUTTON' || control.tag === 'A');
  const names = actionable.map((control) => control.name);
  expect(new Set(names).size, `${route}: action names must be unique in the currently exposed interface`).toBe(names.length);
}

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
];

test('cross-cutting controls expose visible labels and unique action names', async ({ page }) => {
  await page.goto('/');
  for (const route of routes) {
    await activateRoute(page, route);
    await auditAccessibleNames(page, route);
  }
});

test('issuer search and acquisition errors are programmatically associated and announced', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Issuer search');
  const issuer = page.getByLabel('Ticker alias or CIK');
  await issuer.fill('UNKNOWN');
  await page.getByRole('button', { name: 'Find issuer' }).click();
  await expect(issuer).toHaveAttribute('aria-invalid', 'true');
  await expect(issuer).toHaveAttribute('aria-errormessage', 'issuer-search-status');
  await expect(page.locator('#issuer-search-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#issuer-search-status')).toContainText('No issuer matched');

  await activateRoute(page, 'SEC acquisition');
  const cik = page.getByLabel('Issuer CIK');
  await cik.fill('123');
  await page.getByRole('button', { name: 'Update fundamentals' }).click();
  await expect(cik).toHaveAttribute('aria-invalid', 'true');
  await expect(cik).toHaveAttribute('aria-errormessage', 'acquisition-cik-error');
  await expect(page.locator('#acquisition-cik-error')).toHaveAttribute('role', 'alert');
});

test('price import fields and CSV validation expose deterministic error associations', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Price import');
  const date = page.getByLabel('Observation date (YYYY-MM-DD)');
  const price = page.getByLabel('Closing price');
  await date.fill('2025-02-30');
  await price.fill('-1');
  await page.getByRole('button', { name: 'Add manual observation' }).click();
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(date).toHaveAttribute('aria-describedby', /manual-price-date-error/u);
  await expect(price).toHaveAttribute('aria-invalid', 'true');
  await expect(price).toHaveAttribute('aria-describedby', /manual-price-value-error/u);
  await expect(page.locator('#manual-price-date-error')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#manual-price-value-error')).toHaveAttribute('role', 'alert');

  await page.getByLabel('CSV import').check();
  const file = page.getByLabel('CSV file');
  await file.setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('wrong,columns\n1,2\n') });
  await expect(file).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#historical-price-csv-error')).toHaveAttribute('role', 'alert');
});

test('data management declares destructive consequences, CIK errors and busy status', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Data management');
  await expect(page.getByRole('heading', { name: 'Data management' })).toBeVisible();
  const cik = page.locator('#price-delete-cik');
  await expect(cik).toBeVisible();
  await expect(page.locator('label[for="price-delete-cik"]')).toHaveText('Issuer CIK');
  await cik.fill('123');
  await page.getByLabel(/Allow this view to open and change IndexedDB/u).check();
  await page.getByRole('button', { name: 'Delete price history' }).click();
  await expect(cik).toHaveAttribute('aria-invalid', 'true');
  await expect(cik).toHaveAttribute('aria-errormessage', 'price-delete-cik-error');
  await expect(page.locator('#price-delete-cik-error')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#delete-price-consequence')).toContainText('Preserved');
  await expect(page.locator('#delete-all-consequence')).toContainText('permanently removes');
  await expect(page.getByRole('region', { name: 'Data management' })).toHaveAttribute('aria-busy', 'false');
});

test('fact lineage, optional-price states and recovery actions expose equivalent text and reachable names', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Facts');
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Raw SEC fact');
  await expect(page.locator('[data-fact-state="normalized"]')).toContainText('Normalized fact');
  await expect(page.locator('[data-fact-state="unavailable"]')).toContainText('Unavailable');

  await activateRoute(page, 'Price analysis');
  await expect(page.getByRole('heading', { name: 'Historical price analysis' })).toBeVisible();
  await expect(page.getByTestId('fundamental-only-status')).toContainText('remains complete');
  await expect(page.getByRole('heading', { name: 'No active price overlay' })).toBeVisible();
  await expect(page.getByText('Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.', { exact: true })).toBeVisible();

  await activateRoute(page, 'Data management');
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('finscope:recovery-issue', {
      detail: {
        code: 'repository_corruption',
        message: 'Corrupted records are quarantined and excluded from active data and exports.',
      },
    }));
  });
  const recovery = page.getByRole('region', { name: 'Recovery options' });
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('Local repository corruption');
  const recoveryButtons = recovery.getByRole('button');
  await expect(recoveryButtons).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(recoveryButtons.nth(index)).toHaveAccessibleName(/for Local repository corruption/u);
  }
});
