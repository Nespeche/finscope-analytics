<script lang="ts">
  export interface FilingRow {
    readonly form: string;
    readonly accession: string;
    readonly filed: string;
    readonly reportDate: string;
    readonly sourceStatus: 'verified' | 'partial' | 'unavailable';
  }

  export let filings: readonly FilingRow[] = [];
</script>

<div class="table-wrap" tabindex="0" role="region" aria-label="Issuer filing evidence" aria-describedby="filing-table-help">
  <p id="filing-table-help" class="visually-hidden">Scroll horizontally when needed to review all filing evidence columns.</p>
  <table>
    <caption>SEC filings used as source evidence</caption>
    <thead><tr><th scope="col">Form</th><th scope="col">Accession</th><th scope="col">Filed</th><th scope="col">Report date</th><th scope="col">Source status</th></tr></thead>
    <tbody>
      {#each filings as filing (filing.accession)}
        <tr>
          <th scope="row">{filing.form}</th>
          <td><code>{filing.accession}</code></td>
          <td>{filing.filed}</td>
          <td>{filing.reportDate}</td>
          <td><span class:unavailable={filing.sourceStatus === 'unavailable'}>{filing.sourceStatus}</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap { max-inline-size: 100%; overflow-x: auto; }
  table { border-collapse: collapse; inline-size: 100%; min-inline-size: 46rem; }
  caption { font-weight: 700; text-align: start; margin-block-end: .5rem; }
  th, td { border-block-end: 1px solid currentColor; padding: .65rem; text-align: start; vertical-align: top; }
  .unavailable { font-weight: 700; }
  .visually-hidden { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
