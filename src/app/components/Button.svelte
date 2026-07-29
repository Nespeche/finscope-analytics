<script lang="ts">
  export let label: string;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let busy = false;
  export let disabled = false;
  export let destructive = false;
  export let onclick: ((event: MouseEvent) => void) | undefined = undefined;

  $: effectivelyDisabled = disabled || busy;

  function handleClick(event: MouseEvent): void {
    if (effectivelyDisabled) {
      event.preventDefault();
      return;
    }
    onclick?.(event);
  }
</script>

<button
  {type}
  class:destructive
  disabled={effectivelyDisabled}
  aria-busy={busy ? 'true' : undefined}
  aria-disabled={disabled ? 'true' : undefined}
  onclick={handleClick}
>
  {label}
</button>

<style>
  button {
    min-block-size: 2.75rem;
    padding: 0.625rem 1rem;
    border: 2px solid currentColor;
    border-radius: 0.375rem;
    background: Canvas;
    color: CanvasText;
    cursor: pointer;
    font: inherit;
    font-weight: 650;
  }

  button:hover:not(:disabled) {
    text-decoration: underline;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  button.destructive {
    border-width: 3px;
  }

  @media (prefers-reduced-motion: no-preference) {
    button {
      transition: outline-offset 120ms ease;
    }
  }
</style>
