<script module lang="ts">
  import type { RouteDefinition } from '../composition';

  export const routeDefinition = {
    id: 'data-management',
    label: 'Data management',
    order: 85,
    requiredCapabilities: ['local_snapshot', 'export_restore', 'recovery'],
  } as const satisfies RouteDefinition;
</script>

<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { canonicalizeJson, type JsonValue } from '../../core/canonical-json';
  import { sha256Digest } from '../../core/sha256';
  import { parseCik, type Cik } from '../../domain/model';
  import { createConsentRepository } from '../../persistence/consent-repository';
  import { DeleteService, type DeleteAllPreparation } from '../../persistence/delete-service';
  import type { FinScopeStoreName } from '../../persistence/db-schema';
  import { LocalExportService, type LocalExportRecordKind } from '../../persistence/export-service';
  import {
    CorruptionQuarantine,
    openFinScopeDatabase,
    type QuarantinedRepositoryRecord,
  } from '../../persistence/indexeddb';
  import { PriceRepository } from '../../persistence/price-repository';
  import {
    RestoreService,
    type RestoreConflictPolicy,
  } from '../../persistence/restore-service';
  import {
    RestorePreviewService,
    type ExistingRestoreRecord,
    type RestorePreview as RestorePreviewModel,
  } from '../../persistence/restore-preview';
  import {
    createIndexedDbRepositoryStorage,
    SnapshotRepository,
    type AtomicRepositoryStorage,
    type RepositoryKey,
  } from '../../persistence/snapshot-repository';
  import Dialog from '../components/Dialog.svelte';
  import RestorePreview from '../components/RestorePreview.svelte';

  interface DataServices {
    readonly database: IDBDatabase;
    readonly storage: AtomicRepositoryStorage;
    readonly snapshots: SnapshotRepository;
    readonly prices: PriceRepository;
    readonly exporter: LocalExportService;
    readonly restorePreview: RestorePreviewService;
    readonly restore: RestoreService;
    readonly deletion: DeleteService;
    readonly quarantine: CorruptionQuarantine;
  }

  const consentRepository = createConsentRepository();
  let storageConsent = consentRepository.read('storageConsent').granted;
  let services: DataServices | undefined;
  let restorePreview: RestorePreviewModel | undefined;
  let restorePolicy: RestoreConflictPolicy = 'reject';
  let deletePreparation: DeleteAllPreparation | undefined;
  let showDeleteAllDialog = false;
  let showDeletePriceDialog = false;
  let priceIssuer = '';
  let priceIssuerError: string | undefined;
  let busy = false;
  let statusKind: 'status' | 'alert' = 'status';
  let statusMessage = 'Grant storage consent to inspect or change local data.';
  let quarantineEntries: readonly QuarantinedRepositoryRecord[] = [];
  let restoreFileInput: HTMLInputElement;
  let deleteAllButton: HTMLButtonElement;
  let deletePriceButton: HTMLButtonElement;
  let priceIssuerInput: HTMLInputElement;

  const STORE_BY_KIND: Readonly<Record<LocalExportRecordKind, FinScopeStoreName>> = {
    fundamentalSnapshot: 'fundamentalSnapshots',
    fundamentalBundle: 'fundamentalBundles',
    fundamentalAnalysis: 'fundamentalAnalyses',
    historicalPriceOverlay: 'priceOverlays',
    priceAnalysis: 'priceAnalyses',
    activePointer: 'activePointers',
    commitRecord: 'commitLog',
  };

  function recordKey(kind: LocalExportRecordKind, recordId: string): RepositoryKey {
    if (kind === 'historicalPriceOverlay') {
      const separator = recordId.lastIndexOf(':');
      return [recordId.slice(0, separator), Number(recordId.slice(separator + 1))];
    }
    if (kind === 'activePointer') {
      const separator = recordId.lastIndexOf(':');
      return [recordId.slice(0, separator), recordId.slice(separator + 1)];
    }
    return recordId;
  }

  async function createServices(): Promise<DataServices> {
    if (!storageConsent) throw new TypeError('Storage consent is required before opening IndexedDB.');
    if (services !== undefined) return services;
    const database = await openFinScopeDatabase();
    const storage = createIndexedDbRepositoryStorage(database);
    const quarantine = new CorruptionQuarantine();
    const snapshots = new SnapshotRepository(storage, quarantine);
    const prices = new PriceRepository(storage, quarantine);
    const exporter = new LocalExportService(snapshots, prices);
    const restorePreviewService = new RestorePreviewService({
      async find(kind: LocalExportRecordKind, id: string): Promise<ExistingRestoreRecord | undefined> {
        const payload = await storage.run([STORE_BY_KIND[kind]], 'readonly', async (transaction) => (
          await transaction.get<unknown>(STORE_BY_KIND[kind], recordKey(kind, id))
        ));
        if (payload === undefined) return undefined;
        const payloadSha256 = await sha256Digest(canonicalizeJson(payload as JsonValue));
        return Object.freeze({ payloadSha256 });
      },
    });
    const restore = new RestoreService(storage);
    const deletion = new DeleteService(storage, exporter);
    services = Object.freeze({
      database,
      storage,
      snapshots,
      prices,
      exporter,
      restorePreview: restorePreviewService,
      restore,
      deletion,
      quarantine,
    });
    return services;
  }

  function setStorageConsent(granted: boolean): void {
    storageConsent = consentRepository.set('storageConsent', granted).granted;
    if (!storageConsent) {
      services?.database.close();
      services = undefined;
      restorePreview = undefined;
      quarantineEntries = [];
      statusKind = 'status';
      statusMessage = 'Storage consent revoked. IndexedDB is closed and no new local write is allowed.';
    } else {
      statusKind = 'status';
      statusMessage = 'Storage consent granted. Local data operations require a separate explicit action.';
    }
  }

  function downloadJson(contents: string, filename: string): void {
    const href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function exportData(): Promise<void> {
    busy = true;
    try {
      const active = await createServices();
      const serialized = await active.exporter.serialize();
      downloadJson(serialized, 'finscope-local-data.json');
      statusKind = 'status';
      statusMessage = 'Local data export created. No network request was made.';
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Export failed.';
    } finally {
      busy = false;
    }
  }

  async function inspectIntegrity(): Promise<void> {
    busy = true;
    try {
      const active = await createServices();
      await Promise.all([active.snapshots.readAllRecords(), active.prices.readAllRecords()]);
      quarantineEntries = active.quarantine.list();
      statusKind = quarantineEntries.length === 0 ? 'status' : 'alert';
      statusMessage = quarantineEntries.length === 0
        ? 'Integrity check completed. No quarantined records were found.'
        : `${quarantineEntries.length} corrupt local record(s) were quarantined without deletion. Restore a validated backup or delete local data to recover.`;
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Integrity check failed.';
    } finally {
      busy = false;
    }
  }

  async function selectRestoreFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;
    busy = true;
    try {
      const active = await createServices();
      restorePreview = await active.restorePreview.preview(new Uint8Array(await file.arrayBuffer()));
      restorePolicy = 'reject';
      statusKind = 'status';
      statusMessage = 'Restore package validated. Review the preview before confirming.';
    } catch (caught: unknown) {
      restorePreview = undefined;
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Restore preview failed.';
    } finally {
      busy = false;
      input.value = '';
    }
  }

  async function confirmRestore(): Promise<void> {
    if (restorePreview === undefined) return;
    busy = true;
    try {
      const active = await createServices();
      const authorization = active.restore.authorize({
        preview: restorePreview,
        storageConsentGranted: storageConsent,
        explicitConfirmation: true,
        conflictPolicy: restorePolicy,
      });
      const result = await active.restore.restore(authorization);
      restorePreview = undefined;
      await inspectIntegrity();
      statusKind = 'status';
      statusMessage = `Atomic restore completed: ${result.writtenRecords} record(s), ${result.replacedRecords} replacement(s).`;
      await tick();
      restoreFileInput.focus();
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Restore failed and was rolled back.';
    } finally {
      busy = false;
    }
  }

  async function prepareDeleteAll(): Promise<void> {
    busy = true;
    try {
      const active = await createServices();
      deletePreparation = await active.deletion.prepareDeleteAll(true);
      if (deletePreparation.backup !== undefined) {
        downloadJson(
          canonicalizeJson(deletePreparation.backup as unknown as JsonValue),
          'finscope-pre-delete-backup.json',
        );
      }
      showDeleteAllDialog = true;
      statusKind = 'status';
      statusMessage = 'A pre-delete backup was offered and generated. Confirm deletion in the dialog.';
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Delete preparation failed.';
    } finally {
      busy = false;
    }
  }

  async function confirmDeleteAll(): Promise<void> {
    const preparation = deletePreparation;
    if (preparation === undefined) return;
    busy = true;
    try {
      const active = await createServices();
      const result = await active.deletion.deleteAll(preparation, true);
      deletePreparation = undefined;
      restorePreview = undefined;
      quarantineEntries = [];
      statusKind = 'status';
      statusMessage = `All personal data was deleted atomically (${result.deletedRecords} record(s)).`;
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Delete failed and was rolled back.';
    } finally {
      busy = false;
      await tick();
      deleteAllButton.focus();
    }
  }

  function requestDeletePrice(): void {
    priceIssuerError = undefined;
    try {
      parseCik(priceIssuer);
      showDeletePriceDialog = true;
    } catch (caught: unknown) {
      priceIssuerError = caught instanceof Error ? caught.message : 'Enter exactly ten digits, including leading zeroes.';
      statusKind = 'alert';
      statusMessage = `Issuer CIK error. ${priceIssuerError}`;
      void tick().then(() => priceIssuerInput.focus());
    }
  }

  async function confirmDeletePrice(): Promise<void> {
    busy = true;
    try {
      priceIssuerError = undefined;
      const issuerCik: Cik = parseCik(priceIssuer);
      const active = await createServices();
      const count = await active.deletion.deletePriceHistory(issuerCik);
      statusKind = 'status';
      statusMessage = `Historical price data deleted for ${issuerCik} (${count} record(s)); fundamental snapshots were preserved.`;
    } catch (caught: unknown) {
      statusKind = 'alert';
      statusMessage = caught instanceof Error ? caught.message : 'Price deletion failed and was rolled back.';
    } finally {
      busy = false;
      await tick();
      deletePriceButton.focus();
    }
  }

  onDestroy(() => {
    services?.database.close();
  });
</script>

<svelte:head><title>Data management | FinScope Analytics</title></svelte:head>

<section aria-labelledby="data-management-heading" aria-busy={busy}>
  <p class="eyebrow">Local-only personal data</p>
  <h1 id="data-management-heading">Data management</h1>
  <p>
    Export, validate, restore and delete local data. These operations do not contact external services.
  </p>

  <fieldset>
    <legend>Storage consent</legend>
    <label>
      <input
        type="checkbox"
        aria-describedby="storage-data-help"
        checked={storageConsent}
        onchange={(event) => setStorageConsent(event.currentTarget.checked)}
      />
      Allow this view to open and change IndexedDB
    </label>
    <p id="storage-data-help">Consent is checked before the database is opened. Every destructive action still requires confirmation.</p>
  </fieldset>

  <p id="local-data-action-help">Export downloads a deterministic local JSON file. Integrity check only reads local repositories. Restore first validates and previews a selected JSON package.</p>

  <div class="actions" aria-label="Local data actions" aria-describedby="local-data-action-help">
    <button type="button" disabled={!storageConsent || busy} onclick={() => { void exportData(); }}>
      Export local data
    </button>
    <button type="button" disabled={!storageConsent || busy} onclick={() => { void inspectIntegrity(); }}>
      Check local data integrity
    </button>
    <label class="file-action" aria-disabled={!storageConsent || busy}>
      Preview restore file
      <input
        bind:this={restoreFileInput}
        type="file"
        aria-describedby="local-data-action-help"
        accept="application/json,.json"
        disabled={!storageConsent || busy}
        onchange={(event) => { void selectRestoreFile(event); }}
      />
    </label>
  </div>

  {#if restorePreview}
    <RestorePreview
      preview={restorePreview}
      conflictPolicy={restorePolicy}
      {busy}
      onpolicychange={(policy) => { restorePolicy = policy; }}
      onrestore={() => { void confirmRestore(); }}
      oncancel={() => { restorePreview = undefined; void tick().then(() => restoreFileInput.focus()); }}
    />
  {/if}

  {#if quarantineEntries.length > 0}
    <section class="recovery" aria-labelledby="quarantine-heading" data-testid="corruption-recovery">
      <h2 id="quarantine-heading">Corruption recovery</h2>
      <p>Quarantined records remain untouched and are excluded from active data and exports.</p>
      <ul>
        {#each quarantineEntries as entry}
          <li><code>{entry.quarantineId}</code>: {entry.message}</li>
        {/each}
      </ul>
      <p>Recovery is available through a validated restore or confirmed deletion below.</p>
    </section>
  {/if}

  <section class="destructive" aria-labelledby="delete-price-heading">
    <h2 id="delete-price-heading">Delete historical price data</h2>
    <label for="price-delete-cik">Issuer CIK for price-history deletion</label>
    <input
      bind:this={priceIssuerInput}
      id="price-delete-cik"
      name="price-delete-cik"
      bind:value={priceIssuer}
      inputmode="numeric"
      pattern="[0-9]{10}"
      maxlength="10"
      autocomplete="off"
      aria-invalid={priceIssuerError === undefined ? undefined : 'true'}
      aria-errormessage={priceIssuerError === undefined ? undefined : 'price-delete-cik-error'}
      aria-describedby={priceIssuerError === undefined ? 'price-delete-cik-help' : 'price-delete-cik-help price-delete-cik-error'}
    />
    <p id="price-delete-cik-help">Enter the authoritative zero-padded ten-digit CIK. Only price data for this issuer is included.</p>
    {#if priceIssuerError !== undefined}<p id="price-delete-cik-error" class="field-error">{priceIssuerError}</p>{/if}
    <button
      bind:this={deletePriceButton}
      type="button"
      disabled={!storageConsent || busy || priceIssuer.trim().length === 0}
      aria-describedby="price-delete-cik-help price-delete-consequence"
      onclick={requestDeletePrice}
    >
      Delete price history
    </button>
    <p id="price-delete-consequence">Fundamental bundles, analyses and snapshots are not included in this transaction. A confirmation dialog names the affected data before deletion.</p>
  </section>

  <section class="destructive" aria-labelledby="delete-all-heading">
    <h2 id="delete-all-heading">Delete all personal data</h2>
    <p>A deterministic local backup is offered before the atomic deletion transaction begins.</p>
    <button
      bind:this={deleteAllButton}
      type="button"
      disabled={!storageConsent || busy}
      onclick={() => { void prepareDeleteAll(); }}
    >
      Export backup and delete all data
    </button>
  </section>

  <p
    data-testid="data-management-status"
    role={statusKind}
    aria-live={statusKind === 'alert' ? 'assertive' : 'polite'}
    aria-atomic="true"
    tabindex="-1"
  >
    {statusMessage}
  </p>
</section>

<Dialog
  id="delete-price-dialog"
  bind:open={showDeletePriceDialog}
  title="Delete historical price data?"
  description="This removes only price overlays, price analyses, their pointer and price commit records for the selected issuer."
  confirmLabel="Delete price history"
  destructive={true}
  onconfirm={() => { void confirmDeletePrice(); }}
  oncancel={() => { void tick().then(() => deletePriceButton.focus()); }}
/>

<Dialog
  id="delete-all-dialog"
  bind:open={showDeleteAllDialog}
  title="Delete all personal data?"
  description={`The backup was offered. ${deletePreparation?.recordCount ?? 0} local record(s) will be deleted in one transaction.`}
  confirmLabel="Delete all personal data"
  destructive={true}
  onconfirm={() => { void confirmDeleteAll(); }}
  oncancel={() => { deletePreparation = undefined; void tick().then(() => deleteAllButton.focus()); }}
/>

<style>
  section { display: grid; gap: 1rem; max-inline-size: 72ch; }
  .eyebrow { font-weight: 700; text-transform: uppercase; }
  h1, h2, p, ul { margin-block: 0; }
  fieldset, .destructive, .recovery {
    display: grid;
    gap: 0.75rem;
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  label { font-weight: 650; }
  .field-error { font-weight: 700; }
  fieldset label { display: flex; gap: 0.7rem; align-items: flex-start; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button, input, .file-action { min-block-size: 2.75rem; font: inherit; }
  button, .file-action { border: 2px solid currentColor; border-radius: 0.375rem; padding: 0.625rem 1rem; }
  .file-action { display: inline-flex; align-items: center; cursor: pointer; }
  .file-action input { position: absolute; inline-size: 1px; block-size: 1px; clip-path: inset(50%); }
  .file-action[aria-disabled='true'] { opacity: 0.55; cursor: not-allowed; }
  .destructive { border-width: 3px; }
  code { overflow-wrap: anywhere; }
</style>
