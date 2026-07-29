<script lang="ts">
  export let id: string;
  export let label: string;
  export let value = '';
  export let name: string | undefined = undefined;
  export let type: 'text' | 'search' | 'email' | 'url' | 'number' = 'text';
  export let required = false;
  export let disabled = false;
  export let description: string | undefined = undefined;
  export let error: string | undefined = undefined;
  export let autocomplete: string | undefined = undefined;
  export let onvaluechange: ((value: string, event: Event) => void) | undefined = undefined;

  $: descriptionId = `${id}-description`;
  $: errorId = `${id}-error`;
  $: describedBy = [
    description === undefined ? undefined : descriptionId,
    error === undefined ? undefined : errorId,
  ].filter((item): item is string => item !== undefined).join(' ');

  function handleInput(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('Field input event did not originate from an HTMLInputElement.');
    }
    value = input.value;
    onvaluechange?.(value, event);
  }
</script>

<div class="field">
  <label for={id}>{label}{required ? ' (required)' : ''}</label>
  {#if description !== undefined}
    <p id={descriptionId} class="description">{description}</p>
  {/if}
  <input
    {id}
    {name}
    {type}
    {value}
    {required}
    {disabled}
    {autocomplete}
    aria-invalid={error === undefined ? undefined : 'true'}
    aria-describedby={describedBy.length === 0 ? undefined : describedBy}
    oninput={handleInput}
  />
  {#if error !== undefined}
    <p id={errorId} class="error" role="alert">{error}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 0.375rem;
    max-inline-size: 32rem;
  }

  label {
    font-weight: 700;
  }

  input {
    min-block-size: 2.75rem;
    border: 2px solid currentColor;
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    font: inherit;
  }

  .description,
  .error {
    margin: 0;
  }

  .error {
    font-weight: 650;
  }
</style>
