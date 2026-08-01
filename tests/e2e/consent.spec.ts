import { expect, test, type Locator } from '@playwright/test';

async function activate(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press('Enter');
}

async function toggle(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  await control.press('Space');
}

test('privacy settings keep refresh and storage consent independent and revocable', async ({ page }) => {
  let probeRequests = 0;
  await page.route('**/consent-network-probe', async (route) => {
    probeRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await activate(page.getByRole('button', { name: 'Privacy settings' }));

  const refreshConsent = page.getByRole('checkbox', { name: 'Allow explicit refresh requests' });
  const storageConsent = page.getByRole('checkbox', { name: 'Save confirmed analysis on this device' });
  const status = page.getByTestId('privacy-status');

  await expect(refreshConsent).not.toBeChecked();
  await expect(storageConsent).not.toBeChecked();

  await activate(page.getByRole('button', { name: 'Check for updates' }));
  await expect(status).toContainText('zero network requests');
  expect(probeRequests).toBe(0);

  await activate(page.getByRole('button', { name: 'Run local analysis' }));
  await expect(status).toContainText('memory only');
  expect(probeRequests).toBe(0);

  await toggle(storageConsent);
  await expect(storageConsent).toBeFocused();
  await expect(storageConsent).toBeChecked();
  await expect(refreshConsent).not.toBeChecked();
  await activate(page.getByRole('button', { name: 'Run local analysis' }));
  await expect(status).toContainText('saved locally');
  expect(probeRequests).toBe(0);

  await toggle(refreshConsent);
  await expect(refreshConsent).toBeFocused();
  await expect(refreshConsent).toBeChecked();
  await activate(page.getByRole('button', { name: 'Check for updates' }));
  await expect(status).toContainText('Refresh completed');
  expect(probeRequests).toBe(1);

  await activate(page.getByRole('button', { name: 'Revoke refresh consent' }));
  await expect(refreshConsent).not.toBeChecked();
  await expect(refreshConsent).toBeFocused();
  await activate(page.getByRole('button', { name: 'Check for updates' }));
  await expect(status).toContainText('zero network requests');
  expect(probeRequests).toBe(1);

  await activate(page.getByRole('button', { name: 'Revoke storage consent' }));
  await expect(storageConsent).not.toBeChecked();
  await expect(storageConsent).toBeFocused();
  await activate(page.getByRole('button', { name: 'Run local analysis' }));
  await expect(status).toContainText('memory only');
});
