<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'issuer-search',
    label: 'Issuer search',
    order: 10,
    requiredCapabilities: ['issuer_identity', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import IssuerCandidateList from '../components/IssuerCandidateList.svelte';
  import {
    resolveIssuer,
    type IssuerCandidateInput,
    type IssuerIdentity,
  } from '../../domain/identity/issuer-resolver';

  const issuerCatalog: readonly IssuerCandidateInput[] = Object.freeze([
    Object.freeze({
      cik: '0000320193',
      legalName: 'Apple Inc.',
      aliases: Object.freeze(['AAPL', 'APPLE']),
      accountingStandard: 'us_gaap' as const,
      entityType: 'operating_company' as const,
      analysisProfile: 'us-gaap-industrial-v1',
    }),
    Object.freeze({
      cik: '0001652044',
      legalName: 'Alphabet Inc.',
      aliases: Object.freeze(['GOOG', 'GOOGL', 'ALPHA']),
      accountingStandard: 'us_gaap' as const,
      entityType: 'operating_company' as const,
      analysisProfile: 'us-gaap-industrial-v1',
    }),
    Object.freeze({
      cik: '0001855612',
      legalName: 'Alpha Example Holdings Inc.',
      aliases: Object.freeze(['ALPHA']),
      accountingStandard: 'us_gaap' as const,
      entityType: 'operating_company' as const,
      analysisProfile: 'us-gaap-industrial-v1',
    }),
  ]);

  let query = '';
  let selectedIssuer: IssuerIdentity | undefined;
  let candidates: readonly IssuerIdentity[] = [];
  let message = 'Search by ticker alias or authoritative CIK.';
  let messageKind: 'status' | 'error' = 'status';

  function selectIssuer(issuer: IssuerIdentity): void {
    selectedIssuer = issuer;
    candidates = [];
    messageKind = 'status';
    message = `${issuer.legalName} selected by CIK ${issuer.cik}.`;
  }

  function submitSearch(): void {
    const result = resolveIssuer(query, issuerCatalog);
    if (result.status === 'resolved') {
      selectIssuer(result.issuer);
      return;
    }
    selectedIssuer = undefined;
    if (result.status === 'ambiguous') {
      candidates = result.candidates;
      messageKind = 'error';
      message = result.issue.message;
      return;
    }
    candidates = [];
    messageKind = 'error';
    message = 'No issuer matched. Correct the ticker or enter a CIK.';
  }
</script>

<section aria-labelledby="issuer-search-heading">
  <p class="eyebrow">Local identity resolution</p>
  <h1 id="issuer-search-heading">Select an issuer</h1>
  <p>Ticker symbols are aliases. FinScope stores and displays issuer identity by zero-padded CIK.</p>

  <form onsubmit={(event) => { event.preventDefault(); submitSearch(); }}>
    <label for="issuer-query">Ticker alias or CIK</label>
    <div class="search-row">
      <input
        id="issuer-query"
        name="issuer-query"
        autocomplete="off"
        bind:value={query}
        aria-describedby="issuer-search-help issuer-search-status"
      />
      <button type="submit">Find issuer</button>
    </div>
    <small id="issuer-search-help">Examples: AAPL, ALPHA, or 0000320193.</small>
  </form>

  <p
    id="issuer-search-status"
    aria-live="polite"
    role={messageKind === 'error' ? 'alert' : 'status'}
  >
    {message}
  </p>

  {#if candidates.length > 0}
    <section aria-labelledby="candidate-heading">
      <h2 id="candidate-heading">Choose the authoritative CIK</h2>
      <IssuerCandidateList {candidates} onSelect={selectIssuer} />
    </section>
  {/if}

  {#if selectedIssuer}
    <aside aria-labelledby="issuer-context-heading">
      <h2 id="issuer-context-heading">Active issuer context</h2>
      <dl>
        <div><dt>Legal name</dt><dd>{selectedIssuer.legalName}</dd></div>
        <div><dt>CIK</dt><dd>{selectedIssuer.cik}</dd></div>
        <div><dt>Profile</dt><dd>{selectedIssuer.analysisProfile}</dd></div>
        <div><dt>Period</dt><dd>Not selected</dd></div>
        <div><dt>Snapshot</dt><dd>No local snapshot</dd></div>
      </dl>
    </aside>
  {/if}
</section>

<style>
  section {
    max-inline-size: 68ch;
  }

  form,
  aside {
    margin-block-start: 1.5rem;
  }

  label,
  .eyebrow,
  dt {
    font-weight: 700;
  }

  .eyebrow {
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .search-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  input {
    flex: 1 1 18rem;
    min-block-size: 2.75rem;
  }

  button {
    min-block-size: 2.75rem;
  }

  dl {
    display: grid;
    gap: 0.5rem;
  }

  dl div {
    display: grid;
    grid-template-columns: minmax(7rem, 0.4fr) 1fr;
    gap: 1rem;
  }

  dd {
    margin: 0;
  }
</style>
