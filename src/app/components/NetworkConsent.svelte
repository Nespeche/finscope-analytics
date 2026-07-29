<script lang="ts">
  export let granted = false;
  export let disabled = false;
  export let onConsentChange: (granted: boolean) => void = () => {};

  function handleChange(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    granted = target.checked;
    onConsentChange(granted);
  }
</script>

<fieldset class="network-consent" aria-describedby="network-consent-help">
  <legend>Network consent</legend>
  <label>
    <input
      type="checkbox"
      checked={granted}
      {disabled}
      onchange={handleChange}
    />
    Allow this manual SEC refresh to use the network
  </label>
  <p id="network-consent-help">
    FinScope never refreshes on open or resume. Consent applies only to an action you start.
  </p>
</fieldset>

<style>
  .network-consent {
    border: 1px solid currentColor;
    margin-block: 1rem;
    max-inline-size: 46rem;
    padding: 1rem;
  }

  legend,
  label {
    font-weight: 700;
  }

  label {
    align-items: flex-start;
    display: flex;
    gap: 0.75rem;
  }

  input {
    block-size: 1.25rem;
    inline-size: 1.25rem;
    margin-block-start: 0.15rem;
  }

  p {
    margin-block: 0.75rem 0;
  }
</style>
