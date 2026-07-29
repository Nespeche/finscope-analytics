import { expect, test } from '@playwright/test';

test('refresh consent defaults false and prevents lifecycle network requests', async ({ page }) => {
  let probeRequests = 0;
  await page.route('**/consent-network-probe', async (route) => {
    probeRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/persistence/consent-repository.ts';
    const { createConsentRepository } = await import(/* @vite-ignore */ moduleUrl);
    const repository = createConsentRepository();

    const before = repository.snapshot();
    const localOnly = await repository.runLifecycleRefresh(async () => {
      const response = await fetch('/consent-network-probe');
      return response.status;
    });
    const memoryOnly = await repository.runPersistentWrite(() => 'persisted');

    repository.grantRefreshConsent();
    const refreshed = await repository.runLifecycleRefresh(async () => {
      const response = await fetch('/consent-network-probe');
      return response.status;
    });

    return { before, localOnly, memoryOnly, refreshed };
  });

  expect(result.before).toEqual({
    refreshConsent: { kind: 'refreshConsent', granted: false, revision: 0 },
    storageConsent: { kind: 'storageConsent', granted: false, revision: 0 },
  });
  expect(result.localOnly.mode).toBe('local_only');
  expect(result.localOnly.value).toBeUndefined();
  expect(result.memoryOnly.mode).toBe('memory_only');
  expect(result.memoryOnly.value).toBeUndefined();
  expect(result.refreshed).toEqual({ mode: 'refreshed', value: 200 });
  expect(probeRequests).toBe(1);
});
