<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'application-status';
  export const appPlacement: AppPlacement = 'status';
  export const order = 10;
</script>

<section aria-labelledby="application-status-heading" class="app-status">
  <h2 id="application-status-heading">Application status</h2>
  <p aria-live="polite" role="status" tabindex="-1">
    Workspace ready. No issuer data has been requested.
  </p>
</section>

<style>
  .app-status {
    border-block: 1px solid currentColor;
    padding: 1rem;
  }

  h2,
  p {
    margin: 0;
  }

  p {
    margin-block-start: 0.5rem;
  }
</style>
