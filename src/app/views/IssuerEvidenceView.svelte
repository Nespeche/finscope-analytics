<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'issuer-evidence',
    label: 'Issuer evidence',
    order: 30,
    requiredCapabilities: ['issuer_identity', 'filings', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import FilingTable from '../components/FilingTable.svelte';

  interface FilingRow {
    readonly form: string;
    readonly accession: string;
    readonly filed: string;
    readonly reportDate: string;
    readonly sourceStatus: 'verified' | 'partial' | 'unavailable';
  }

  const filings: readonly FilingRow[] = Object.freeze([
    Object.freeze({ form: '10-K', accession: '0000320193-25-000079', filed: '2025-10-31', reportDate: '2025-09-27', sourceStatus: 'verified' }),
    Object.freeze({ form: '10-Q', accession: '0000320193-26-000006', filed: '2026-01-30', reportDate: '2025-12-27', sourceStatus: 'verified' }),
    Object.freeze({ form: '8-K', accession: '0000320193-26-000005', filed: '2026-01-30', reportDate: '2026-01-29', sourceStatus: 'partial' }),
  ]);
</script>

<svelte:head><title>Issuer evidence | FinScope Analytics</title></svelte:head>

<section aria-labelledby="evidence-heading">
  <p class="eyebrow">Source evidence</p>
  <h1 id="evidence-heading">Issuer identity and filings</h1>
  <p id="issuer-evidence-instructions">
    Verify the legal name and CIK before using a filing. Source status is written in every row and never communicated by color alone.
  </p>

  <aside aria-label="Issuer identity" aria-describedby="issuer-evidence-instructions">
    <h2 id="issuer-identity-heading">Apple Inc. identity</h2>
    <dl>
      <div><dt>CIK</dt><dd><code>0000320193</code></dd></div>
      <div><dt>Accounting profile</dt><dd>us-gaap-industrial-v1</dd></div>
      <div><dt>Reporting period</dt><dd>FY 2025</dd></div>
      <div><dt>Snapshot</dt><dd>fundamental-snapshot-0000320193-fy2025</dd></div>
      <div><dt>Source status</dt><dd>SEC submissions and Company Facts verified</dd></div>
    </dl>
  </aside>

  <section aria-labelledby="filing-evidence-heading">
    <h2 id="filing-evidence-heading">Filing evidence</h2>
    <p id="filing-evidence-summary" role="status" aria-live="polite">
      {filings.length} filings are listed: 2 verified and 1 partial. The complete accession, dates and source state are available in the table.
    </p>
    <div aria-describedby="filing-evidence-summary"><FilingTable {filings} /></div>
  </section>
</section>

<style>
  section { max-inline-size: 75rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  aside, section[aria-labelledby='filing-evidence-heading'] { margin-block-start: 1.25rem; }
  dl { display: flex; flex-wrap: wrap; gap: 1.5rem; }
  dt { font-weight: 700; }
  dd { margin: 0; overflow-wrap: anywhere; }
</style>
