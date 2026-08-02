<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'facts',
    label: 'Facts',
    order: 40,
    requiredCapabilities: ['facts', 'normalization', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import FactProvenance from '../components/FactProvenance.svelte';
  const fingerprint = 'analysis-3ef1294ac4e87df48d4eb90561f1d047';
</script>

<svelte:head><title>Facts | FinScope Analytics</title></svelte:head>

<section aria-labelledby="facts-heading">
  <p class="eyebrow">Raw and normalized facts</p>
  <h1 id="facts-heading">Fact lineage and normalization</h1>
  <p id="facts-instructions">
    Raw SEC values and normalized values are displayed side by side. State, units, period and provenance are provided as text; no meaning depends on position or color.
  </p>
  <p>Analysis fingerprint: <code>{fingerprint}</code></p>

  <article data-fact-state="normalized" aria-labelledby="revenue-fact-heading" aria-describedby="revenue-fact-state facts-instructions">
    <h2 id="revenue-fact-heading">Revenue</h2>
    <p id="revenue-fact-state"><strong>Fact state:</strong> normalized and available.</p>
    <div class="comparison">
      <section aria-labelledby="revenue-raw-heading">
        <h3 id="revenue-raw-heading">Raw SEC fact</h3>
        <p>394,328,000,000 USD</p>
        <p>FY · 2025-09-27</p>
      </section>
      <section aria-labelledby="revenue-normalized-heading">
        <h3 id="revenue-normalized-heading">Normalized fact</h3>
        <p>394328000000 USD</p>
        <p>Annual duration · positive sign</p>
      </section>
    </div>
    <h3>Revenue provenance</h3>
    <FactProvenance concept="us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax" accession="0000320193-25-000079" sourceUnit="USD" normalizedUnit="USD" scale="1" sign="positive" mapping="revenue" confidence="high" quality="complete" />
  </article>

  <article data-fact-state="unavailable" aria-labelledby="minority-fact-heading" aria-describedby="minority-fact-state facts-instructions">
    <h2 id="minority-fact-heading">Minority interest</h2>
    <p id="minority-fact-state"><strong>Fact state:</strong> unavailable.</p>
    <p>No authoritative compatible fact was reported for the selected period. FinScope does not substitute zero.</p>
    <h3>Minority interest provenance</h3>
    <FactProvenance concept="unmapped" accession="not available" sourceUnit="not available" normalizedUnit="not available" scale="not available" sign="not available" mapping="minority_interest" confidence="none" quality="unavailable" />
  </article>
</section>

<style>
  section { max-inline-size: 75rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  article { border-block-start: 1px solid currentColor; padding-block: 1rem; }
  .comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }
  .comparison section { border: 1px solid currentColor; padding: 0.75rem; }
  code { overflow-wrap: anywhere; }
</style>
