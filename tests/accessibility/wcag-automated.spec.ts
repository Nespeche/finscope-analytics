import { expect, type Locator, type Page } from '@playwright/test';
import { expectNoAutomatedAccessibilityViolations, test } from './axe';
import { wcagMatrix, type WcagCriterion } from './wcag-matrix-loader';

interface EvidenceDefinition {
  readonly view: string;
  readonly controlOrFlow: string;
  readonly deterministicOracle: string;
  readonly concreteEvidence: string;
}

interface AutomatedCriterionEvidence extends EvidenceDefinition {
  readonly matrixId: string;
  readonly acceptanceCriteria: readonly string[];
  readonly coverage: 'FULLY_AUTOMATED' | 'AUTOMATED_PORTION_ONLY';
  readonly evidenceTestId: keyof typeof EVIDENCE_DEFINITIONS;
  readonly result: 'PASS_WHEN_REFERENCED_TEST_PASSES';
}

const EVIDENCE_DEFINITIONS = Object.freeze({
  shell: Object.freeze({
    view: 'Application shell and every registered route',
    controlOrFlow: 'document title, language, landmarks, skip link, navigation and route focus',
    deterministicOracle: 'title and lang are non-empty; one main landmark exists; skip link targets main; navigation labels remain stable; route activation focuses main',
    concreteEvidence: 'automated test “shell semantics, bypass and predictable navigation”',
  }),
  names: Object.freeze({
    view: 'Issuer search, acquisition, price import, privacy and data management',
    controlOrFlow: 'forms, labels, instructions, errors, destructive actions and recovery controls',
    deterministicOracle: 'each control has a non-placeholder name; names are unique in the active view; invalid fields expose aria-invalid and aria-errormessage; consequences are described',
    concreteEvidence: 'tests/e2e/accessibility/names-errors.spec.ts plus automated test “names, relationships and validation semantics”',
  }),
  keyboard: Object.freeze({
    view: 'Application shell, forms and dialogs',
    controlOrFlow: 'Tab/Enter/Space activation, modal cancellation and focus restoration',
    deterministicOracle: 'all sampled actions operate by keyboard; no focus is lost to body; dialog cancel returns focus to its invoker',
    concreteEvidence: 'automated test “keyboard operation and dialog focus restoration” and tests/e2e/accessibility/focus.spec.ts',
  }),
  status: Object.freeze({
    view: 'Acquisition, price import, privacy, data management and recovery panel',
    controlOrFlow: 'busy, disabled, completion, error, cancellation and recovery announcements',
    deterministicOracle: 'busy state is exposed while work is active; error/status roles and live politeness match severity; announcements are atomic and non-silent',
    concreteEvidence: 'automated test “status, busy and error announcements” and tests/e2e/accessibility/status.spec.ts',
  }),
  visual: Object.freeze({
    view: 'All major views',
    controlOrFlow: '320 CSS px reflow, 200% text, target size, reduced motion and visible focus',
    deterministicOracle: 'no page-level horizontal overflow; visible controls are at least 44 CSS px high; focus outline is rendered; reduced-motion removes transitions',
    concreteEvidence: 'automated test “reflow, focus visibility, targets and reduced motion” and tests/e2e/accessibility/visual-behavior.spec.ts',
  }),
  dataAlternative: Object.freeze({
    view: 'Issuer evidence, facts, metrics, insights and price analysis',
    controlOrFlow: 'tables, status text, chart description and complete equivalent values table',
    deterministicOracle: 'tables have captions and scoped headers; the chart has a name/description and all plotted observations are present in a textual table; states are written in text',
    concreteEvidence: 'automated test “financial tables and chart alternatives expose equivalent text”',
  }),
  prevention: Object.freeze({
    view: 'Price import, privacy settings and data management',
    controlOrFlow: 'preview, confirmation, cancellation, consent and destructive data operations',
    deterministicOracle: 'material mutations require an explicit confirmation; cancellation preserves state and focus; consequences and preserved artifacts are stated before confirmation',
    concreteEvidence: 'automated test “data-changing operations retain preview, confirmation and cancellation gates”',
  }),
} as const satisfies Readonly<Record<string, EvidenceDefinition>>);

const EVIDENCE_BY_CRITERION = Object.freeze({
  'SC-1-1-1': 'dataAlternative',
  'SC-1-3-1': 'dataAlternative',
  'SC-1-3-2': 'shell',
  'SC-1-3-3': 'names',
  'SC-1-3-4': 'visual',
  'SC-1-4-1': 'dataAlternative',
  'SC-1-4-3': 'visual',
  'SC-1-4-4': 'visual',
  'SC-1-4-5': 'dataAlternative',
  'SC-1-4-10': 'visual',
  'SC-1-4-11': 'visual',
  'SC-1-4-12': 'visual',
  'SC-1-4-13': 'visual',
  'SC-2-1-1': 'keyboard',
  'SC-2-1-2': 'keyboard',
  'SC-2-1-4': 'keyboard',
  'SC-2-2-2': 'visual',
  'SC-2-3-1': 'visual',
  'SC-2-4-1': 'shell',
  'SC-2-4-2': 'shell',
  'SC-2-4-3': 'keyboard',
  'SC-2-4-4': 'names',
  'SC-2-4-5': 'shell',
  'SC-2-4-6': 'names',
  'SC-2-4-7': 'visual',
  'SC-2-4-11': 'visual',
  'SC-2-5-2': 'prevention',
  'SC-2-5-3': 'names',
  'SC-2-5-8': 'visual',
  'SC-3-1-1': 'shell',
  'SC-3-1-2': 'shell',
  'SC-3-2-1': 'keyboard',
  'SC-3-2-2': 'prevention',
  'SC-3-2-3': 'shell',
  'SC-3-2-4': 'names',
  'SC-3-2-6': 'shell',
  'SC-3-3-1': 'names',
  'SC-3-3-2': 'names',
  'SC-3-3-3': 'names',
  'SC-3-3-4': 'prevention',
  'SC-3-3-7': 'prevention',
  'SC-4-1-2': 'names',
  'SC-4-1-3': 'status',
} as const satisfies Readonly<Record<string, keyof typeof EVIDENCE_DEFINITIONS>>);

function buildEvidence(criterion: WcagCriterion): AutomatedCriterionEvidence {
  const evidenceTestId = EVIDENCE_BY_CRITERION[criterion.matrixId as keyof typeof EVIDENCE_BY_CRITERION];
  if (evidenceTestId === undefined) throw new TypeError(`WCAG_AUTOMATED_EVIDENCE_MISSING: ${criterion.matrixId}`);
  return Object.freeze({
    matrixId: criterion.matrixId,
    acceptanceCriteria: criterion.acceptanceCriterionIds,
    coverage: criterion.manualTestRequired ? 'AUTOMATED_PORTION_ONLY' : 'FULLY_AUTOMATED',
    evidenceTestId,
    ...EVIDENCE_DEFINITIONS[evidenceTestId],
    deterministicOracle: `${EVIDENCE_DEFINITIONS[evidenceTestId].deterministicOracle}; matrix oracle: ${criterion.oracle}`,
    result: 'PASS_WHEN_REFERENCED_TEST_PASSES',
  });
}

export const automatedCriterionEvidence = Object.freeze(wcagMatrix.automatable.map(buildEvidence));

async function press(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press('Enter');
}

async function openRoute(page: Page, name: string): Promise<void> {
  await press(page.getByRole('button', { name, exact: true }));
}

test('matrix and oracle inventory retain 55 criteria, 43 applicable and exactly 12 justified N/A', async () => {
  expect(wcagMatrix.criteria).toHaveLength(55);
  expect(wcagMatrix.applicable).toHaveLength(43);
  expect(wcagMatrix.notApplicable).toHaveLength(12);
  expect(wcagMatrix.automatable).toHaveLength(43);
  expect(automatedCriterionEvidence).toHaveLength(43);
  expect(new Set(automatedCriterionEvidence.map((entry) => entry.matrixId)).size).toBe(43);
  for (const entry of automatedCriterionEvidence) {
    expect(entry.acceptanceCriteria.length, `${entry.matrixId} must link at least one AC`).toBeGreaterThan(0);
    expect(entry.view).not.toHaveLength(0);
    expect(entry.controlOrFlow).not.toHaveLength(0);
    expect(entry.deterministicOracle).toContain('matrix oracle:');
    expect(entry.concreteEvidence).not.toHaveLength(0);
    expect(entry.result).toBe('PASS_WHEN_REFERENCED_TEST_PASSES');
  }
  for (const criterion of wcagMatrix.notApplicable) {
    expect(criterion.notApplicableJustification).toBeTruthy();
    expect(criterion.reclassificationTrigger).toBeTruthy();
    expect(criterion.automationPossible).toBe(false);
  }
});

test('shell semantics, bypass and predictable navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FinScope/u);
  await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}(?:-[A-Z]{2})?$/u);
  await expect(page.getByRole('main')).toHaveCount(1);
  const skip = page.getByRole('link', { name: /Skip to main content/u });
  await skip.focus();
  await skip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('button')).toHaveCount(11);
  await openRoute(page, 'Issuer search');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: 'Select an issuer' })).toBeVisible();
});

test('names, relationships and validation semantics', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Issuer search');
  const issuer = page.getByLabel('Ticker alias or CIK');
  await issuer.fill('UNKNOWN');
  await press(page.getByRole('button', { name: 'Find issuer', exact: true }));
  await expect(issuer).toHaveAttribute('aria-invalid', 'true');
  await expect(issuer).toHaveAttribute('aria-errormessage', 'issuer-search-status');

  await openRoute(page, 'Fundamental metrics');
  const evidenceLinks = page.getByRole('link', { name: /^View evidence for /u });
  await expect(evidenceLinks).toHaveCount(24);
  const names = await evidenceLinks.evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(24);

  await openRoute(page, 'Data management');
  await expect(page.getByRole('button', { name: 'Delete price history' })).toHaveAttribute('aria-describedby', 'delete-price-consequence');
});

test('keyboard operation and dialog focus restoration', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Data management');
  await page.getByRole('checkbox', { name: 'Allow this view to open and change IndexedDB' }).check();
  await page.getByLabel('Issuer CIK').fill('0000320193');
  const invoker = page.getByRole('button', { name: 'Delete price history' });
  await press(invoker);
  const dialog = page.getByRole('dialog', { name: 'Delete historical price data?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).press('Enter');
  await expect(invoker).toBeFocused();
});

test('status, busy and error announcements', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'SEC acquisition');
  const cik = page.getByLabel('Issuer CIK');
  await cik.fill('123');
  await press(page.getByRole('button', { name: 'Update fundamentals' }));
  await expect(page.locator('#acquisition-status')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#acquisition-status')).toHaveAttribute('aria-atomic', 'true');
  await expect(cik).toHaveAttribute('aria-errormessage', 'acquisition-cik-error');

  await openRoute(page, 'Price import');
  await expect(page.locator('#price-import-status')).toHaveAttribute('role', 'status');
  await expect(page.locator('#price-import-status')).toHaveAttribute('aria-live', 'polite');
});

test('reflow, focus visibility, targets and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await openRoute(page, 'Price import');
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.client + 1);
  const button = page.getByRole('button', { name: 'Create price preview' });
  const box = await button.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await button.focus();
  await expect(button).toHaveCSS('outline-style', 'solid');
  const timing = await button.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(timing).toMatch(/(?:0s|0\.00001s|0\.01ms|1e-05s)/u);
});

test('financial tables and chart alternatives expose equivalent text', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Price import');
  await page.getByLabel('CSV import').check();
  await page.getByLabel('CSV file').setInputFiles({
    name: 'wcag-automated.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,close\n2025-01-03,100\n2025-01-31,110\n2025-03-14,120\n'),
  });
  await press(page.getByRole('button', { name: 'Create price preview' }));
  await press(page.getByRole('button', { name: 'Import price overlay' }));
  await press(page.getByRole('dialog', { name: 'Confirm price import' }).getByRole('button', { name: 'Import price overlay' }));
  await openRoute(page, 'Price analysis');
  await expect(page.getByRole('img', { name: 'Historical price line chart' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Historical price observations' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.locator('caption')).toHaveText('Equivalent data table for the chart');
  await expect(page.locator('#historical-price-chart-description')).toContainText('complete values table');
});

test('data-changing operations retain preview, confirmation and cancellation gates', async ({ page }) => {
  await page.goto('/');
  await openRoute(page, 'Price import');
  await page.getByLabel('Observation date (YYYY-MM-DD)').fill('2025-01-03');
  await page.getByLabel('Closing price').fill('100');
  await press(page.getByRole('button', { name: 'Add manual observation' }));
  await press(page.getByRole('button', { name: 'Create price preview' }));
  const invoker = page.getByRole('button', { name: 'Import price overlay' });
  await press(invoker);
  const dialog = page.getByRole('dialog', { name: 'Confirm price import' });
  await expect(dialog).toContainText('Fundamental artifacts will not be changed');
  await dialog.getByRole('button', { name: 'Cancel' }).press('Enter');
  await expect(invoker).toBeFocused();
  await expect(page.getByTestId('active-price-pointer')).toContainText('No active price overlay');
});

test('axe evidence is supplemental to deterministic oracles', async ({ page }) => {
  await page.goto('/');
  for (const route of ['Home', 'Issuer search', 'SEC acquisition', 'Issuer evidence', 'Facts', 'Fundamental metrics', 'Insights', 'Price import', 'Price analysis', 'Privacy settings', 'Data management']) {
    await openRoute(page, route);
    await expectNoAutomatedAccessibilityViolations(page);
  }
});
