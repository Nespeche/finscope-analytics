<script lang="ts">
  export type ProgressStatusState = 'idle' | 'busy' | 'success' | 'error';

  export let state: ProgressStatusState = 'idle';
  export let message: string;
  export let current: number | undefined = undefined;
  export let total: number | undefined = undefined;
  export let progressLabel = 'Operation progress';

  $: hasDeterminateProgress = state === 'busy'
    && current !== undefined
    && total !== undefined
    && Number.isFinite(current)
    && Number.isFinite(total)
    && total > 0;
  $: role = state === 'error' ? 'alert' : 'status';
  $: live = state === 'error' ? 'assertive' : 'polite';
</script>

<section
  class="progress-status"
  class:error={state === 'error'}
  role={role}
  aria-live={live}
  aria-atomic="true"
  aria-busy={state === 'busy' ? 'true' : undefined}
>
  <p>{message}</p>
  {#if hasDeterminateProgress}
    <progress aria-label={progressLabel} value={current} max={total}></progress>
  {/if}
</section>

<style>
  .progress-status {
    border-inline-start: 0.35rem solid currentColor;
    padding: 0.5rem 0.75rem;
  }

  .progress-status.error {
    border-inline-start-width: 0.55rem;
    font-weight: 650;
  }

  p {
    margin: 0;
  }

  progress {
    inline-size: min(100%, 24rem);
    margin-block-start: 0.5rem;
  }
</style>
