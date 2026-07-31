<script module lang="ts">
  import type { AppPlacement } from '../composition';

  export const componentId = 'refresh-fundamentals';
  export const appPlacement: AppPlacement = 'recovery';
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
  <div class="intro">
    <h2 id="refresh-fundamentals-heading">Update fundamentals</h2>
    <p id="refresh-force-disclosure">
      Manual refresh forces a one-time SEC Submissions check and may fetch Company Facts; consent, fair access, retry, quota, locks, cancellation, and snapshot protection still apply.
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
  <small id="refresh-consent-help" class="visually-hidden">Consent is off by default and is independent from local storage consent.</small>

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

  <details class="runtime-evidence">
    <summary>Refresh integrity details</summary>
    <dl aria-label="Refresh integrity evidence">
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
  </details>
</section>

<style>
  .refresh-control {
    border-block: 1px solid currentColor;
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
  }

  .intro {
    display: grid;
    gap: 0.125rem;
  }

  h2,
  p {
    margin: 0;
  }

  .consent {
    align-items: start;
    display: flex;
    gap: 0.5rem;
    font-weight: 700;
  }

  .visually-hidden {
    block-size: 1px;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    inline-size: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
  }

  .actions,
  .recovery {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
    min-block-size: 2.75rem;
  }

  .status {
    border-inline-start: 0.25rem solid currentColor;
    padding-inline-start: 0.75rem;
  }

  .runtime-evidence summary {
    cursor: pointer;
    font-weight: 700;
  }

  .runtime-evidence dl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin-block: 0.5rem 0;
  }

  .runtime-evidence dl div {
    display: flex;
    flex: 1 1 12rem;
    gap: 0.35rem;
    min-inline-size: 0;
  }

  dt {
    font-weight: 700;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
