import { expect, test } from '@playwright/test';

test('route changes focus the main landmark and ambiguous identity focuses its alert', async ({ page }) => {
  await page.goto('/');
  const issuerRoute = page.getByRole('button', { name: 'Issuer search' });
  await issuerRoute.focus();
  await issuerRoute.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await page.getByLabel('Ticker alias or CIK').fill('ALPHA');
  const findIssuer = page.getByRole('button', { name: 'Find issuer' });
  await findIssuer.focus();
  await findIssuer.press('Enter');
  const alert = page.getByRole('alert').filter({ hasText: 'More than one issuer matches' });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(alert).toHaveCSS('outline-style', 'solid');

  const recovery = page.getByTestId('recovery-panel');
  await expect(recovery).toContainText('Select issuer by CIK');
  const action = recovery.getByRole('button', { name: 'Select issuer by CIK' });
  await action.focus();
  await action.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose the authoritative CIK' })).toBeVisible();
});

test('dialog cancellation returns focus to its invoker', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Data management' }).click();
  await page.getByRole('checkbox', { name: 'Allow this view to open and change IndexedDB' }).check();
  await page.getByLabel('Issuer CIK').fill('0000320193');

  const invoker = page.getByRole('button', { name: 'Delete price history' });
  await invoker.focus();
  await invoker.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Delete historical price data?' });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeFocused();
  await cancel.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(invoker).toBeFocused();
});
