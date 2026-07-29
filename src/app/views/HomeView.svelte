<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'home',
    label: 'Home',
    order: 0,
    requiredCapabilities: [],
  } as const satisfies RouteDefinition;
</script>

<section aria-labelledby="home-heading">
  <p class="eyebrow">Local-first fundamental research</p>
  <h1 id="home-heading">FinScope Analytics</h1>
  <p>
    The application shell is ready. Issuer discovery, SEC acquisition, analysis, price overlays,
    and local persistence will be added only by their authorized implementation tasks.
  </p>
</section>

<style>
  section {
    max-inline-size: 68ch;
  }

  .eyebrow {
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
