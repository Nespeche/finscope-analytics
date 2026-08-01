<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'price-analysis',
    label: 'Price analysis',
    order: 80,
    requiredCapabilities: ['historical_price_overlay', 'historical_price_metrics', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import AccessiblePriceChart from '../components/AccessiblePriceChart.svelte';
  import {
    fundamentalDisplayContext,
    priceWorkspace,
  } from './PriceImportView.svelte';
  import type { PriceMetricResult } from '../../domain/price/types';

  const metricLabels: Readonly<Record<string, string>> = Object.freeze({
    MKT_LAST_OBSERVATION: 'Last observation',
    MKT_MIN: 'Minimum',
    MKT_MAX: 'Maximum',
    MKT_MEAN: 'Mean',
    MKT_MEDIAN: 'Median',
    MKT_SIMPLE_RETURN: 'Simple return',
    MKT_MAX_DRAWDOWN: 'Maximum drawdown',
    MKT_TREND_DIRECTION: 'Trend direction',
  });

  let evaluationDate = new Date().toISOString().slice(0, 10);

  $: pointer = $priceWorkspace.persistence.activePricePointers[fundamentalDisplayContext.issuerCik];
  $: overlay = pointer === undefined
    ? undefined
    : $priceWorkspace.persistence.priceOverlays[`${pointer.overlayId}:${pointer.overlayVersion}`];
  $: analysis = pointer === undefined
    ? undefined
    : $priceWorkspace.persistence.priceAnalyses[pointer.analysisId];
  $: observations = overlay?.observations ?? [];
  $: asOfDate = observations.at(-1)?.date;
  $: rangeStart = observations[0]?.date;
  $: displayAgeDays = asOfDate === undefined ? undefined : calculateAgeDays(asOfDate, evaluationDate);

  function calculateAgeDays(asOf: string, evaluation: string): number | undefined {
    const asOfTime = Date.parse(`${asOf}T00:00:00Z`);
    const evaluationTime = Date.parse(`${evaluation}T00:00:00Z`);
    if (!Number.isFinite(asOfTime) || !Number.isFinite(evaluationTime)) return undefined;
    return Math.max(0, Math.floor((evaluationTime - asOfTime) / 86_400_000));
  }

  function metricValue(metric: PriceMetricResult): string {
    if (metric.state !== 'available') {
      const reason = metric.reasonCodes?.join(', ') ?? 'No value is available for this state.';
      return `${metric.state.replaceAll('_', ' ')} — ${reason}`;
    }
    if (metric.valueDecimal !== undefined) return `${metric.valueDecimal} ${metric.unit ?? ''}`.trim();
    if (metric.valueEnum !== undefined) return metric.valueEnum;
    return 'Available without a scalar value.';
  }
</script>

<section
  aria-labelledby="price-analysis-heading"
  data-testid="price-analysis-view"
  data-fundamental-input-fingerprint={$priceWorkspace.persistence.fundamental.fingerprints.fundamentalInputFingerprint}
  data-fundamental-analysis-fingerprint={$priceWorkspace.persistence.fundamental.fingerprints.fundamentalAnalysisFingerprint}
  data-price-overlay-fingerprint={overlay?.historicalPriceOverlayFingerprint}
  data-price-analysis-fingerprint={analysis?.priceAnalysisFingerprint}
>
  <p class="eyebrow">Descriptive historical overlay</p>
  <h1 id="price-analysis-heading">Historical price analysis</h1>
  <p class="disclosure">
    Price is an optional overlay and is never part of the fundamental bundle. No valuation is generated.
  </p>

  <aside aria-labelledby="price-analysis-context-heading">
    <h2 id="price-analysis-context-heading">Fundamental context remains visible</h2>
    <dl>
      <div><dt>Issuer</dt><dd>{fundamentalDisplayContext.issuerName}</dd></div>
      <div><dt>CIK</dt><dd><code>{fundamentalDisplayContext.issuerCik}</code></dd></div>
      <div><dt>Period</dt><dd>{fundamentalDisplayContext.reportingPeriod}</dd></div>
      <div><dt>Profile</dt><dd>{fundamentalDisplayContext.analysisProfile}</dd></div>
      <div><dt>Snapshot</dt><dd><code>{fundamentalDisplayContext.snapshotId}</code></dd></div>
    </dl>
  </aside>

  <section class="fingerprints" aria-labelledby="fingerprints-heading">
    <h2 id="fingerprints-heading">Independent fingerprints</h2>
    <p>Fundamental input: <code data-testid="analysis-fundamental-input-fingerprint">{$priceWorkspace.persistence.fundamental.fingerprints.fundamentalInputFingerprint}</code></p>
    <p>Fundamental analysis: <code data-testid="analysis-fundamental-analysis-fingerprint">{$priceWorkspace.persistence.fundamental.fingerprints.fundamentalAnalysisFingerprint}</code></p>
    {#if overlay !== undefined && analysis !== undefined}
      <p>Price overlay: <code data-testid="analysis-price-overlay-fingerprint">{overlay.historicalPriceOverlayFingerprint}</code></p>
      <p>Price analysis: <code data-testid="analysis-price-analysis-fingerprint">{analysis.priceAnalysisFingerprint}</code></p>
    {:else}
      <p data-testid="fundamental-only-status">Fundamental-only operation remains complete without price data.</p>
    {/if}
  </section>

  {#if pointer === undefined || overlay === undefined || analysis === undefined}
    <section class="empty-state" aria-labelledby="price-empty-heading">
      <h2 id="price-empty-heading">No active price overlay</h2>
      <p>The fundamental bundle, analysis, snapshot and pointer remain usable and complete.</p>
      <p>Importing price data is optional.</p>
    </section>
  {:else}
    <section class="summary" aria-labelledby="price-summary-heading">
      <h2 id="price-summary-heading">Price overlay summary</h2>
      <dl data-testid="price-summary">
        <div><dt>As-of date</dt><dd>{asOfDate}</dd></div>
        <div><dt>Range</dt><dd>{rangeStart} to {asOfDate}</dd></div>
        <div><dt>Frequency</dt><dd>{overlay.frequency}</dd></div>
        <div><dt>Observation count</dt><dd>{overlay.observations.length}</dd></div>
        <div><dt>Overlay use</dt><dd>{overlay.priceUse}</dd></div>
        <div><dt>Overlay version</dt><dd>{pointer.overlayVersion}</dd></div>
        <div><dt>Pointer generation</dt><dd>{pointer.generation}</dd></div>
        <div><dt>Quality</dt><dd>{overlay.priceQuality?.classification ?? 'insufficient'}</dd></div>
      </dl>

      <div class="evaluation-field">
        <label for="price-evaluation-date">Evaluation date for displayed age</label>
        <input id="price-evaluation-date" type="date" bind:value={evaluationDate} />
        <p>
          Display age: <strong data-testid="price-display-age">{displayAgeDays === undefined ? 'Unavailable' : `${displayAgeDays} days`}</strong>.
          This presentation-only value is not stored in the overlay and does not change either price fingerprint.
        </p>
      </div>
    </section>

    <section class="metrics" aria-labelledby="price-metrics-heading">
      <h2 id="price-metrics-heading">Eight historical price metrics</h2>
      <p>Each value is available in this table independently of the chart.</p>
      <div class="table-wrap">
        <table aria-label="Eight historical price metrics">
          <caption>Descriptive price metrics for overlay version {pointer.overlayVersion}</caption>
          <thead>
            <tr><th scope="col">Metric</th><th scope="col">Value or state</th><th scope="col">Quality</th></tr>
          </thead>
          <tbody>
            {#each analysis.priceMetricResults as metric (metric.metricId)}
              <tr data-testid="price-metric-row" data-metric-id={metric.metricId}>
                <th scope="row">{metricLabels[metric.metricId] ?? metric.metricId}</th>
                <td>{metricValue(metric)}</td>
                <td>{metric.qualityClassification}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <AccessiblePriceChart observations={overlay.observations} currency={overlay.currency} />

    <section class="contract-state" aria-labelledby="price-contract-heading">
      <h2 id="price-contract-heading">Overlay contract and isolation</h2>
      <p>Contract version: {overlay.contractVersion}; source profile: {overlay.origin.profileId}.</p>
      <p>Price use is historical and descriptive only. The overlay contains no fundamental facts, rules, synthesis or bundle identifier.</p>
      <p>Evaluation date and display age are presentation inputs, not persisted overlay fields.</p>
      <p data-testid="fundamental-isolation-status">
        Fundamental bundle, analysis, snapshot, pointer and fingerprints remain unchanged by the last price event.
      </p>
    </section>
  {/if}
</section>

<style>
  section[aria-labelledby="price-analysis-heading"] {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 78rem;
  }

  .eyebrow {
    margin: 0;
    font-weight: 700;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-block: 0;
  }

  .disclosure,
  aside,
  .fingerprints,
  .empty-state,
  .summary,
  .metrics,
  .contract-state {
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .disclosure {
    border-inline-width: 0.4rem;
    font-weight: 700;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  dt,
  label {
    font-weight: 700;
  }

  dd {
    margin: 0;
  }

  .evaluation-field {
    display: grid;
    gap: 0.5rem;
    margin-block-start: 1rem;
    max-inline-size: 32rem;
  }

  input {
    min-block-size: 2.75rem;
    border: 2px solid currentColor;
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    font: inherit;
  }

  .table-wrap {
    max-inline-size: 100%;
    overflow: auto;
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid currentColor;
    padding: 0.5rem;
    text-align: start;
  }

  caption {
    padding-block-end: 0.5rem;
    font-weight: 700;
    text-align: start;
  }
</style>
