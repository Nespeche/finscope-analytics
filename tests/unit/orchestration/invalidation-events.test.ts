import { describe, expect, it } from 'vitest';
import { buildInvalidationPlan } from '../../../src/domain/orchestration/invalidation-graph';

const dependencies = Object.freeze({
  conceptToMetrics: Object.freeze({ revenue: Object.freeze(['FND_REVENUE', 'FND_GROSS_MARGIN']) }),
  metricToMetrics: Object.freeze({ FND_REVENUE: Object.freeze(['FND_REVENUE_GROWTH']) }),
  metricToRules: Object.freeze({
    FND_REVENUE: Object.freeze(['INS_REVENUE_QUALITY']),
    FND_REVENUE_GROWTH: Object.freeze(['INS_GROWTH']),
  }),
});

describe('incremental invalidation graph', () => {
  it('reruns the complete fundamental chain for a new filing but not price work', () => {
    expect(buildInvalidationPlan({ event: 'new_filing_detected' })).toMatchObject({
      affectedStages: [
        'sec_acquisition',
        'normalization',
        'fundamental_metrics',
        'rules',
        'synthesis',
        'fundamental_persistence',
      ],
      networkWorkStarted: true,
    });
  });

  it('resolves mapping changes through only affected concepts, metrics and rules', () => {
    const result = buildInvalidationPlan({
      event: 'mapping_version_changed',
      changedConceptIds: ['revenue'],
      dependencies,
    });
    expect(result.event).toBe('mapping_catalog_changed');
    expect(result.networkWorkStarted).toBe(false);
    expect(result.affectedConceptIds).toEqual(['revenue']);
    expect(result.affectedMetricIds).toEqual(['FND_GROSS_MARGIN', 'FND_REVENUE', 'FND_REVENUE_GROWTH']);
    expect(result.affectedRuleIds).toEqual(['INS_GROWTH', 'INS_REVENUE_QUALITY']);
    expect(result.affectedStages).not.toContain('price_overlay');
  });

  it('keeps metric and rule changes out of SEC acquisition', () => {
    const metric = buildInvalidationPlan({
      event: 'metric_definition_changed',
      changedMetricIds: ['FND_REVENUE'],
      dependencies,
    });
    expect(metric.affectedStages).toEqual([
      'fundamental_metrics',
      'rules',
      'synthesis',
      'fundamental_persistence',
    ]);
    expect(metric.networkWorkStarted).toBe(false);

    const rule = buildInvalidationPlan({
      event: 'insight_rule_changed',
      changedRuleIds: ['INS_GROWTH'],
    });
    expect(rule.affectedStages).toEqual(['rules', 'synthesis', 'fundamental_persistence']);
  });

  it('isolates price imports and makes visual preferences render-only', () => {
    expect(buildInvalidationPlan({ event: 'historical_price_imported' }).affectedStages).toEqual([
      'price_overlay',
      'price_quality',
      'price_metrics',
      'price_persistence',
    ]);
    const visual = buildInvalidationPlan({ event: 'visual_preference_changed' });
    expect(visual).toMatchObject({
      affectedStages: ['render'],
      domainWorkStarted: false,
      networkWorkStarted: false,
    });
  });

  it('starts checking on open/resume only with refresh consent', () => {
    expect(buildInvalidationPlan({ event: 'app_opened_or_resumed', refreshConsent: true }).affectedStages)
      .toEqual(['refresh_check']);
    expect(buildInvalidationPlan({ event: 'app_opened_or_resumed', refreshConsent: false }).affectedStages)
      .toEqual([]);
  });
});
