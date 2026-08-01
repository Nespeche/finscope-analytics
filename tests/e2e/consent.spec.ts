import { expect, test } from '@playwright/test';

test('privacy settings keep refresh and storage consent independent and revocable', async ({ page }) => {
  let probeRequests = 0;
  await page.route('**/consent-network-probe', async (route) => {
    probeRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Privacy settings' }).click();

  const refreshConsent = page.getByRole('checkbox', { name: 'Allow explicit refresh requests' });
  const storageConsent = page.getByRole('checkbox', { name: 'Save confirmed analysis on this device' });
  const status = page.getByTestId('privacy-status');

  await expect(refreshConsent).not.toBeChecked();
  await expect(storageConsent).not.toBeChecked();

  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(status).toContainText('zero network requests');
  expect(probeRequests).toBe(0);

  await page.getByRole('button', { name: 'Run local analysis' }).click();
  await expect(status).toContainText('memory only');
  expect(probeRequests).toBe(0);

  await storageConsent.check();
  await expect(storageConsent).toBeFocused();
  await expect(refreshConsent).not.toBeChecked();
  await page.getByRole('button', { name: 'Run local analysis' }).click();
  await expect(status).toContainText('saved locally');
  expect(probeRequests).toBe(0);

  await refreshConsent.check();
  await expect(refreshConsent).toBeFocused();
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(status).toContainText('Refresh completed');
  expect(probeRequests).toBe(1);

  await page.getByRole('button', { name: 'Revoke refresh consent' }).click();
  await expect(refreshConsent).not.toBeChecked();
  await expect(refreshConsent).toBeFocused();
  await page.getByRole('button', { name: 'Check for updates' }).click();
  expect(probeRequests).toBe(1);

  await page.getByRole('button', { name: 'Revoke storage consent' }).click();
  await expect(storageConsent).not.toBeChecked();
  await expect(storageConsent).toBeFocused();
  await page.getByRole('button', { name: 'Run local analysis' }).click();
  await expect(status).toContainText('memory only');
});
