<script lang="ts">
  import type { RestoreConflictPolicy } from '../../persistence/restore-service';
  import type { RestorePreview as RestorePreviewModel } from '../../persistence/restore-preview';

  export let preview: RestorePreviewModel;
  export let conflictPolicy: RestoreConflictPolicy = 'reject';
  export let busy = false;
  export let onpolicychange: ((policy: RestoreConflictPolicy) => void) | undefined = undefined;
  export let onrestore: (() => void) | undefined = undefined;
  export let oncancel: (() => void) | undefined = undefined;

  const recordLabels = {
    fundamentalSnapshot: 'Fundamental snapshots',
    fundamentalBundle: 'Fundamental bundles',
    fundamentalAnalysis: 'Fundamental analyses',
    historicalPriceOverlay: 'Historical price overlays',
    priceAnalysis: 'Price analyses',
    activePointer: 'Active pointers',
    commitRecord: 'Commit records',
  } as const;

  $: canRestore = !busy && (preview.conflicts.length === 0 || conflictPolicy === 'replace_matching_record_ids');
</script>

<section class="preview" aria-labelledby="restore-preview-heading" data-testid="restore-preview">
  <h2 id="restore-preview-heading">Restore preview</h2>
  <p>
    Review the package before any local write. The operation is atomic and does not use the network.
  </p>

  <dl>
    <div><dt>Package version</dt><dd>{preview.formatVersion}</dd></div>
    <div><dt>Target version</dt><dd>{preview.targetFormatVersion}</dd></div>
    <div><dt>Estimated writes</dt><dd>{preview.estimatedWrites}</dd></div>
    <div><dt>Issuers</dt><dd>{preview.issuerCiks.length === 0 ? 'None' : preview.issuerCiks.join(', ')}</dd></div>
    <div><dt>Price overlays</dt><dd>{preview.overlayCount}</dd></div>
  </dl>

  {#if preview.migrationPlan}
    <p class="notice" data-testid="restore-migration">
      Allowed migration: {preview.migrationPlan.sourceVersion} → {preview.migrationPlan.targetVersion}.
      It will be applied only after explicit confirmation.
    </p>
  {/if}

  <h3>Records</h3>
  <ul>
    {#each Object.entries(preview.recordCountsByKind) as [kind, count]}
      <li>{recordLabels[kind as keyof typeof recordLabels]}: {count}</li>
    {/each}
  </ul>

  <h3>Conflicts</h3>
  {#if preview.conflicts.length === 0}
    <p>No conflicts were found.</p>
  {:else}
    <p id="restore-conflict-help">
      Existing record IDs were found. Replacement is restricted to the exact IDs shown below.
    </p>
    <ul data-testid="restore-conflicts">
      {#each preview.conflicts as conflict}
        <li>
          <code>{conflict.recordKind}:{conflict.recordId}</code>
          — {conflict.identical ? 'identical' : 'different content'}
        </li>
      {/each}
    </ul>
    <fieldset aria-describedby="restore-conflict-help">
      <legend>Conflict policy</legend>
      <label>
        <input
          type="radio"
          name="restore-conflict-policy"
          value="reject"
          checked={conflictPolicy === 'reject'}
          onchange={() => onpolicychange?.('reject')}
        />
        Reject restore
      </label>
      <label>
        <input
          type="radio"
          name="restore-conflict-policy"
          value="replace_matching_record_ids"
          checked={conflictPolicy === 'replace_matching_record_ids'}
          onchange={() => onpolicychange?.('replace_matching_record_ids')}
        />
        Replace only matching record IDs
      </label>
    </fieldset>
  {/if}

  <div class="actions">
    <button type="button" onclick={() => oncancel?.()} disabled={busy}>Cancel</button>
    <button
      type="button"
      onclick={() => onrestore?.()}
      disabled={!canRestore}
      aria-describedby={preview.conflicts.length > 0 ? 'restore-conflict-help' : undefined}
    >
      {busy ? 'Restoring…' : 'Confirm atomic restore'}
    </button>
  </div>
</section>

<style>
  .preview {
    display: grid;
    gap: 0.9rem;
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
  }
  h2, h3, p, ul, dl { margin-block: 0; }
  dl { display: grid; gap: 0.5rem; }
  dl div { display: grid; grid-template-columns: minmax(9rem, 1fr) 2fr; gap: 0.75rem; }
  dt { font-weight: 700; }
  dd { margin: 0; overflow-wrap: anywhere; }
  fieldset { display: grid; gap: 0.5rem; border: 1px solid currentColor; }
  label { display: flex; gap: 0.6rem; align-items: flex-start; }
  .notice { border-inline-start: 0.35rem solid currentColor; padding-inline-start: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button { min-block-size: 2.75rem; }
</style>
