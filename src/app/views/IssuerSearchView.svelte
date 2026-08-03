<script module lang="ts">
  import { writable } from 'svelte/store';
  import type { RouteDefinition } from '../composition';
  import type { IssuerIdentity } from '../../domain/identity/issuer-resolver';

  export const routeDefinition = {
    id: 'issuer-search',
    label: 'Issuer search',
    order: 10,
    requiredCapabilities: ['issuer_identity', 'evidence'],
  } as const satisfies RouteDefinition;

  export interface FundamentalDisplayContext {
    readonly issuerName: string;
    readonly issuerCik: IssuerIdentity['cik'];
    readonly symbol: string;
    readonly venueMic: string;
    readonly currency: string;
    readonly reportingPeriod: string;
    readonly analysisProfile: string;
    readonly snapshotId: string;
  }

  interface MarketContext {
    readonly symbol: string;
    readonly venueMic: string;
    readonly currency: string;
  }

  const marketContextByCik: Readonly<Record<string, MarketContext>> = Object.freeze({
    '0000320193': Object.freeze({ symbol: 'AAPL', venueMic: 'XNAS', currency: 'USD' }),
    '0001652044': Object.freeze({ symbol: 'GOOGL', venueMic: 'XNAS', currency: 'USD' }),
    '0001855612': Object.freeze({ symbol: 'ALPHA', venueMic: 'XNAS', currency: 'USD' }),
  });

  const defaultIssuer: IssuerIdentity = Object.freeze({
    cik: '0000320193' as IssuerIdentity['cik'],
    legalName: 'Apple Inc.',
    accountingStandard: 'us_gaap',
    entityType: 'operating_company',
    analysisProfile: 'us-gaap-industrial-v1',
  });

  const initialFundamentalContext: FundamentalDisplayContext = Object.freeze({
    issuerName: defaultIssuer.legalName,
    issuerCik: defaultIssuer.cik,
    symbol: 'AAPL',
    venueMic: 'XNAS',
    currency: 'USD',
    reportingPeriod: 'FY 2025',
    analysisProfile: defaultIssuer.analysisProfile,
    snapshotId: 'fundamental-snapshot-0000320193-fy2025',
  });

  export function createFundamentalDisplayContext(
    issuer: IssuerIdentity,
  ): FundamentalDisplayContext {
    const market = marketContextByCik[issuer.cik] ?? Object.freeze({
      symbol: 'Not selected',
      venueMic: 'Not selected',
      currency: 'Not selected',
    });
    return Object.freeze({
      issuerName: issuer.legalName,
      issuerCik: issuer.cik,
      symbol: market.symbol,
      venueMic: market.venueMic,
      currency: market.currency,
      reportingPeriod: 'Not selected',
      analysisProfile: issuer.analysisProfile,
      snapshotId: 'No local snapshot',
    });
  }

  export const activeFundamentalContext = writable<FundamentalDisplayContext>(
    initialFundamentalContext,
  );

  export function setActiveIssuerContext(issuer: IssuerIdentity): void {
    activeFundamentalContext.set(createFundamentalDisplayContext(issuer));
  }
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

  $: queryHasError = messageKind === 'error';

  function selectIssuer(issuer: IssuerIdentity): void {
    selectedIssuer = issuer;
    candidates = [];
    setActiveIssuerContext(issuer);
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
        aria-invalid={queryHasError ? 'true' : undefined}
        aria-errormessage={queryHasError ? 'issuer-search-status' : undefined}
        aria-describedby={queryHasError ? 'issuer-search-help issuer-search-status' : 'issuer-search-help'}
      />
      <button type="submit">Find issuer</button>
    </div>
    <small id="issuer-search-help">Enter a ticker alias or the authoritative zero-padded ten-digit CIK. Examples: AAPL, ALPHA, or 0000320193. Ambiguous aliases require selecting the legal name and CIK from the result list.</small>
  </form>

  <p
    id="issuer-search-status"
    aria-live={messageKind === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
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
