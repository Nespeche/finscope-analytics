<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'fundamental-metrics',
    label: 'Fundamental metrics',
    order: 50,
    requiredCapabilities: ['fundamental_metrics', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  type MetricState = 'available' | 'not_available' | 'not_applicable';
  interface Metric { label: string; value: string | null; unit: string; period: string; state: MetricState; reason: string }

  const names = ['Revenue', 'Revenue growth', 'Gross profit', 'Gross margin', 'Operating income', 'Operating margin', 'Net income', 'Net margin', 'EBITDA', 'EBITDA margin', 'Operating cash flow', 'Capital expenditure', 'Free cash flow', 'Free cash flow margin', 'Cash and equivalents', 'Total debt', 'Net debt', 'Total assets', 'Total liabilities', 'Shareholders equity', 'Current ratio', 'Debt to equity', 'Return on assets', 'Return on equity'] as const;
  const metrics: readonly Metric[] = names.map((label, index) => ({
    label,
    value: index === 16 || index === 21 ? null : String(100 + index),
    unit: index % 4 === 1 ? '%' : 'USD million',
    period: index % 3 === 0 ? 'FY 2025' : index % 3 === 1 ? 'Q1 2026' : 'TTM Q1 2026',
    state: index === 16 ? 'not_available' : index === 21 ? 'not_applicable' : 'available',
    reason: index === 16 ? 'Debt classification is incomplete for the selected filing.' : index === 21 ? 'Ratio is not applicable because equity is non-positive.' : '',
  }));
</script>

<section aria-labelledby="metrics-heading" aria-describedby="metrics-description">
  <p class="eyebrow">24 canonical metrics</p>
  <h1 id="metrics-heading">Fundamental metrics</h1>
  <p id="metrics-description">Every card states its value or unavailable state, unit, period, reason and evidence link. Meaning does not depend on color or card position.</p>
  <p><strong>Active context:</strong> Apple Inc.; CIK 0000320193; FY 2025; profile us-gaap-industrial-v1; snapshot fundamental-snapshot-0000320193-fy2025.</p>

  <div class="grid" aria-label="Fundamental metric cards">
    {#each metrics as metric, index (metric.label)}
      <article data-metric-state={metric.state} aria-labelledby={`metric-title-${index + 1}`}>
        <h3 id={`metric-title-${index + 1}`}>{metric.label}</h3>
        <p class="value">{metric.value ?? 'Unavailable'}</p>
        <p>{metric.unit} · {metric.period}</p>
        <p><strong>State:</strong> {metric.state.replaceAll('_', ' ')}</p>
        {#if metric.value === null}<p class="reason">{metric.reason}</p>{/if}
        <a href={`#metric-evidence-${index + 1}`} aria-label={`View evidence for ${metric.label}`}>View evidence</a>
      </article>
    {/each}
  </div>

  <section aria-labelledby="metric-evidence-heading">
    <h2 id="metric-evidence-heading">Metric evidence anchors</h2>
    {#each metrics as metric, index (metric.label)}
      <p id={`metric-evidence-${index + 1}`}><strong>{metric.label} evidence:</strong> source lineage retained in the fundamental bundle for {metric.period}.</p>
    {/each}
  </section>
</section>

<style>
  section { max-inline-size: 80rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
  article { border: 1px solid currentColor; border-radius: 0.4rem; padding: 1rem; }
  article h3 { margin-block-start: 0; }
  .value { font-size: 1.45rem; font-weight: 700; }
  .reason { font-style: italic; }
</style>
