<script lang="ts">
  import { onMount } from 'svelte';
  import { appComposition, installAppRuntime } from './composition';

  let activeRouteId = appComposition.homeRoute.id;
  $: activeRoute = appComposition.routes.find((route) => route.id === activeRouteId)
    ?? appComposition.homeRoute;
  $: headerComponents = appComposition.components.filter(
    (component) => component.appPlacement === 'header',
  );
  $: primaryActionComponents = appComposition.components.filter(
    (component) => component.appPlacement === 'primary-action',
  );
  $: statusComponents = appComposition.components.filter(
    (component) => component.appPlacement === 'status',
  );
  $: recoveryComponents = appComposition.components.filter(
    (component) => component.appPlacement === 'recovery',
  );
  $: footerComponents = appComposition.components.filter(
    (component) => component.appPlacement === 'footer',
  );

  onMount(() => {
    let mounted = true;
    let cleanup = () => {};

    void installAppRuntime(appComposition, { document, window }).then((installedCleanup) => {
      if (mounted) {
        cleanup = installedCleanup;
      } else {
        installedCleanup();
      }
    });

    return () => {
      mounted = false;
      cleanup();
    };
  });
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>

<header>
  <p class="brand">FinScope Analytics</p>
  <p>Deterministic, local-first fundamental analysis.</p>
  {#each headerComponents as registeredComponent (registeredComponent.id)}
    {@const HeaderComponent = registeredComponent.component}
    <HeaderComponent />
  {/each}
</header>

<nav aria-label="Primary navigation">
  <ul>
    {#each appComposition.routes as route (route.id)}
      <li>
        <button
          aria-current={route.id === activeRoute.id ? 'page' : undefined}
          type="button"
          onclick={() => { activeRouteId = route.id; }}
        >
          {route.label}
        </button>
      </li>
    {/each}
  </ul>
</nav>

{#each primaryActionComponents as registeredComponent (registeredComponent.id)}
  {@const PrimaryActionComponent = registeredComponent.component}
  <PrimaryActionComponent />
{/each}

<main id="main-content" tabindex="-1">
  {#if activeRoute}
    <svelte:component this={activeRoute.component} />
  {/if}
</main>

{#each statusComponents as registeredComponent (registeredComponent.id)}
  {@const StatusComponent = registeredComponent.component}
  <StatusComponent />
{/each}

{#each recoveryComponents as registeredComponent (registeredComponent.id)}
  {@const RecoveryComponent = registeredComponent.component}
  <RecoveryComponent />
{/each}

<footer>
  {#each footerComponents as registeredComponent (registeredComponent.id)}
    {@const FooterComponent = registeredComponent.component}
    <FooterComponent />
  {/each}
  <p>Fundamental research only. No recommendations, price targets, or trading instructions.</p>
</footer>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    line-height: 1.5;
  }

  :global(button),
  :global(a) {
    font: inherit;
  }

  :global(:focus-visible) {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }

  .skip-link {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.5rem;
    transform: translateY(-200%);
  }

  .skip-link:focus {
    transform: translateY(0);
  }

  header,
  nav,
  main,
  footer {
    padding: 1rem;
  }

  .brand {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }

  header > p:last-of-type,
  footer > p:last-of-type {
    margin-block: 0.25rem 0;
  }

  nav ul {
    display: flex;
    gap: 0.75rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  nav button[aria-current='page'] {
    font-weight: 700;
  }

  main {
    min-block-size: 16rem;
  }
</style>
