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
      <div class="policy-option">
        <input
          id="restore-conflict-reject"
          type="radio"
          name="restore-conflict-policy"
          value="reject"
          checked={conflictPolicy === 'reject'}
          onchange={() => onpolicychange?.('reject')}
        />
        <label for="restore-conflict-reject">Reject restore when conflicts exist</label>
      </div>
      <div class="policy-option">
        <input
          id="restore-conflict-replace"
          type="radio"
          name="restore-conflict-policy"
          value="replace_matching_record_ids"
          checked={conflictPolicy === 'replace_matching_record_ids'}
          onchange={() => onpolicychange?.('replace_matching_record_ids')}
        />
        <label for="restore-conflict-replace">Replace only matching record IDs</label>
      </div>
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
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    border: 2px solid currentColor;
    border-radius: 0.5rem;
    padding: 1rem;
    inline-size: 100%;
    min-inline-size: 0;
    position: relative;
    z-index: 1;
    isolation: isolate;
  }
  .preview > * { min-inline-size: 0; }
  h2, h3, p, ul, dl { margin-block: 0; }
  ul { padding-inline-start: 1.25rem; }
  li, code { min-inline-size: 0; overflow-wrap: anywhere; }
  dl { display: grid; gap: 0.5rem; }
  dl div { display: grid; grid-template-columns: minmax(9rem, 1fr) 2fr; gap: 0.75rem; min-inline-size: 0; }
  dt { font-weight: 700; }
  dd { margin: 0; overflow-wrap: anywhere; min-inline-size: 0; }
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid currentColor;
    min-inline-size: 0;
    position: relative;
    z-index: 2;
  }
  .policy-option {
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    gap: 0.6rem;
    align-items: start;
    min-inline-size: 0;
    min-block-size: 2.75rem;
    padding: 0.5rem;
    position: relative;
    z-index: 3;
  }
  .policy-option input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
  }
  .policy-option label {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1.5rem minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    cursor: pointer;
    pointer-events: none;
  }
  .policy-option label::before {
    content: '';
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin-block-start: 0.1rem;
    border: 2px solid currentColor;
    border-radius: 50%;
    background: transparent;
  }
  .policy-option input:checked + label::before {
    background: radial-gradient(circle, currentColor 0 38%, transparent 42%);
  }
  .policy-option input:focus-visible + label {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }
  .notice { border-inline-start: 0.35rem solid currentColor; padding-inline-start: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; position: relative; z-index: 2; }
  button { min-block-size: 2.75rem; }
  @media (max-width: 36rem) {
    dl div { grid-template-columns: 1fr; gap: 0.1rem; }
  }
</style>
