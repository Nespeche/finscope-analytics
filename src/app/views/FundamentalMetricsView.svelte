<script module lang="ts">
  import type { RouteDefinition } from '../composition';
  export const routeDefinition = { id: 'fundamental-metrics', label: 'Fundamental metrics', order: 50, requiredCapabilities: ['fundamental_metrics', 'evidence'] } as const satisfies RouteDefinition;
</script>
<script lang="ts">
  import MetricCard, { type MetricState } from '../components/MetricCard.svelte';
  interface Metric { label:string; value:string|null; unit:string; period:string; state:MetricState; reason:string }
  const names=['Revenue','Revenue growth','Gross profit','Gross margin','Operating income','Operating margin','Net income','Net margin','EBITDA','EBITDA margin','Operating cash flow','Capital expenditure','Free cash flow','Free cash flow margin','Cash and equivalents','Total debt','Net debt','Total assets','Total liabilities','Shareholders equity','Current ratio','Debt to equity','Return on assets','Return on equity'] as const;
  const metrics: readonly Metric[] = names.map((label,index)=>({ label, value:index===16||index===21?null:String(100+index), unit:index%4===1?'%':'USD million', period:index%3===0?'FY 2025':index%3===1?'Q1 2026':'TTM Q1 2026', state:index===16?'not_available':index===21?'not_applicable':'available', reason:index===16?'Debt classification is incomplete for the selected filing.':index===21?'Ratio is not applicable because equity is non-positive.':'' }));
</script>
<section aria-labelledby="metrics-heading"><p class="eyebrow">24 canonical metrics</p><h1 id="metrics-heading">Fundamental metrics</h1><p>Every card preserves FY, quarter or TTM context and exposes an evidence link. Missing values remain missing.</p><div class="grid">{#each metrics as metric,index (metric.label)}<MetricCard {...metric} evidenceId={`metric-evidence-${index+1}`} />{/each}</div><section aria-label="Metric evidence anchors">{#each metrics as metric,index (metric.label)}<p id={`metric-evidence-${index+1}`}><strong>{metric.label} evidence:</strong> source lineage retained in fundamental bundle.</p>{/each}</section></section>
<style>section{max-inline-size:80rem}.eyebrow{font-weight:700;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:1rem}</style>
