import { expect, test } from '@playwright/test';

const pipelineStates = [
  ['idle', false, false],
  ['checking', true, false],
  ['acquiring', true, false],
  ['normalizing', true, false],
  ['analyzing', true, false],
  ['ready', false, false],
  ['partial', false, false],
  ['failed', false, true],
  ['cancelled', false, true],
] as const;

test('pipeline status semantics and live announcements are exact and non-duplicated', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const control = document.createElement('button');
    control.type = 'button';
    control.dataset['testid'] = 'pipeline-test-control';
    control.textContent = 'Pipeline test control';
    document.body.append(control);
  });

  const control = page.getByTestId('pipeline-test-control');
  for (const [state, busy, disabled] of pipelineStates) {
    const message = `Pipeline state ${state}.`;
    await page.evaluate(({ nextState, nextMessage }) => {
      window.dispatchEvent(new CustomEvent('finscope:pipeline-state', {
        detail: {
          state: nextState,
          message: nextMessage,
          controlSelector: '[data-testid="pipeline-test-control"]',
        },
      }));
    }, { nextState: state, nextMessage: message });

    if (busy) await expect(control).toHaveAttribute('aria-busy', 'true');
    else await expect(control).not.toHaveAttribute('aria-busy');
    if (disabled) await expect(control).toHaveAttribute('aria-disabled', 'true');
    else await expect(control).not.toHaveAttribute('aria-disabled');

    const announcer = disabled
      ? page.getByTestId('a11y-assertive-announcer')
      : page.getByTestId('a11y-polite-announcer');
    await expect(announcer).toHaveText(message);
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('finscope:pipeline-state', {
      detail: {
        state: 'ready',
        message: 'Ready without duplicate announcement.',
        controlSelector: '[data-testid="pipeline-test-control"]',
      },
    }));
    window.dispatchEvent(new CustomEvent('finscope:pipeline-state', {
      detail: {
        state: 'ready',
        message: 'Ready without duplicate announcement.',
        controlSelector: '[data-testid="pipeline-test-control"]',
      },
    }));
  });
  await expect(page.getByTestId('a11y-polite-announcer')).toHaveCount(1);
  await expect(page.getByTestId('a11y-polite-announcer')).toHaveText('Ready without duplicate announcement.');
});

test('cancellation is announced accurately and preserves recovery semantics', async ({ page }) => {
  let releaseSubmissions: (() => void) | undefined;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    await new Promise<void>((resolve) => { releaseSubmissions = resolve; });
    try {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    } catch {
      // Cancellation aborts the request.
    }
  });

  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Allow open, resume, and manual SEC refreshes' }).check();
  await page.getByTestId('refresh-fundamentals-button').click();
  await expect(page.getByTestId('refresh-state')).toHaveText('acquiring');
  await page.getByTestId('cancel-refresh-button').click();
  releaseSubmissions?.();

  await expect(page.getByTestId('refresh-state')).toHaveText('cancelled');
  await expect(page.getByTestId('a11y-assertive-announcer')).toContainText('previous active snapshot and pointer were preserved');
  await expect(page.getByRole('button', { name: 'Restart refresh' })).toBeFocused();
});
