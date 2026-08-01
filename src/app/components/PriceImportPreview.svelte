<script lang="ts">
  import type { HistoricalPriceImportPreview } from '../../domain/price/import-preview';

  export let preview: HistoricalPriceImportPreview;
  export let operationLabel: string;
</script>

<article class="preview" aria-labelledby="price-import-preview-heading" data-testid="price-import-preview">
  <p class="eyebrow">Read-only validation result</p>
  <h2 id="price-import-preview-heading">Price import preview</h2>
  <p>
    This preview has not changed the active price pointer. Review the scope and observations before
    choosing <strong>{operationLabel}</strong>.
  </p>

  <dl>
    <div><dt>Issuer CIK</dt><dd><code>{preview.scope.issuerCik}</code></dd></div>
    <div><dt>Instrument</dt><dd>{preview.scope.instrument.symbol} · {preview.scope.instrument.venueMic}</dd></div>
    <div><dt>Currency</dt><dd>{preview.scope.currency}</dd></div>
    <div><dt>Frequency</dt><dd>{preview.scope.frequency}</dd></div>
    <div><dt>Adjustment</dt><dd>{preview.scope.adjustmentStatus}</dd></div>
    <div><dt>Source method</dt><dd>{preview.source.method}</dd></div>
    <div><dt>Range</dt><dd>{preview.scope.window.startDate} to {preview.scope.window.endDate}</dd></div>
    <div><dt>Observations</dt><dd>{preview.observations.length}</dd></div>
    <div><dt>Quality</dt><dd>{preview.priceQuality.classification}</dd></div>
    <div><dt>Duplicate policy</dt><dd>{preview.duplicateResolution}</dd></div>
  </dl>

  {#if preview.issues.length > 0}
    <section class="issues" aria-labelledby="price-preview-issues-heading" role="alert">
      <h3 id="price-preview-issues-heading">Blocking issues</h3>
      <ul>
        {#each preview.issues as issue (issue.code + (issue.date ?? ''))}
          <li>{issue.message}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if preview.warnings.length > 0}
    <section aria-labelledby="price-preview-warnings-heading">
      <h3 id="price-preview-warnings-heading">Warnings</h3>
      <ul>
        {#each preview.warnings as warning (warning)}
          <li>{warning}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <div class="table-wrap">
    <table aria-label="Historical price observations in the import preview">
      <caption>Validated observations, sorted by date</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Price</th></tr></thead>
      <tbody>
        {#each preview.observations as observation (observation.date)}
          <tr><td>{observation.date}</td><td>{observation.priceDecimal}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <p class:allowed={preview.publicationAllowed} class="publication-state">
    {preview.publicationAllowed
      ? 'Preview valid. Publication still requires explicit confirmation.'
      : 'Preview invalid. Publication is blocked.'}
  </p>
</article>

<style>
  .preview {
    display: grid;
    gap: 1rem;
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .eyebrow,
  .publication-state {
    font-weight: 700;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
  }

  h2,
  h3,
  p {
    margin-block: 0;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  dl div {
    border-inline-start: 0.25rem solid currentColor;
    padding-inline-start: 0.75rem;
  }

  dt {
    font-weight: 700;
  }

  dd {
    margin: 0;
  }

  .issues {
    border: 2px solid currentColor;
    padding: 0.75rem;
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

  .publication-state.allowed {
    border-inline-start: 0.35rem solid currentColor;
    padding-inline-start: 0.75rem;
  }
</style>
