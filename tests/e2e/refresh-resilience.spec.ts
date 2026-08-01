import { expect, test } from '@playwright/test';

test('retry exhaustion preserves the last valid snapshot, capabilities and pointer', async ({ page }) => {
  let submissionsRequests = 0;
  await page.route('**/issuers/0000320193/submissions', async (route) => {
    submissionsRequests += 1;
    await route.fulfill({
      status: 503,
      headers: { 'Retry-After': '0' },
      contentType: 'application/problem+json',
      body: JSON.stringify({ code: 'provider_unavailable' }),
    });
  });

  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Allow open, resume, and manual SEC refreshes' }).check();
  await page.getByTestId('refresh-fundamentals-button').click();

  await expect(page.getByTestId('refresh-state')).toHaveText('partial');
  expect(submissionsRequests).toBe(3);
  await expect(page.getByTestId('active-snapshot-id')).toHaveText('snapshot-0000320193-active');
  await expect(page.getByTestId('active-pointer-generation')).toHaveText('1');

  const runtime = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime } = await import(/* @vite-ignore */ moduleUrl);
    return refreshRuntime.snapshot();
  });
  expect(runtime.lastReasonCode).toBe('retry_exhausted');
  expect(runtime.candidateCount).toBe(0);
  expect(runtime.quota?.externalCallCount).toBe(3);
  expect(runtime.quota?.externalCallCount).toBeLessThanOrEqual(14);
  expect(runtime.blockedOperations).toEqual(['acquisition']);
  expect(runtime.preservedCapabilities).toEqual([
    'issuer_identity',
    'local_snapshot',
    'definitions',
    'mappings',
    'evidence',
  ]);
});

test('dependency invalidation is scoped and visual events start zero domain work', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/app/lifecycle/resume-refresh.ts';
    const { refreshRuntime, VISUAL_PREFERENCE_EVENT } = await import(/* @vite-ignore */ moduleUrl);
    refreshRuntime.resetForTesting();
    const beforeCalls = refreshRuntime.snapshot().networkCallCount;
    const filing = refreshRuntime.processInvalidation({ event: 'new_filing_detected' });
    const mapping = refreshRuntime.processInvalidation({
      event: 'mapping_version_changed',
      changedConceptIds: ['Revenue'],
      dependencies: {
        conceptToMetrics: { Revenue: ['revenue_growth'] },
        metricToRules: { revenue_growth: ['growth_rule'] },
      },
    });
    const metric = refreshRuntime.processInvalidation({
      event: 'metric_definition_changed',
      changedMetricIds: ['gross_margin'],
      dependencies: { metricToRules: { gross_margin: ['margin_rule'] } },
    });
    const rule = refreshRuntime.processInvalidation({
      event: 'insight_rule_changed',
      changedRuleIds: ['quality_rule'],
    });
    window.dispatchEvent(new Event(VISUAL_PREFERENCE_EVENT));
    const after = refreshRuntime.snapshot();
    return { beforeCalls, filing, mapping, metric, rule, after };
  });

  expect(result.filing.affectedStages).toEqual([
    'sec_acquisition',
    'normalization',
    'fundamental_metrics',
    'rules',
    'synthesis',
    'fundamental_persistence',
  ]);
  expect(result.mapping.affectedMetricIds).toEqual(['revenue_growth']);
  expect(result.mapping.affectedRuleIds).toEqual(['growth_rule']);
  expect(result.mapping.affectedStages).not.toContain('price_overlay');
  expect(result.metric.affectedStages).not.toContain('sec_acquisition');
  expect(result.rule.affectedStages).toEqual(['rules', 'synthesis', 'fundamental_persistence']);
  expect(result.after.lastInvalidationPlan?.event).toBe('visual_preference_changed');
  expect(result.after.lastInvalidationPlan?.domainWorkStarted).toBe(false);
  expect(result.after.lastInvalidationPlan?.networkWorkStarted).toBe(false);
  expect(result.after.networkCallCount).toBe(result.beforeCalls);
});
