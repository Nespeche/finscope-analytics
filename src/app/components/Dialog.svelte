<script lang="ts">
  import { onDestroy, tick } from 'svelte';

  export let id: string;
  export let open = false;
  export let title: string;
  export let description: string;
  export let confirmLabel = 'Confirm';
  export let cancelLabel = 'Cancel';
  export let destructive = false;
  export let onconfirm: (() => void) | undefined = undefined;
  export let oncancel: (() => void) | undefined = undefined;

  let dialog: HTMLDialogElement;
  let cancelButton: HTMLButtonElement;
  let previousFocus: HTMLElement | null = null;
  let restoringFocus = false;

  $: titleId = `${id}-title`;
  $: descriptionId = `${id}-description`;
  $: if (dialog !== undefined) {
    if (open && !dialog.open) {
      showDialog();
    } else if (!open && dialog.open) {
      dialog.close('external');
    }
  }

  function showDialog(): void {
    const activeElement = document.activeElement;
    previousFocus = activeElement instanceof HTMLElement ? activeElement : null;
    dialog.showModal();
    void tick().then(() => {
      cancelButton.focus();
    });
  }

  function restoreFocus(): void {
    if (restoringFocus) return;
    restoringFocus = true;
    const target = previousFocus;
    previousFocus = null;
    queueMicrotask(() => {
      target?.focus();
      restoringFocus = false;
    });
  }

  function closeWithConfirmation(): void {
    onconfirm?.();
    open = false;
    dialog.close('confirm');
  }

  function closeWithCancellation(): void {
    oncancel?.();
    open = false;
    dialog.close('cancel');
  }

  function handleNativeCancel(event: Event): void {
    event.preventDefault();
    closeWithCancellation();
  }

  onDestroy(() => {
    if (dialog?.open) {
      dialog.close('destroyed');
    }
    restoreFocus();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  oncancel={handleNativeCancel}
  onclose={restoreFocus}
>
  <form method="dialog" onsubmit={(event) => { event.preventDefault(); }}>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>{description}</p>
    <div class="actions">
      <button bind:this={cancelButton} type="button" onclick={closeWithCancellation}>
        {cancelLabel}
      </button>
      <button
        type="button"
        class:destructive
        aria-label={destructive ? `${confirmLabel}: ${title}` : confirmLabel}
        onclick={closeWithConfirmation}
      >
        {confirmLabel}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    max-inline-size: min(34rem, calc(100vw - 2rem));
    border: 3px solid currentColor;
    border-radius: 0.5rem;
    padding: 1.25rem;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 55%);
  }

  h2,
  p {
    margin-block-start: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  button {
    min-block-size: 2.75rem;
    border: 2px solid currentColor;
    border-radius: 0.375rem;
    padding: 0.625rem 1rem;
    background: Canvas;
    color: CanvasText;
    font: inherit;
    font-weight: 650;
  }

  button.destructive {
    border-width: 3px;
  }
</style>
