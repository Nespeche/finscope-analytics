<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'privacy-settings',
    label: 'Privacy settings',
    order: 90,
    requiredCapabilities: ['consent', 'local_snapshot', 'export_restore'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { createConsentRepository } from '../../persistence/consent-repository';

  const consentRepository = createConsentRepository();

  let refreshConsent = consentRepository.read('refreshConsent').granted;
  let storageConsent = consentRepository.read('storageConsent').granted;
  let statusMessage = 'Refresh and local storage are disabled by default.';
  let statusKind: 'status' | 'alert' = 'status';
  let refreshControl: HTMLInputElement;
  let storageControl: HTMLInputElement;

  function setRefreshConsent(granted: boolean): void {
    const record = consentRepository.set('refreshConsent', granted);
    refreshConsent = record.granted;
    statusKind = 'status';
    statusMessage = granted
      ? 'Refresh consent granted. Network access still requires an explicit refresh action.'
      : 'Refresh consent revoked. Lifecycle and manual refresh actions are local-only.';
    void tick().then(() => refreshControl.focus());
  }

  function setStorageConsent(granted: boolean): void {
    const record = consentRepository.set('storageConsent', granted);
    storageConsent = record.granted;
    statusKind = 'status';
    statusMessage = granted
      ? 'Storage consent granted. Confirmed analyses may be saved locally.'
      : 'Storage consent revoked. Analysis remains available in memory and no new local write is allowed.';
    void tick().then(() => storageControl.focus());
  }

  async function runMemoryAnalysis(): Promise<void> {
    const result = await consentRepository.runPersistentWrite(() => 'saved-locally');
    statusKind = 'status';
    statusMessage = result.mode === 'persisted'
      ? 'Analysis completed and saved locally with storage consent.'
      : 'Analysis completed in memory only. Storage consent is not required for analysis.';
  }

  async function requestRefresh(): Promise<void> {
    try {
      const result = await consentRepository.runLifecycleRefresh(async () => {
        const response = await fetch('/consent-network-probe', {
          method: 'GET',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Refresh probe returned HTTP ${response.status}.`);
        return response.status;
      });
      statusKind = 'status';
      statusMessage = result.mode === 'local_only'
        ? 'Refresh skipped. Refresh consent is off, so zero network requests were made.'
        : 'Refresh completed after explicit consent and action.';
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Refresh failed.';
    }
  }
</script>

<section aria-labelledby="privacy-settings-heading">
  <p class="eyebrow">Local-first privacy controls</p>
  <h1 id="privacy-settings-heading">Privacy and consent</h1>
  <p>
    Refresh consent and storage consent are independent. Revoking either consent takes effect immediately without deleting valid local analysis.
  </p>

  <fieldset>
    <legend>Refresh consent</legend>
    <label>
      <input
        bind:this={refreshControl}
        type="checkbox"
        checked={refreshConsent}
        onchange={(event) => setRefreshConsent(event.currentTarget.checked)}
        aria-describedby="refresh-consent-help"
      />
      Allow explicit refresh requests
    </label>
    <p id="refresh-consent-help">
      When disabled, opening, resuming and choosing refresh remain local-only and produce zero network requests.
    </p>
    <button type="button" onclick={() => setRefreshConsent(false)} disabled={!refreshConsent}>
      Revoke refresh consent
    </button>
  </fieldset>

  <fieldset>
    <legend>Storage consent</legend>
    <label>
      <input
        bind:this={storageControl}
        type="checkbox"
        checked={storageConsent}
        onchange={(event) => setStorageConsent(event.currentTarget.checked)}
        aria-describedby="storage-consent-help"
      />
      Save confirmed analysis on this device
    </label>
    <p id="storage-consent-help">
      Analysis can always run in memory. Local persistence is attempted only while this consent is granted.
    </p>
    <button type="button" onclick={() => setStorageConsent(false)} disabled={!storageConsent}>
      Revoke storage consent
    </button>
  </fieldset>

  <div class="actions" aria-label="Consent verification actions">
    <button type="button" onclick={() => { void runMemoryAnalysis(); }}>
      Run local analysis
    </button>
    <button type="button" onclick={() => { void requestRefresh(); }}>
      Check for updates
    </button>
  </div>

  <p
    data-testid="privacy-status"
    role={statusKind}
    aria-live={statusKind === 'alert' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >
    {statusMessage}
  </p>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    max-inline-size: 68ch;
  }

  .eyebrow,
  legend {
    font-weight: 700;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
  }

  h1,
  p {
    margin-block: 0;
  }

  fieldset {
    display: grid;
    gap: 0.75rem;
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-weight: 700;
  }

  input[type='checkbox'] {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button {
    min-block-size: 2.75rem;
  }
</style>
