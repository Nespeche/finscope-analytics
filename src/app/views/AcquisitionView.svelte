<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'acquisition',
    label: 'SEC acquisition',
    order: 20,
    requiredCapabilities: ['issuer_identity', 'filings', 'evidence'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import NetworkConsent from '../components/NetworkConsent.svelte';

  type AcquisitionUiState = 'idle' | 'checking' | 'acquiring' | 'complete' | 'partial' | 'failed' | 'cancelled';

  let cik = '0000320193';
  let networkConsent = false;
  let state: AcquisitionUiState = 'idle';
  let statusMessage = 'No network request has started.';
  let operationController: AbortController | undefined;
  let completedUnits = 0;
  const totalUnits = 2;
  let lastSnapshot = 'No active local snapshot';
  let cikError: string | undefined;

  $: busy = state === 'checking' || state === 'acquiring';
  $: showRetry = state === 'failed' || state === 'partial' || state === 'cancelled';
  $: statusRole = state === 'failed' || state === 'cancelled' ? 'alert' : 'status';

  function updateConsent(granted: boolean): void {
    networkConsent = granted;
    if (!granted && !busy) {
      statusMessage = 'Network consent is off. Manual refresh remains available.';
    }
  }

  function validateCik(value: string): string | undefined {
    return /^\d{10}$/u.test(value) ? value : undefined;
  }

  async function fetchRequiredResource(pathname: string, signal: AbortSignal): Promise<void> {
    const response = await fetch(pathname, {
      method: 'GET',
      headers: { accept: 'application/json, application/problem+json' },
      signal,
    });
    if (!response.ok) {
      throw new Error(`SEC gateway returned HTTP ${response.status}.`);
    }
    await response.json();
  }

  async function startAcquisition(): Promise<void> {
    if (busy) return;
    const normalizedCik = validateCik(cik);
    if (normalizedCik === undefined) {
      cikError = 'Enter exactly ten digits, including leading zeroes when required.';
      state = 'failed';
      statusMessage = 'The issuer CIK is invalid. Correct the field before updating.';
      return;
    }
    cikError = undefined;
    if (!networkConsent) {
      state = 'idle';
      statusMessage = 'Grant network consent, then choose Update fundamentals again.';
      return;
    }

    const controller = new AbortController();
    operationController = controller;
    completedUnits = 0;
    state = 'checking';
    statusMessage = `Checking SEC filings for CIK ${normalizedCik}.`;

    try {
      state = 'acquiring';
      statusMessage = 'Acquiring SEC submissions (1 of 2).';
      await fetchRequiredResource(`/issuers/${normalizedCik}/submissions`, controller.signal);
      completedUnits = 1;

      statusMessage = 'Acquiring SEC Company Facts (2 of 2).';
      await fetchRequiredResource(`/issuers/${normalizedCik}/company-facts`, controller.signal);
      completedUnits = 2;

      state = 'complete';
      lastSnapshot = `SEC candidate ready for CIK ${normalizedCik}; activation requires later normalization.`;
      statusMessage = 'SEC acquisition completed. The prior active snapshot remains selected until publication.';
    } catch (error: unknown) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        state = 'cancelled';
        statusMessage = 'SEC acquisition cancelled. The prior active snapshot was preserved.';
      } else {
        state = completedUnits > 0 ? 'partial' : 'failed';
        statusMessage = completedUnits > 0
          ? 'SEC acquisition is partial. The prior active snapshot was preserved; retry is available.'
          : 'SEC acquisition failed. The prior active snapshot was preserved; retry is available.';
      }
    } finally {
      if (operationController === controller) operationController = undefined;
    }
  }

  function cancelAcquisition(): void {
    operationController?.abort('user_requested');
  }
</script>

<section aria-labelledby="acquisition-heading" aria-busy={busy}>
  <p class="eyebrow">Manual, consented acquisition</p>
  <h1 id="acquisition-heading">Acquire SEC filings and Company Facts</h1>
  <p>
    Requests run only after explicit consent and a manual action. Cancellation, partial results, and failures never replace the active local snapshot.
  </p>

  <label for="acquisition-cik">Issuer CIK</label>
  <input
    id="acquisition-cik"
    name="acquisition-cik"
    inputmode="numeric"
    pattern="[0-9]{10}"
    maxlength="10"
    bind:value={cik}
    disabled={busy}
    aria-invalid={cikError === undefined ? undefined : 'true'}
    aria-errormessage={cikError === undefined ? undefined : 'acquisition-cik-error'}
    aria-describedby={cikError === undefined ? 'acquisition-cik-help' : 'acquisition-cik-help acquisition-cik-error'}
  />
  <small id="acquisition-cik-help">Use the authoritative zero-padded ten-digit CIK. Starting acquisition performs two consented SEC requests; cancellation or failure preserves the current snapshot.</small>
  {#if cikError !== undefined}
    <p id="acquisition-cik-error" class="field-error" role="alert">{cikError}</p>
  {/if}

  <NetworkConsent
    granted={networkConsent}
    disabled={busy}
    onConsentChange={updateConsent}
  />

  <div class="actions" aria-label="SEC acquisition actions">
    <button type="button" onclick={() => { void startAcquisition(); }} disabled={busy}>
      {showRetry ? 'Retry acquisition' : 'Update fundamentals'}
    </button>
    <button type="button" onclick={cancelAcquisition} disabled={!busy}>
      Cancel acquisition
    </button>
  </div>

  <div class="progress" aria-labelledby="acquisition-progress-heading" aria-describedby="acquisition-progress-description">
    <h2 id="acquisition-progress-heading" class="visually-hidden">Acquisition progress</h2>
    <progress max={totalUnits} value={completedUnits} aria-label={`Completed ${completedUnits} of ${totalUnits} SEC resources`}>{completedUnits} of {totalUnits}</progress>
    <span id="acquisition-progress-description">{completedUnits} of {totalUnits} required SEC resources completed</span>
  </div>

  <p
    id="acquisition-status"
    role={statusRole}
    aria-live={statusRole === 'alert' ? 'assertive' : 'polite'}
    aria-atomic="true"
  >
    {statusMessage}
  </p>

  <aside aria-labelledby="snapshot-preservation-heading">
    <h2 id="snapshot-preservation-heading">Active snapshot protection</h2>
    <p>{lastSnapshot}</p>
  </aside>
</section>

<style>
  section {
    max-inline-size: 68ch;
  }

  .eyebrow,
  label {
    font-weight: 700;
  }

  .field-error { font-weight: 700; }
  .visually-hidden { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); }

  .eyebrow {
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  input {
    display: block;
    inline-size: min(100%, 22rem);
    min-block-size: 2.75rem;
  }

  small {
    display: block;
    margin-block-start: 0.25rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button {
    min-block-size: 2.75rem;
  }

  .progress {
    display: grid;
    gap: 0.35rem;
    margin-block-start: 1rem;
  }

  progress {
    inline-size: min(100%, 32rem);
  }

  aside {
    border-inline-start: 0.25rem solid currentColor;
    margin-block-start: 1.5rem;
    padding-inline-start: 1rem;
  }
</style>
