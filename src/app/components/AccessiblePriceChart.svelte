<script lang="ts">
  import type { HistoricalPriceObservation } from '../../domain/price/types';

  export let observations: readonly HistoricalPriceObservation[];
  export let currency: string;

  const width = 720;
  const height = 280;
  const inset = 28;

  $: numericObservations = observations.map((observation) => ({
    date: observation.date,
    priceDecimal: observation.priceDecimal,
    price: Number(observation.priceDecimal),
  }));
  $: minimum = numericObservations.length === 0
    ? 0
    : Math.min(...numericObservations.map((observation) => observation.price));
  $: maximum = numericObservations.length === 0
    ? 0
    : Math.max(...numericObservations.map((observation) => observation.price));
  $: span = maximum - minimum || 1;
  $: denominator = Math.max(numericObservations.length - 1, 1);
  $: points = numericObservations.map((observation, index) => {
    const x = inset + (index / denominator) * (width - inset * 2);
    const y = height - inset - ((observation.price - minimum) / span) * (height - inset * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  $: first = numericObservations[0];
  $: last = numericObservations.at(-1);
  $: trendSummary = first === undefined || last === undefined
    ? 'No observations are available.'
    : last.price > first.price
      ? `The last observation is above the first observation.`
      : last.price < first.price
        ? `The last observation is below the first observation.`
        : `The first and last observations are equal.`;
</script>

<figure aria-labelledby="historical-price-chart-heading">
  <h2 id="historical-price-chart-heading">Historical price observations</h2>
  <p id="historical-price-chart-description">
    {trendSummary} The chart is supplemented by the complete values table below.
  </p>

  <svg
    role="img"
    aria-labelledby="historical-price-svg-title historical-price-svg-description"
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="xMidYMid meet"
  >
    <title id="historical-price-svg-title">Historical price line chart</title>
    <desc id="historical-price-svg-description">
      {observations.length} observations in {currency}. {trendSummary}
    </desc>
    <line x1={inset} y1={height - inset} x2={width - inset} y2={height - inset} />
    <line x1={inset} y1={inset} x2={inset} y2={height - inset} />
    {#if points.length > 0}
      <polyline points={points} fill="none" stroke="currentColor" stroke-width="4" />
    {/if}
  </svg>

  <div class="table-wrap" tabindex="0" aria-label="Scrollable historical price values table">
    <table aria-label="Historical price observations">
      <caption>Equivalent data table for the chart</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Price ({currency})</th></tr></thead>
      <tbody>
        {#each observations as observation (observation.date)}
          <tr><td>{observation.date}</td><td>{observation.priceDecimal}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</figure>

<style>
  figure {
    display: grid;
    gap: 0.75rem;
    margin: 0;
  }

  h2,
  p {
    margin-block: 0;
  }

  svg {
    inline-size: 100%;
    block-size: auto;
    border: 2px solid currentColor;
    background: Canvas;
  }

  svg line {
    stroke: currentColor;
    stroke-width: 1.5;
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
