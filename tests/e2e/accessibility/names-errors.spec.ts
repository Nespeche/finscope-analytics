import { expect, test, type Locator, type Page } from '@playwright/test';
const routes = ['Issuer search','SEC acquisition','Issuer evidence','Facts','Fundamental metrics','Insights','Price import','Price analysis','Privacy settings','Data management'] as const;
async function activate(page: Page, route: string): Promise<void> { await page.getByRole('button', { name: route, exact: true }).click(); await expect(page.getByRole('main')).toBeFocused(); }
async function controls(scope: Locator) { return scope.locator('button:visible,a:visible,input:visible,select:visible,textarea:visible').evaluateAll((nodes) => nodes.map((node) => {
  const element = node as HTMLElement; const id = element.id; const label = id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`) : null;
  const visible = (label?.textContent ?? element.closest('label')?.textContent ?? element.textContent ?? '').replace(/\s+/gu,' ').trim();
  return { key: `${element.tagName}:${(node as HTMLInputElement).type ?? ''}:${(element.getAttribute('aria-label') ?? element.getAttribute('title') ?? visible).toLowerCase()}`, name: element.getAttribute('aria-label') ?? element.getAttribute('title') ?? visible, visible, placeholder: (node as HTMLInputElement).placeholder ?? '' };
})); }

test('all functional views use explicit non-placeholder, unambiguous control names', async ({ page }) => {
  await page.goto('/');
  for (const route of routes) { await activate(page, route); const seen = new Set<string>(); for (const item of await controls(page.getByRole('main'))) { expect(item.name, route).not.toBe(''); if (item.placeholder) { expect(item.visible).not.toBe(''); expect(item.name).not.toBe(item.placeholder); } expect(seen.has(item.key), `${route}: ${item.name}`).toBe(false); seen.add(item.key); } }
});

test('errors identify fields, explain corrections and use one live source', async ({ page }) => {
  await page.goto('/'); await activate(page, 'Issuer search');
  const issuer = page.getByLabel('Ticker alias or CIK'); await issuer.fill('UNKNOWN'); await page.getByRole('button', { name: 'Find issuer' }).click();
  await expect(issuer).toHaveAttribute('aria-invalid','true'); await expect(issuer).toHaveAttribute('aria-errormessage','issuer-search-status'); await expect(page.locator('#issuer-search-status')).toContainText('zero-padded');
  await activate(page,'SEC acquisition'); const cik = page.getByLabel('Issuer CIK'); await cik.fill('123'); await page.getByRole('button',{name:'Update fundamentals'}).click();
  await expect(cik).toHaveAttribute('aria-invalid','true'); await expect(cik).toHaveAttribute('aria-errormessage','acquisition-status'); await expect(page.locator('#acquisition-status')).toContainText('ten digits');
  await activate(page,'Price import'); await page.getByRole('button',{name:'Create price preview'}).click();
  await expect(page.getByLabel('Observation date (YYYY-MM-DD)')).toHaveAttribute('aria-invalid','true'); await expect(page.locator('#price-import-status')).toHaveAttribute('role','alert');
  await activate(page,'Data management'); await page.getByRole('checkbox',{name:'Allow this view to open and change IndexedDB'}).check();
  const deleteCik = page.getByLabel('Issuer CIK for price-history deletion'); await deleteCik.fill('123'); await page.getByRole('button',{name:'Delete price history'}).click();
  await expect(deleteCik).toHaveAttribute('aria-invalid','true'); await expect(deleteCik).toHaveAttribute('aria-errormessage','price-delete-cik-error');
});

test('states, consequences, tables and graphic alternatives remain explicit', async ({ page }) => {
  await page.goto('/'); await activate(page,'Facts'); await expect(page.getByText('Fact state: normalized and available.')).toBeVisible(); await expect(page.getByText('Fact state: unavailable.')).toBeVisible();
  await activate(page,'Fundamental metrics'); await expect(page.locator('[data-metric-state]')).toHaveCount(24); await expect(page.getByRole('link',{name:'View evidence for Revenue'})).toBeVisible();
  await activate(page,'Insights'); await expect(page.getByText('Outcome: positive').first()).toBeVisible(); await expect(page.getByText('Outcome: not evaluable').first()).toBeVisible();
  await activate(page,'Issuer evidence'); await expect(page.getByRole('table',{name:'SEC filings used as source evidence'})).toContainText('partial');
  await activate(page,'Data management'); await expect(page.locator('#price-delete-consequence')).toContainText('confirmation dialog');
});

test('recovery actions are keyboard reachable and focus the exact target', async ({ page }) => {
  await page.goto('/'); await activate(page,'Issuer search'); await page.getByLabel('Ticker alias or CIK').fill('ALPHA'); await page.getByRole('button',{name:'Find issuer'}).click();
  const panel = page.getByTestId('recovery-panel'); const action = panel.getByRole('button',{name:/Select issuer by CIK for Identity Ambiguous/u}); await action.focus(); await action.press('Enter');
  const heading = page.getByRole('heading',{name:'Choose the authoritative CIK'}); await expect(heading).toBeFocused(); await expect(panel.getByRole('status')).toContainText('available in Issuer search');
});
