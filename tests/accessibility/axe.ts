import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test as base,
  type Page,
} from '@playwright/test';

export const WCAG_22_AA_AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21aa',
  'wcag22aa',
] as const;

export const MANUAL_WCAG_22_AA_CHECKS = [
  'Complete keyboard operation, including logical focus order and visible focus.',
  'Screen-reader names, roles, relationships, status announcements and reading order.',
  'Meaning remains available without color, motion, pointer precision or hover.',
  'Desktop and mobile reflow, zoom and text-spacing behavior at target viewports.',
  'Financial tables, charts, validation errors and destructive confirmations retain equivalent text.',
] as const;

interface BrowserErrorFixtures {
  readonly strictBrowserErrors: readonly string[];
}

export const test = base.extend<BrowserErrorFixtures>({
  strictBrowserErrors: [
    async ({ page }, use): Promise<void> => {
      const errors: string[] = [];
      page.on('pageerror', (error): void => {
        errors.push(`pageerror: ${error.message}`);
      });
      page.on('console', (message): void => {
        if (message.type() === 'error') {
          errors.push(`console.error: ${message.text()}`);
        }
      });

      await use(errors);
      expect(errors, 'Unexpected page or console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export async function analyzeAccessibility(
  page: Page,
): Promise<Awaited<ReturnType<AxeBuilder['analyze']>>> {
  return new AxeBuilder({ page })
    .withTags([...WCAG_22_AA_AXE_TAGS])
    .analyze();
}

export async function expectNoAutomatedAccessibilityViolations(page: Page): Promise<void> {
  const results = await analyzeAccessibility(page);
  expect(results.violations, 'Automated axe violations').toEqual([]);
}
