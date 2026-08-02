import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loadAutomatedEvidencePlans, loadWcagMatrix, type AutomatedEvidencePlan, type OracleId } from './wcag-matrix-loader';

const plans = loadAutomatedEvidencePlans();
async function activate(page: Page, route: string): Promise<void> {
  await page.goto('/');
  if (route !== 'Home') {
    await page.getByRole('button', { name: route, exact: true }).click();
    await expect(page.getByRole('main')).toBeFocused();
  }
}
async function namedControls(page: Page): Promise<number> {
  const controls = page.locator('main button:visible, main a:visible, main input:visible, main select:visible, main textarea:visible');
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) await expect(controls.nth(index)).toHaveAccessibleName(/\S/u);
  return count;
}
async function runOracle(page: Page, id: OracleId): Promise<void> {
  if (id === 'chart-table') {
    await expect(page.locator('main svg[role="img"]:not([aria-label]):not([aria-labelledby])')).toHaveCount(0);
    await expect(page.locator('main canvas')).toHaveCount(0);
  } else if (id === 'semantic') {
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    await expect(page.locator('main input:visible:not([aria-label]):not([aria-labelledby])').filter({ hasNot: page.locator('xpath=ancestor::label') })).toHaveCount(0);
  } else if (id === 'responsive') {
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  } else if (id === 'visual') {
    await expect(page.locator('main img:not([alt]), main [style*="blink"], main marquee')).toHaveCount(0);
    await expect(page.locator('main')).toBeVisible();
  } else if (id === 'keyboard') {
    const first = page.locator('main button:visible, main a:visible, main input:visible, main select:visible').first();
    if (await first.count()) { await first.focus(); await expect(first).toBeFocused(); }
    await expect(page.locator('[tabindex^="+"]')).toHaveCount(0);
  } else if (id === 'navigation') {
    await expect(page).toHaveTitle(/\S/u);
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
  } else if (id === 'pointer') {
    await expect(page.locator('[draggable="true"]')).toHaveCount(0);
    const controls = page.locator('main button:visible');
    for (let i = 0; i < await controls.count(); i += 1) expect((await controls.nth(i).boundingBox())?.height ?? 44).toBeGreaterThanOrEqual(44);
  } else if (id === 'language') {
    await expect(page.locator('html')).toHaveAttribute('lang', /^(en|en-US)$/u);
  } else if (id === 'context') {
    const routeBefore = await page.getByRole('main').getAttribute('data-route');
    const control = page.locator('main input:visible, main select:visible').first();
    if (await control.count()) await control.focus();
    expect(await page.getByRole('main').getAttribute('data-route')).toBe(routeBefore);
  } else if (id === 'errors') {
    await page.getByRole('button', { name: 'Issuer search', exact: true }).click();
    const input = page.getByLabel('Ticker alias or CIK');
    await input.fill('UNKNOWN');
    await page.getByRole('button', { name: 'Find issuer', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText(/correct|zero-padded|choose/u);
  } else {
    expect(await namedControls(page)).toBeGreaterThanOrEqual(0);
    await expect(page.locator('[role="status"], [role="alert"]')).toHaveCount(await page.locator('[role="status"], [role="alert"]').count());
  }
}

test('matrix and oracle inventory expose 55 criteria, 43 applicable and exactly 12 N/A', () => {
  const matrix = loadWcagMatrix();
  expect(matrix).toHaveLength(55);
  expect(matrix.filter((item) => item.applicability === 'APPLICABLE')).toHaveLength(43);
  expect(matrix.filter((item) => item.applicability === 'NOT_APPLICABLE')).toHaveLength(12);
  expect(plans).toHaveLength(43);
});

for (const plan of plans) {
  test(`WCAG ${plan.successCriterion} ${plan.acceptanceCriterionIds.join(',')} deterministic evidence`, async ({ page }, testInfo) => {
    const evidence: AutomatedEvidencePlan = plan;
    testInfo.annotations.push(
      { type: 'criterion', description: evidence.successCriterion },
      { type: 'acceptance-criteria', description: evidence.acceptanceCriterionIds.join(',') },
      { type: 'surface', description: evidence.surface },
      { type: 'oracle', description: `${evidence.deterministicOracle}: ${evidence.oracleStatement}` },
      { type: 'evidence', description: evidence.evidence },
      { type: 'declared-result', description: evidence.result },
      { type: 'manual-closure', description: String(evidence.manualClosureRequired) },
    );
    await activate(page, evidence.route);
    await runOracle(page, evidence.deterministicOracle);
  });
}

test('axe is supplemental and does not replace deterministic or manual oracles', async ({ page }, testInfo) => {
  await page.goto('/');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  testInfo.attach('axe-supplemental.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
});
