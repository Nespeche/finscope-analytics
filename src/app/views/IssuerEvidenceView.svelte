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

  const filings: readonly FilingRow[] = [
    { form: '10-K', accession: '0000320193-25-000079', filed: '2025-10-31', reportDate: '2025-09-27', sourceStatus: 'verified' },
    { form: '10-Q', accession: '0000320193-26-000006', filed: '2026-01-30', reportDate: '2025-12-27', sourceStatus: 'verified' },
    { form: '8-K', accession: '0000320193-26-000005', filed: '2026-01-30', reportDate: '2026-01-29', sourceStatus: 'partial' },
  ];
</script>

<section aria-labelledby="evidence-heading" aria-describedby="evidence-description">
  <p class="eyebrow">Source evidence</p>
  <h1 id="evidence-heading">Issuer identity and filings</h1>
  <p id="evidence-description">
    The issuer CIK, analysis profile and filing status remain visible in text. Source status is written in every row and never communicated by color alone.
  </p>

  <aside aria-labelledby="issuer-evidence-context-heading">
    <h2 id="issuer-evidence-context-heading">Apple Inc. — active issuer context</h2>
    <dl>
      <div><dt>CIK</dt><dd><code>0000320193</code></dd></div>
      <div><dt>Period</dt><dd>FY 2025</dd></div>
      <div><dt>Accounting profile</dt><dd>us-gaap-industrial-v1</dd></div>
      <div><dt>Snapshot</dt><dd>fundamental-snapshot-0000320193-fy2025</dd></div>
      <div><dt>Source status</dt><dd>SEC submissions and Company Facts verified</dd></div>
    </dl>
  </aside>

  <FilingTable {filings} />
</section>

<style>
  section { max-inline-size: 75rem; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  aside { border: 2px solid currentColor; border-radius: 0.5rem; padding: 1rem; }
  dl { display: flex; flex-wrap: wrap; gap: 1.5rem; }
  dt { font-weight: 700; }
  dd { margin: 0; overflow-wrap: anywhere; }
</style>
