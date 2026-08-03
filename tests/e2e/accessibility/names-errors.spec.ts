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

test('selected issuer context propagates to price import and price analysis', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Issuer search');
  await page.getByLabel('Ticker alias or CIK').fill('ALPHA');
  await page.getByRole('button', { name: 'Find issuer', exact: true }).click();
  await page.getByRole('button', { name: 'Select Alphabet Inc., CIK 0001652044', exact: true }).click();

  const selectedContext = page.getByRole('complementary', { name: 'Active issuer context' });
  await expect(selectedContext).toContainText('Alphabet Inc.');
  await expect(selectedContext).toContainText('0001652044');

  await activateRoute(page, 'Price import');
  const importContext = page.getByRole('complementary', { name: 'Active fundamental context' });
  await expect(importContext).toContainText('Alphabet Inc.');
  await expect(importContext).toContainText('0001652044');
  await expect(importContext).toContainText('GOOGL');
  await expect(importContext).not.toContainText('Apple Inc.');
  await expect(importContext).not.toContainText('0000320193');

  await activateRoute(page, 'Price analysis');
  const analysisContext = page.getByRole('complementary', { name: 'Fundamental context remains visible' });
  await expect(analysisContext).toContainText('Alphabet Inc.');
  await expect(analysisContext).toContainText('0001652044');
  await expect(analysisContext).not.toContainText('Apple Inc.');
  await expect(analysisContext).not.toContainText('0000320193');
});

test('correcting a Data Management CIK clears the stale field and live-region error', async ({ page }) => {
  await page.goto('/');
  await activateRoute(page, 'Data management');
  await page.getByLabel(/Allow this view to open and change IndexedDB/u).check();

  const cik = page.locator('#price-delete-cik');
  const status = page.getByTestId('data-management-status');
  await cik.fill('12');
  await page.getByRole('button', { name: 'Delete price history', exact: true }).click();
  await expect(cik).toHaveAttribute('aria-invalid', 'true');
  await expect(cik).toHaveAttribute('aria-errormessage', 'price-delete-cik-error');
  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).toContainText('invalid');

  await cik.fill('0000320193');
  await expect(cik).not.toHaveAttribute('aria-invalid');
  await expect(cik).not.toHaveAttribute('aria-errormessage');
  await expect(page.locator('#price-delete-cik-error')).toHaveCount(0);
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).not.toContainText('invalid');

  const invoker = page.getByRole('button', { name: 'Delete price history', exact: true });
  await invoker.click();
  const dialog = page.getByRole('dialog', { name: 'Delete historical price data?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(invoker).toBeFocused();
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).not.toContainText('invalid');
});

test('320 CSS px reflow has no effective page-level horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  for (const route of ['Home', ...routes]) {
    if (route !== 'Home') await activateRoute(page, route);
    const result = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const root = document.documentElement;
      const body = document.body;
      const scrollingElement = document.scrollingElement;
      const initialScrollLeft = scrollingElement?.scrollLeft ?? 0;
      if (scrollingElement !== null) scrollingElement.scrollLeft = 999;
      const effectiveScrollLeft = scrollingElement?.scrollLeft ?? 0;
      if (scrollingElement !== null) scrollingElement.scrollLeft = initialScrollLeft;

      function hasLocalHorizontalScroll(element: HTMLElement): boolean {
        let ancestor = element.parentElement;
        while (ancestor !== null && ancestor !== body) {
          const style = getComputedStyle(ancestor);
          if (
            (style.overflowX === 'auto' || style.overflowX === 'scroll')
            && ancestor.scrollWidth > ancestor.clientWidth + 1
          ) return true;
          ancestor = ancestor.parentElement;
        }
        return false;
      }

      const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.position !== 'fixed'
            && style.clipPath === 'none'
            && rect.width > 1
            && rect.height > 1
            && (rect.left < -1 || rect.right > viewportWidth + 1)
            && !hasLocalHorizontalScroll(element);
        })
        .slice(0, 20)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            id: element.id,
            className: element.className,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        });

      return {
        viewportWidth,
        clientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        bodyScrollWidth: body.scrollWidth,
        effectiveScrollLeft,
        offenders,
      };
    });

    expect(result.rootScrollWidth, `${route}: document must fit the 320px viewport`).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.bodyScrollWidth, `${route}: body must fit the 320px viewport`).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.effectiveScrollLeft, `${route}: page-level horizontal scroll must not be effective`).toBe(0);
    expect(result.offenders, `${route}: no visible element may escape the viewport outside a local scroll region`).toEqual([]);
  }
});
