<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'refresh-fundamentals';
  export const appPlacement: AppPlacement = 'primary-action';
  export const order = 20;
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    refreshRuntime,
    type RefreshRuntimeSnapshot,
  } from '../lifecycle/resume-refresh';

  let runtimeSnapshot: RefreshRuntimeSnapshot = refreshRuntime.snapshot();
  let refreshButton: HTMLButtonElement | undefined;
  let restartButton: HTMLButtonElement | undefined;

  $: busy = ['checking', 'acquiring', 'normalizing', 'analyzing'].includes(runtimeSnapshot.state);
  $: primaryDisabled = busy || runtimeSnapshot.state === 'failed' || runtimeSnapshot.state === 'cancelled';
  $: showRecovery = runtimeSnapshot.state === 'failed' || runtimeSnapshot.state === 'cancelled';
  $: statusRole = runtimeSnapshot.state === 'failed' || runtimeSnapshot.state === 'cancelled'
    ? 'alert'
    : undefined;

  onMount(() => refreshRuntime.subscribe((snapshot) => {
    runtimeSnapshot = snapshot;
  }));

  function updateConsent(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    refreshRuntime.setRefreshConsent(target.checked);
  }

  async function startManualRefresh(): Promise<void> {
    await refreshRuntime.requestManualRefresh();
  }

  async function cancelRefresh(): Promise<void> {
    refreshRuntime.cancelActiveOperation();
    await tick();
    restartButton?.focus();
  }

  async function restartRefresh(): Promise<void> {
    await refreshRuntime.requestManualRefresh();
  }
</script>

<section class="refresh-control" aria-labelledby="refresh-fundamentals-heading" data-testid="refresh-fundamentals-control">
  <div>
    <p class="eyebrow">Foreground refresh</p>
    <h2 id="refresh-fundamentals-heading">Update fundamentals</h2>
    <p id="refresh-force-disclosure">
      A manual update forces a one-time SEC Submissions check and may request Company Facts. It still requires refresh consent and never bypasses fair access, retries, quota, locks, cancellation, or snapshot protection.
    </p>
  </div>

  <label class="consent">
    <input
      type="checkbox"
      checked={runtimeSnapshot.refreshConsent}
      onchange={updateConsent}
      aria-describedby="refresh-consent-help"
    />
    Allow open, resume, and manual SEC refreshes
  </label>
  <small id="refresh-consent-help">Consent is off by default and is independent from local storage consent.</small>

  <div class="actions" aria-label="Fundamental refresh actions">
    <button
      bind:this={refreshButton}
      type="button"
      data-testid="refresh-fundamentals-button"
      aria-label="Refresh fundamentals from SEC"
      aria-describedby="refresh-force-disclosure"
      aria-busy={busy ? 'true' : undefined}
      aria-disabled={runtimeSnapshot.state === 'failed' || runtimeSnapshot.state === 'cancelled' ? 'true' : undefined}
      disabled={primaryDisabled}
      onclick={() => { void startManualRefresh(); }}
    >
      Update fundamentals
    </button>
    <button
      type="button"
      data-testid="cancel-refresh-button"
      disabled={!busy}
      onclick={() => { void cancelRefresh(); }}
    >
      Cancel refresh
    </button>
  </div>

  {#if showRecovery}
    <div class="recovery" aria-label="Refresh recovery actions">
      <button bind:this={restartButton} type="button" onclick={() => { void restartRefresh(); }}>Restart refresh</button>
      <button type="button" onclick={() => { refreshRuntime.useLastSnapshot(); }}>Use last snapshot</button>
    </div>
  {/if}

  <p
    class="status"
    data-testid="refresh-status"
    role={statusRole}
    aria-live={statusRole === 'alert' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >
    {runtimeSnapshot.statusMessage}
  </p>

  <dl class="runtime-evidence" aria-label="Refresh integrity evidence">
    <div>
      <dt>Pipeline state</dt>
      <dd data-testid="refresh-state">{runtimeSnapshot.state}</dd>
    </div>
    <div>
      <dt>Active snapshot</dt>
      <dd data-testid="active-snapshot-id">{runtimeSnapshot.activeSnapshotId}</dd>
    </div>
    <div>
      <dt>Pointer generation</dt>
      <dd data-testid="active-pointer-generation">{runtimeSnapshot.activePointerGeneration}</dd>
    </div>
    <div>
      <dt>Network calls in this session</dt>
      <dd data-testid="refresh-network-call-count">{runtimeSnapshot.networkCallCount}</dd>
    </div>
  </dl>
</section>

<style>
  .refresh-control {
    border-block: 1px solid currentColor;
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }

  h2,
  p {
    margin: 0;
  }

  .eyebrow {
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .consent {
    align-items: start;
    display: flex;
    gap: 0.5rem;
    font-weight: 700;
  }

  .actions,
  .recovery {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button {
    min-block-size: 2.75rem;
  }

  .status {
    border-inline-start: 0.25rem solid currentColor;
    padding-inline-start: 0.75rem;
  }

  .runtime-evidence {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }

  .runtime-evidence div {
    display: grid;
    grid-template-columns: minmax(10rem, 0.5fr) 1fr;
    gap: 0.75rem;
  }

  dt {
    font-weight: 700;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
