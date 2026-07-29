import { expect } from '@playwright/test';
import { expectNoAutomatedAccessibilityViolations, test } from './axe';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const svelteUrl = '/@id/svelte';
    const buttonUrl = '/src/app/components/Button.svelte';
    const fieldUrl = '/src/app/components/Field.svelte';
    const dialogUrl = '/src/app/components/Dialog.svelte';
    const progressUrl = '/src/app/components/ProgressStatus.svelte';
    const [{ mount }, ButtonModule, FieldModule, DialogModule, ProgressModule] = await Promise.all([
      import(/* @vite-ignore */ svelteUrl),
      import(/* @vite-ignore */ buttonUrl),
      import(/* @vite-ignore */ fieldUrl),
      import(/* @vite-ignore */ dialogUrl),
      import(/* @vite-ignore */ progressUrl),
    ]);

    const host = document.createElement('section');
    host.id = 'primitive-testbed';
    host.setAttribute('aria-label', 'Primitive component testbed');
    document.body.append(host);

    const triggerTarget = document.createElement('div');
    const fieldTarget = document.createElement('div');
    const dialogTarget = document.createElement('div');
    const progressTarget = document.createElement('div');
    host.append(triggerTarget, fieldTarget, dialogTarget, progressTarget);

    const dialogProps = {
      id: 'delete-dialog',
      open: false,
      title: 'Delete local data',
      description: 'This removes local personal records.',
      confirmLabel: 'Delete data',
      cancelLabel: 'Keep data',
      destructive: true,
    };

    mount(ButtonModule.default, {
      target: triggerTarget,
      props: {
        label: 'Open delete confirmation',
        onclick: (): void => {
          dialogProps.open = true;
          mount(DialogModule.default, { target: dialogTarget, props: dialogProps });
        },
      },
    });
    mount(FieldModule.default, {
      target: fieldTarget,
      props: {
        id: 'issuer-cik',
        label: 'Issuer CIK',
        description: 'Enter the normalized ten-digit SEC identifier.',
        required: true,
        value: '',
      },
    });
    mount(ProgressModule.default, {
      target: progressTarget,
      props: {
        state: 'busy',
        message: 'Checking for new filings.',
        current: 1,
        total: 4,
        progressLabel: 'Fundamental refresh progress',
      },
    });
  });
});

test('primitives expose keyboard operation, names, live status and focus return', async ({ page }) => {
  const testbed = page.getByRole('region', { name: 'Primitive component testbed' });
  await expect(testbed).toBeVisible();

  const trigger = page.getByRole('button', { name: 'Open delete confirmation' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Delete local data' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep data' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Delete data: Delete local data' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  const field = page.getByRole('textbox', { name: 'Issuer CIK (required)' });
  await expect(field).toHaveAccessibleDescription('Enter the normalized ten-digit SEC identifier.');

  const status = page.locator('#primitive-testbed [role="status"]', { hasText: 'Checking for new filings.' });
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('progressbar', { name: 'Fundamental refresh progress' })).toBeVisible();

  await expectNoAutomatedAccessibilityViolations(page);
});
