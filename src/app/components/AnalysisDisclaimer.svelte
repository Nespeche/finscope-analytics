<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'analysis-disclaimer';
  export const appPlacement: AppPlacement = 'footer';
  export const order = 10;
</script>

<aside class="analysis-disclaimer" aria-labelledby="analysis-disclaimer-heading" data-testid="analysis-disclaimer">
  <h2 id="analysis-disclaimer-heading">Research scope</h2>
  <p>
    FinScope provides deterministic, descriptive fundamental research. It is not personalized investment advice and does not issue buy, sell or hold instructions, price objectives, forecasts, return promises or confidence scores.
  </p>
  <p>
    Historical prices are an optional descriptive overlay. They never change fundamental facts, metrics, insights, fingerprints or the active fundamental snapshot.
  </p>
</aside>

<style>
  .analysis-disclaimer { border-block-start: 1px solid currentColor; margin-block-end: 0.75rem; padding-block-start: 0.75rem; }
  h2 { font-size: 1rem; margin: 0; }
  p { margin-block: 0.35rem 0; max-inline-size: 80ch; }
</style>
