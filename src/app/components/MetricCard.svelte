<script lang="ts">
  export type MetricState = 'available' | 'not_available' | 'not_applicable';
  export let label: string;
  export let value: string | null;
  export let unit: string;
  export let period: string;
  export let state: MetricState;
  export let reason: string;
  export let evidenceId: string;
</script>

<article data-metric-state={state} aria-labelledby={`${evidenceId}-title`}>
  <h3 id={`${evidenceId}-title`}>{label}</h3>
  <p class="value">{value ?? 'Unavailable'}</p>
  <p>{unit} · {period}</p>
  <p><strong>State:</strong> {state.replaceAll('_', ' ')}</p>
  {#if value === null}<p class="reason">{reason}</p>{/if}
  <a href={`#${evidenceId}`}>View evidence</a>
</article>

<style>
  article { border: 1px solid currentColor; border-radius: .4rem; padding: 1rem; }
  h3 { margin-block-start: 0; }
  .value { font-size: 1.45rem; font-weight: 700; }
  .reason { font-style: italic; }
</style>
