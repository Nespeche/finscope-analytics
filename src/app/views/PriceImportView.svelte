<script module lang="ts">
  import { writable } from 'svelte/store';
  import type { RouteDefinition } from '../composition';
  import type {
    PriceEventResult,
    PricePersistenceState,
  } from '../../domain/orchestration/price-events';

  export const routeDefinition = {
    id: 'price-import',
    label: 'Price import',
    order: 70,
    requiredCapabilities: ['historical_price_import', 'historical_price_overlay', 'evidence'],
  } as const satisfies RouteDefinition;

  export const fundamentalDisplayContext = Object.freeze({
    issuerName: 'Apple Inc.',
    issuerCik: '0000320193',
    symbol: 'AAPL',
    venueMic: 'XNAS',
    currency: 'USD',
    reportingPeriod: 'FY 2025',
    analysisProfile: 'us-gaap-industrial-v1',
    snapshotId: 'fundamental-snapshot-0000320193-fy2025',
  });

  const fundamentalArtifacts = Object.freeze({
    bundles: Object.freeze({
      'fundamental-bundle-0000320193-fy2025': Object.freeze({
        bundleId: 'fundamental-bundle-0000320193-fy2025',
        issuerCik: fundamentalDisplayContext.issuerCik,
        reportingPeriod: fundamentalDisplayContext.reportingPeriod,
      }),
    }),
    analyses: Object.freeze({
      'fundamental-analysis-0000320193-fy2025': Object.freeze({
        analysisId: 'fundamental-analysis-0000320193-fy2025',
        analysisKind: 'fundamental',
      }),
    }),
    snapshots: Object.freeze({
      [fundamentalDisplayContext.snapshotId]: Object.freeze({
        snapshotId: fundamentalDisplayContext.snapshotId,
        issuerCik: fundamentalDisplayContext.issuerCik,
      }),
    }),
    activeSnapshotPointers: Object.freeze({
      [fundamentalDisplayContext.issuerCik]: Object.freeze({
        snapshotId: fundamentalDisplayContext.snapshotId,
        generation: 1,
      }),
    }),
    fingerprints: Object.freeze({
      fundamentalInputFingerprint: `sha256:${'1'.repeat(64)}`,
      fundamentalAnalysisFingerprint: `sha256:${'2'.repeat(64)}`,
    }),
  });

  export interface PriceWorkspaceSnapshot {
    readonly persistence: PricePersistenceState;
    readonly lastEvent?: PriceEventResult['event'];
    readonly affected: readonly string[];
    readonly unaffected: readonly string[];
  }

  function initialWorkspace(): PriceWorkspaceSnapshot {
    return Object.freeze({
      persistence: Object.freeze({
        fundamental: fundamentalArtifacts,
        priceOverlays: Object.freeze({}),
        priceAnalyses: Object.freeze({}),
        activePricePointers: Object.freeze({}),
      }),
      affected: Object.freeze([]),
      unaffected: Object.freeze([]),
    });
  }

  export const priceWorkspace = writable<PriceWorkspaceSnapshot>(initialWorkspace());

  export function resetPriceWorkspace(): void {
    priceWorkspace.set(initialWorkspace());
  }
</script>

<script lang="ts">
  import { get } from 'svelte/store';
  import { tick } from 'svelte';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import PriceImportPreview from '../components/PriceImportPreview.svelte';
  import {
    applyHistoricalPriceDeletion,
    applyHistoricalPriceImport,
    applyHistoricalPriceReplacement,
  } from '../../domain/orchestration/price-events';
  import {
    confirmHistoricalPriceImport,
    createHistoricalPriceImportPreview,
    publishConfirmedHistoricalPriceImport,
    type DuplicateDateResolution,
    type HistoricalPriceAdjustmentStatus,
    type HistoricalPriceFrequency,
    type HistoricalPriceImportMethod,
    type HistoricalPriceImportPreview,
  } from '../../domain/price/import-preview';
  import {
    normalizeHistoricalPriceObservation,
    parseHistoricalPriceCsv,
    PriceCsvError,
  } from '../../domain/price/csv-parser';
  import { normalizeManualHistoricalPriceEntries } from '../../domain/price/manual-entry';
  import { buildHistoricalPriceOverlay } from '../../domain/price/overlay-builder';
  import { buildPriceAnalysis } from '../../domain/price/price-metrics';
  import type { HistoricalPriceObservation } from '../../domain/price/types';

  type StatusKind = 'status' | 'error';

  let importMethod: HistoricalPriceImportMethod = 'manual_entry';
  let frequency: HistoricalPriceFrequency = 'irregular';
  let adjustmentStatus: HistoricalPriceAdjustmentStatus = 'unadjusted';
  let duplicateResolution: DuplicateDateResolution = 'reject';
  let manualDate = '';
  let manualPrice = '';
  let manualDateError: string | undefined;
  let manualPriceError: string | undefined;
  let csvError: string | undefined;
  let manualObservations: readonly HistoricalPriceObservation[] = [];
  let csvObservations: readonly HistoricalPriceObservation[] = [];
  let sourceFileSha256: string | undefined;
  let selectedFileName = '';
  let preview: HistoricalPriceImportPreview | undefined;
  let previewSequence = 0;
  let publishDialogOpen = false;
  let deleteDialogOpen = false;
  let busy = false;
  let statusKind: StatusKind = 'status';
  let statusMessage = 'No price overlay is active. Fundamental analysis remains fully available.';
  let manualDateInput: HTMLInputElement;

  $: activePointer = $priceWorkspace.persistence.activePricePointers[fundamentalDisplayContext.issuerCik];
  $: mutationLabel = activePointer === undefined ? 'Import price overlay' : 'Replace price overlay';
  $: selectedObservations = importMethod === 'manual_entry' ? manualObservations : csvObservations;

  function clearFieldErrors(): void {
    manualDateError = undefined;
    manualPriceError = undefined;
    csvError = undefined;
  }

  function describeCaught(caught: unknown): string {
    if (caught instanceof Error) return caught.message;
    return String(caught);
  }

  function invalidatePreview(message: string): void {
    preview = undefined;
    statusKind = 'status';
    statusMessage = message;
  }

  function changeMethod(method: HistoricalPriceImportMethod): void {
    importMethod = method;
    clearFieldErrors();
    invalidatePreview(
      method === 'manual_entry'
        ? 'Manual entry selected. Add observations, then create a preview.'
        : 'CSV import selected. Choose a UTF-8 CSV with date and close columns.',
    );
  }

  function mapManualValidationErrors(): boolean {
    let valid = true;
    try {
      normalizeHistoricalPriceObservation(manualDate, '1');
    } catch (caught) {
      valid = false;
      manualDateError = caught instanceof PriceCsvError
        ? caught.message
        : 'Enter a valid ISO calendar date (YYYY-MM-DD).';
    }
    try {
      normalizeHistoricalPriceObservation('2000-01-01', manualPrice);
    } catch (caught) {
      valid = false;
      manualPriceError = caught instanceof PriceCsvError
        ? caught.message
        : 'Enter a positive canonical decimal price.';
    }
    return valid;
  }

  function addManualObservation(): void {
    manualDateError = undefined;
    manualPriceError = undefined;
    if (!mapManualValidationErrors()) {
      statusKind = 'error';
      statusMessage = 'Correct the manual date and price fields before adding the observation.';
      void tick().then(() => manualDateInput.focus());
      return;
    }
    try {
      const normalized = normalizeManualHistoricalPriceEntries([
        { date: manualDate, priceDecimal: manualPrice },
      ])[0];
      if (normalized === undefined) throw new TypeError('MANUAL_PRICE_ENTRY_NORMALIZATION_FAILED');
      manualObservations = Object.freeze([...manualObservations, normalized]);
      manualDate = '';
      manualPrice = '';
      invalidatePreview(
        `${manualObservations.length} manual observation${manualObservations.length === 1 ? '' : 's'} ready for preview.`,
      );
      void tick().then(() => manualDateInput.focus());
    } catch (caught) {
      statusKind = 'error';
      statusMessage = describeCaught(caught);
    }
  }

  function clearManualDraft(): void {
    manualObservations = [];
    manualDate = '';
    manualPrice = '';
    clearFieldErrors();
    invalidatePreview('Manual draft cleared. No persisted price state was changed.');
    void tick().then(() => manualDateInput.focus());
  }

  async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  }

  async function handleCsvFile(event: Event): Promise<void> {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) throw new TypeError('CSV_INPUT_EVENT_TARGET_INVALID');
    const file = input.files?.[0];
    csvError = undefined;
    preview = undefined;
    csvObservations = [];
    sourceFileSha256 = undefined;
    selectedFileName = file?.name ?? '';
    if (file === undefined) {
      csvError = 'Choose a CSV file.';
      statusKind = 'error';
      statusMessage = csvError;
      return;
    }
    busy = true;
    try {
      const bytes = await file.arrayBuffer();
      const parsed = parseHistoricalPriceCsv(new Uint8Array(bytes));
      sourceFileSha256 = await sha256Hex(bytes);
      csvObservations = parsed.observations;
      statusKind = 'status';
      statusMessage = `CSV parsed: ${parsed.rowCount} observations. Create a preview before publication.`;
    } catch (caught) {
      csvError = describeCaught(caught);
      statusKind = 'error';
      statusMessage = 'The CSV was rejected. Correct the file and choose it again.';
    } finally {
      busy = false;
    }
  }

  function createPreview(): void {
    clearFieldErrors();
    if (selectedObservations.length === 0) {
      statusKind = 'error';
      if (importMethod === 'manual_entry') {
        manualDateError = 'Add at least one valid manual observation before creating a preview.';
        statusMessage = manualDateError;
        void tick().then(() => manualDateInput.focus());
      } else {
        csvError = 'Choose and validate a CSV file before creating a preview.';
        statusMessage = csvError;
      }
      return;
    }
    try {
      previewSequence += 1;
      preview = createHistoricalPriceImportPreview({
        previewId: `price-preview-${previewSequence}`,
        scope: {
          issuerCik: fundamentalDisplayContext.issuerCik,
          instrument: {
            symbol: fundamentalDisplayContext.symbol,
            venueMic: fundamentalDisplayContext.venueMic,
          },
          currency: fundamentalDisplayContext.currency,
          frequency,
          adjustmentStatus,
        },
        source: {
          method: importMethod,
          profileId: 'local_csv_manual_v1',
          ...(sourceFileSha256 === undefined ? {} : { sourceFileSha256 }),
        },
        observations: selectedObservations,
        duplicateResolution,
      });
      statusKind = preview.publicationAllowed ? 'status' : 'error';
      statusMessage = preview.publicationAllowed
        ? 'Preview ready. No price state has been written.'
        : 'Preview contains blocking issues. Resolve them before confirmation.';
    } catch (caught) {
      statusKind = 'error';
      statusMessage = describeCaught(caught);
    }
  }

  function overlayKey(overlayId: string, overlayVersion: number): string {
    return `${overlayId}:${overlayVersion}`;
  }

  async function publishPreview(): Promise<void> {
    const currentPreview = preview;
    if (currentPreview === undefined) {
      statusKind = 'error';
      statusMessage = 'Create a valid preview before requesting publication.';
      return;
    }
    busy = true;
    try {
      const confirmed = confirmHistoricalPriceImport(currentPreview, true);
      await publishConfirmedHistoricalPriceImport(confirmed, async (confirmedImport) => {
        const before = get(priceWorkspace);
        const pointer = before.persistence.activePricePointers[fundamentalDisplayContext.issuerCik];
        const previousOverlay = pointer === undefined
          ? undefined
          : before.persistence.priceOverlays[overlayKey(pointer.overlayId, pointer.overlayVersion)];
        const overlayId = pointer?.overlayId
          ?? `price-overlay-${fundamentalDisplayContext.issuerCik}-${fundamentalDisplayContext.symbol.toLocaleLowerCase('en-US')}`;
        const overlayVersion = (pointer?.overlayVersion ?? 0) + 1;
        const overlay = await buildHistoricalPriceOverlay({
          overlayId,
          overlayVersion,
          confirmedImport,
          ...(previousOverlay === undefined ? {} : { previousOverlay }),
        });
        const analysis = await buildPriceAnalysis({
          analysisId: `price-analysis-${fundamentalDisplayContext.issuerCik}-v${overlayVersion}`,
          overlay,
          versions: Object.freeze({ metricCatalog: '5.0.1', historicalPriceOverlay: '5.0.0' }),
        });
        const eventResult = pointer === undefined
          ? applyHistoricalPriceImport(before.persistence, {
            overlay,
            analysis,
            expectedPointerGeneration: 0,
          })
          : applyHistoricalPriceReplacement(before.persistence, {
            overlay,
            analysis,
            expectedPointerGeneration: pointer.generation,
          });
        if (eventResult.state.fundamental !== before.persistence.fundamental) {
          throw new TypeError('FUNDAMENTAL_ARTIFACT_IDENTITY_CHANGED');
        }
        priceWorkspace.set(Object.freeze({
          persistence: eventResult.state,
          lastEvent: eventResult.event,
          affected: eventResult.affected,
          unaffected: eventResult.unaffected,
        }));
        statusKind = 'status';
        statusMessage = eventResult.event === 'historical_price_imported'
          ? `Price overlay version ${overlayVersion} imported. Fundamental artifacts are unchanged.`
          : `Price overlay version ${overlayVersion} replaced. Fundamental artifacts are unchanged.`;
      });
    } catch (caught) {
      statusKind = 'error';
      statusMessage = describeCaught(caught);
    } finally {
      busy = false;
    }
  }

  function requestDelete(): void {
    if (activePointer === undefined) {
      statusKind = 'status';
      statusMessage = 'No active price overlay exists. Fundamental analysis remains available.';
      return;
    }
    deleteDialogOpen = true;
  }

  function deleteActiveOverlay(): void {
    const before = get(priceWorkspace);
    const pointer = before.persistence.activePricePointers[fundamentalDisplayContext.issuerCik];
    if (pointer === undefined) {
      statusKind = 'error';
      statusMessage = 'The active price pointer was not found.';
      return;
    }
    try {
      const eventResult = applyHistoricalPriceDeletion(
        before.persistence,
        fundamentalDisplayContext.issuerCik,
        pointer.generation,
      );
      if (eventResult.state.fundamental !== before.persistence.fundamental) {
        throw new TypeError('FUNDAMENTAL_ARTIFACT_IDENTITY_CHANGED');
      }
      priceWorkspace.set(Object.freeze({
        persistence: eventResult.state,
        lastEvent: eventResult.event,
        affected: eventResult.affected,
        unaffected: eventResult.unaffected,
      }));
      statusKind = 'status';
      statusMessage = 'Price overlay deleted. Fundamental artifacts and the fundamental pointer are unchanged.';
    } catch (caught) {
      statusKind = 'error';
      statusMessage = describeCaught(caught);
    }
  }
</script>

<section aria-labelledby="price-import-heading" data-testid="price-import-view" aria-busy={busy}>
  <p class="eyebrow">Optional local price overlay</p>
  <h1 id="price-import-heading">Import historical prices</h1>
  <p>
    Price data is optional, local and separate from the fundamental bundle. Every import,
    replacement or deletion requires an explicit confirmation.
  </p>

  <aside aria-labelledby="price-import-context-heading">
    <h2 id="price-import-context-heading">Active fundamental context</h2>
    <dl>
      <div><dt>Issuer</dt><dd>{fundamentalDisplayContext.issuerName}</dd></div>
      <div><dt>CIK</dt><dd><code>{fundamentalDisplayContext.issuerCik}</code></dd></div>
      <div><dt>Instrument</dt><dd>{fundamentalDisplayContext.symbol} · {fundamentalDisplayContext.venueMic}</dd></div>
      <div><dt>Currency</dt><dd>{fundamentalDisplayContext.currency}</dd></div>
      <div><dt>Period</dt><dd>{fundamentalDisplayContext.reportingPeriod}</dd></div>
      <div><dt>Profile</dt><dd>{fundamentalDisplayContext.analysisProfile}</dd></div>
    </dl>
  </aside>

  <div
    id="price-import-status"
    class:error-status={statusKind === 'error'}
    role={statusKind === 'error' ? 'alert' : 'status'}
    aria-live={statusKind === 'error' ? 'assertive' : 'polite'}
    aria-atomic="true"
    tabindex="-1"
  >
    {statusMessage}
  </div>

  <form onsubmit={(event) => { event.preventDefault(); createPreview(); }}>
    <fieldset aria-describedby="price-import-method-help">
      <legend>Import method</legend>
      <p id="price-import-method-help">Choose one source. Changing method clears field errors and invalidates any existing preview without changing persisted data.</p>
      <label>
        <input
          type="radio"
          name="price-import-method"
          value="manual_entry"
          checked={importMethod === 'manual_entry'}
          onchange={() => changeMethod('manual_entry')}
        />
        Manual entry
      </label>
      <label>
        <input
          type="radio"
          name="price-import-method"
          value="csv_import"
          checked={importMethod === 'csv_import'}
          onchange={() => changeMethod('csv_import')}
        />
        CSV import
      </label>
    </fieldset>

    <div class="configuration-grid">
      <div class="field">
        <label for="price-frequency">Frequency</label>
        <select id="price-frequency" aria-describedby="price-frequency-help" bind:value={frequency} onchange={() => invalidatePreview('Frequency changed. Recreate the preview.')}>
          <option value="irregular">Irregular</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
        <p id="price-frequency-help">Declare the observation frequency represented by the imported series.</p>
      </div>
      <div class="field">
        <label for="price-adjustment">Adjustment disclosure</label>
        <select id="price-adjustment" aria-describedby="price-adjustment-help" bind:value={adjustmentStatus} onchange={() => invalidatePreview('Adjustment disclosure changed. Recreate the preview.')}>
          <option value="unadjusted">Unadjusted</option>
          <option value="adjusted">Adjusted</option>
          <option value="unknown">Unknown</option>
        </select>
        <p id="price-adjustment-help">State whether prices are adjusted, unadjusted, or unknown; this disclosure is retained in the overlay.</p>
      </div>
      <div class="field">
        <label for="price-duplicate-resolution">Duplicate-date resolution</label>
        <select id="price-duplicate-resolution" aria-describedby="price-duplicate-help" bind:value={duplicateResolution} onchange={() => invalidatePreview('Duplicate-date policy changed. Recreate the preview.')}>
          <option value="reject">Reject duplicates</option>
          <option value="keep_last">Keep last value</option>
        </select>
        <p id="price-duplicate-help">Reject duplicate dates or deterministically keep the last value before preview.</p>
      </div>
    </div>

    {#if importMethod === 'manual_entry'}
      <fieldset class="entry-panel">
        <legend>Manual observation</legend>
        <div class="configuration-grid">
          <div class="field">
            <label for="manual-price-date">Observation date (YYYY-MM-DD)</label>
            <input
              bind:this={manualDateInput}
              id="manual-price-date"
              name="manual-price-date"
              type="text"
              autocomplete="off"
              bind:value={manualDate}
              aria-invalid={manualDateError === undefined ? undefined : 'true'}
              aria-errormessage={manualDateError === undefined ? undefined : 'manual-price-date-error'}
              aria-describedby={manualDateError === undefined ? 'manual-price-date-description' : 'manual-price-date-description manual-price-date-error'}
            />
            <p id="manual-price-date-description">Use a real ISO calendar date.</p>
            {#if manualDateError !== undefined}<p id="manual-price-date-error" class="field-error" role="alert">{manualDateError}</p>{/if}
          </div>
          <div class="field">
            <label for="manual-price-value">Closing price</label>
            <input
              id="manual-price-value"
              name="manual-price-value"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              bind:value={manualPrice}
              aria-invalid={manualPriceError === undefined ? undefined : 'true'}
              aria-errormessage={manualPriceError === undefined ? undefined : 'manual-price-value-error'}
              aria-describedby={manualPriceError === undefined ? 'manual-price-value-description' : 'manual-price-value-description manual-price-value-error'}
            />
            <p id="manual-price-value-description">Enter a positive canonical decimal, for example 175.25.</p>
            {#if manualPriceError !== undefined}<p id="manual-price-value-error" class="field-error" role="alert">{manualPriceError}</p>{/if}
          </div>
        </div>
        <div class="actions">
          <Button label="Add manual observation" onclick={addManualObservation} />
          <Button label="Clear manual draft" disabled={manualObservations.length === 0} onclick={clearManualDraft} />
        </div>
        {#if manualObservations.length > 0}
          <table aria-label="Manual observations awaiting preview">
            <caption>Manual draft — not persisted</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Price</th></tr></thead>
            <tbody>
              {#each manualObservations as observation, index (`${observation.date}-${index}`)}
                <tr><td>{observation.date}</td><td>{observation.priceDecimal}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </fieldset>
    {:else}
      <fieldset class="entry-panel">
        <legend>CSV source</legend>
        <div class="field">
          <label for="historical-price-csv">CSV file</label>
          <input
            id="historical-price-csv"
            name="historical-price-csv"
            type="file"
            accept=".csv,text/csv"
            aria-invalid={csvError === undefined ? undefined : 'true'}
            aria-errormessage={csvError === undefined ? undefined : 'historical-price-csv-error'}
            aria-describedby={csvError === undefined ? 'historical-price-csv-description' : 'historical-price-csv-description historical-price-csv-error'}
            onchange={(event) => { void handleCsvFile(event); }}
          />
          <p id="historical-price-csv-description">Choose a UTF-8 CSV with a header and exactly the required date and close columns. The file is parsed locally; no data is persisted until preview and confirmation succeed.</p>
          {#if csvError !== undefined}<p id="historical-price-csv-error" class="field-error" role="alert">{csvError}</p>{/if}
          {#if selectedFileName.length > 0}<p>Selected file: <strong>{selectedFileName}</strong></p>{/if}
        </div>
      </fieldset>
    {/if}

    <div class="actions">
      <Button type="submit" label="Create price preview" busy={busy} />
    </div>
  </form>

  {#if preview !== undefined}
    <PriceImportPreview {preview} operationLabel={mutationLabel} />
    <div class="actions mutation-actions">
      <Button
        label={mutationLabel}
        disabled={!preview.publicationAllowed}
        busy={busy}
        onclick={() => { publishDialogOpen = true; }}
      />
    </div>
  {/if}

  <section class="active-overlay" aria-labelledby="active-price-overlay-heading">
    <h2 id="active-price-overlay-heading">Active price pointer</h2>
    {#if activePointer === undefined}
      <p data-testid="active-price-pointer">No active price overlay. Fundamental-only operation is complete.</p>
    {:else}
      <dl data-testid="active-price-pointer">
        <div><dt>Overlay ID</dt><dd><code>{activePointer.overlayId}</code></dd></div>
        <div><dt>Version</dt><dd>{activePointer.overlayVersion}</dd></div>
        <div><dt>Generation</dt><dd>{activePointer.generation}</dd></div>
        <div><dt>Analysis ID</dt><dd><code>{activePointer.analysisId}</code></dd></div>
      </dl>
    {/if}
    <button
      type="button"
      class="destructive"
      disabled={activePointer === undefined || busy}
      aria-describedby="delete-price-overlay-help"
      onclick={requestDelete}
    >
      Delete price overlay
    </button>
    <p id="delete-price-overlay-help">Deletes only the active historical price overlay and its price analysis after confirmation. Fundamental artifacts and pointers remain unchanged.</p>
  </section>

  <section class="isolation" aria-labelledby="price-isolation-heading">
    <h2 id="price-isolation-heading">Domain isolation</h2>
    <p data-testid="fundamental-input-fingerprint">
      Fundamental input fingerprint: <code>{$priceWorkspace.persistence.fundamental.fingerprints.fundamentalInputFingerprint}</code>
    </p>
    <p data-testid="fundamental-analysis-fingerprint">
      Fundamental analysis fingerprint: <code>{$priceWorkspace.persistence.fundamental.fingerprints.fundamentalAnalysisFingerprint}</code>
    </p>
    {#if $priceWorkspace.lastEvent !== undefined}
      <p>Last price event: <code>{$priceWorkspace.lastEvent}</code></p>
      <p>Affected: {$priceWorkspace.affected.join(', ')}.</p>
      <p>Unaffected: {$priceWorkspace.unaffected.join(', ')}.</p>
    {/if}
  </section>
</section>

<Dialog
  id="confirm-price-publication"
  bind:open={publishDialogOpen}
  title={activePointer === undefined ? 'Confirm price import' : 'Confirm price replacement'}
  description={`${mutationLabel} only after this explicit confirmation. Fundamental artifacts will not be changed.`}
  confirmLabel={mutationLabel}
  cancelLabel="Cancel"
  onconfirm={() => { void publishPreview(); }}
/>

<Dialog
  id="confirm-price-deletion"
  bind:open={deleteDialogOpen}
  title="Confirm price deletion"
  description="Delete the active price overlay and its price analysis. Fundamental artifacts and pointers remain unchanged."
  confirmLabel="Delete price overlay"
  cancelLabel="Cancel"
  destructive={true}
  onconfirm={deleteActiveOverlay}
/>

<style>
  section[aria-labelledby="price-import-heading"] {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 78rem;
  }

  .eyebrow {
    margin: 0;
    font-weight: 700;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-block: 0;
  }

  aside,
  .active-overlay,
  .isolation,
  .entry-panel {
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  dt {
    font-weight: 700;
  }

  dd {
    margin: 0;
  }

  #price-import-status {
    border-inline-start: 0.35rem solid currentColor;
    padding: 0.75rem;
    font-weight: 650;
  }

  #price-import-status.error-status,
  .field-error {
    font-weight: 700;
  }

  form,
  fieldset,
  .field {
    display: grid;
    gap: 0.75rem;
  }

  fieldset {
    margin: 0;
  }

  legend,
  label {
    font-weight: 700;
  }

  .configuration-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
  }

  input,
  select,
  button {
    min-block-size: 2.75rem;
    border: 2px solid currentColor;
    border-radius: 0.375rem;
    padding: 0.5rem 0.625rem;
    background: Canvas;
    color: CanvasText;
    font: inherit;
  }

  input[type='radio'] {
    min-block-size: auto;
  }

  .field p {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .mutation-actions {
    justify-content: flex-end;
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid currentColor;
    padding: 0.5rem;
    text-align: start;
  }

  caption {
    padding-block-end: 0.5rem;
    font-weight: 700;
    text-align: start;
  }

  button {
    cursor: pointer;
    font-weight: 650;
  }

  button.destructive {
    border-width: 3px;
  }

  button:disabled,
  button[aria-disabled='true'] {
    opacity: 0.65;
  }
</style>
