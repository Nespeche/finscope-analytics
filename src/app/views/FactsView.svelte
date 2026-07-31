<script module lang="ts">
  import type { RouteDefinition } from '../composition';
  export const routeDefinition = { id: 'facts', label: 'Facts', order: 40, requiredCapabilities: ['facts', 'normalization', 'evidence'] } as const satisfies RouteDefinition;
</script>
<script lang="ts">
  import FactProvenance from '../components/FactProvenance.svelte';
  const fingerprint = 'analysis-3ef1294ac4e87df48d4eb90561f1d047';
</script>
<section aria-labelledby="facts-heading"><p class="eyebrow">Raw and normalized facts</p><h1 id="facts-heading">Fact lineage and normalization</h1><p>Analysis fingerprint: <code>{fingerprint}</code></p>
  <article data-fact-state="normalized"><h2>Revenue</h2><div class="comparison"><section><h3>Raw SEC fact</h3><p>394,328,000,000 USD</p><p>FY · 2025-09-27</p></section><section><h3>Normalized fact</h3><p>394328000000 USD</p><p>Annual duration · positive sign</p></section></div><FactProvenance concept="us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax" accession="0000320193-25-000079" sourceUnit="USD" normalizedUnit="USD" scale="1" sign="positive" mapping="revenue" confidence="high" quality="complete" /></article>
  <article data-fact-state="unavailable"><h2>Minority interest</h2><p><strong>Unavailable.</strong> No authoritative compatible fact was reported for the selected period.</p><FactProvenance concept="unmapped" accession="not available" sourceUnit="not available" normalizedUnit="not available" scale="not available" sign="not available" mapping="minority_interest" confidence="none" quality="unavailable" /></article>
</section>
<style>section{max-inline-size:75rem}.eyebrow{font-weight:700;text-transform:uppercase}article{border-block-start:1px solid currentColor;padding-block:1rem}.comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}.comparison section{border:1px solid currentColor;padding:.75rem}</style>
