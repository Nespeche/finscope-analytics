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
  interface Metric { readonly label: string; readonly value: string | null; readonly unit: string; readonly period: string; readonly state: MetricState; readonly reason: string; }
  const names = ['Revenue','Revenue growth','Gross profit','Gross margin','Operating income','Operating margin','Net income','Net margin','EBITDA','EBITDA margin','Operating cash flow','Capital expenditure','Free cash flow','Free cash flow margin','Cash and equivalents','Total debt','Net debt','Total assets','Total liabilities','Shareholders equity','Current ratio','Debt to equity','Return on assets','Return on equity'] as const;
  const metrics: readonly Metric[] = names.map((label, index) => Object.freeze({
    label,
    value: index === 16 || index === 21 ? null : String(100 + index),
    unit: index % 4 === 1 ? '%' : 'USD million',
    period: index % 3 === 0 ? 'FY 2025' : index % 3 === 1 ? 'Q1 2026' : 'TTM Q1 2026',
    state: index === 16 ? 'not_available' : index === 21 ? 'not_applicable' : 'available',
    reason: index === 16 ? 'Debt classification is incomplete for the selected filing.' : index === 21 ? 'Ratio is not applicable because equity is non-positive.' : '',
  }));
</script>

<svelte:head><title>Fundamental metrics | FinScope Analytics</title></svelte:head>

<section aria-labelledby="metrics-heading">
  <p class="eyebrow">24 canonical metrics</p>
  <h1 id="metrics-heading">Fundamental metrics</h1>
  <p id="metric-instructions">Every metric exposes value or explicit state, unit, period, reason and a uniquely named evidence link. Missing values remain missing.</p>

  <div class="grid" aria-describedby="metric-instructions">
    {#each metrics as metric, index (metric.label)}
      {@const evidenceId = `metric-evidence-${index + 1}`}
      {@const titleId = `metric-title-${index + 1}`}
      <article data-metric-state={metric.state} aria-labelledby={titleId}>
        <h2 id={titleId}>{metric.label}</h2>
        <p class="value">{metric.value ?? 'Unavailable'}</p>
        <p>{metric.unit} · {metric.period}</p>
        <p><strong>State:</strong> {metric.state.replaceAll('_', ' ')}</p>
        {#if metric.value === null}<p class="reason">{metric.reason}</p>{/if}
        <a href={`#${evidenceId}`}>View evidence for {metric.label}</a>
      </article>
    {/each}
  </div>

  <section aria-labelledby="metric-evidence-heading">
    <h2 id="metric-evidence-heading">Metric evidence anchors</h2>
    {#each metrics as metric, index (metric.label)}
      <p id={`metric-evidence-${index + 1}`} tabindex="-1"><strong>{metric.label} evidence:</strong> source lineage retained in the fundamental bundle for {metric.period}.</p>
    {/each}
  </section>
</section>

<style>
  section { max-inline-size: 80rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
  article { border: 1px solid currentColor; border-radius: 0.4rem; padding: 1rem; }
  article h2 { margin-block-start: 0; font-size: 1.15rem; }
  .value { font-size: 1.45rem; font-weight: 700; }
  .reason { font-style: italic; }
</style>
