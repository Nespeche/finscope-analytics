<script module lang="ts">
  import type { RouteDefinition } from '../composition';
  export const routeDefinition = { id: 'issuer-evidence', label: 'Issuer evidence', order: 30, requiredCapabilities: ['issuer_identity', 'filings', 'evidence'] } as const satisfies RouteDefinition;
</script>
<script lang="ts">
  import FilingTable, { type FilingRow } from '../components/FilingTable.svelte';
  const filings: readonly FilingRow[] = [
    { form: '10-K', accession: '0000320193-25-000079', filed: '2025-10-31', reportDate: '2025-09-27', sourceStatus: 'verified' },
    { form: '10-Q', accession: '0000320193-26-000006', filed: '2026-01-30', reportDate: '2025-12-27', sourceStatus: 'verified' },
    { form: '8-K', accession: '0000320193-26-000005', filed: '2026-01-30', reportDate: '2026-01-29', sourceStatus: 'partial' },
  ];
</script>
<section aria-labelledby="evidence-heading">
  <p class="eyebrow">Source evidence</p><h1 id="evidence-heading">Issuer identity and filings</h1>
  <aside aria-label="Issuer identity"><h2>Apple Inc.</h2><dl><div><dt>CIK</dt><dd><code>0000320193</code></dd></div><div><dt>Accounting profile</dt><dd>us-gaap-industrial-v1</dd></div><div><dt>Source status</dt><dd>SEC submissions and Company Facts verified</dd></div></dl></aside>
  <FilingTable {filings} />
</section>
<style>section{max-inline-size:75rem}.eyebrow{font-weight:700;text-transform:uppercase}dl{display:flex;flex-wrap:wrap;gap:1.5rem}dt{font-weight:700}dd{margin:0}</style>
