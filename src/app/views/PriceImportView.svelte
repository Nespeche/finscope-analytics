<script module lang="ts">
  import { get as getStoreValue, writable } from 'svelte/store';
  import type { RouteDefinition } from '../composition';
  import type {
    FundamentalArtifacts,
    PriceEventResult,
    PricePersistenceState,
  } from '../../domain/orchestration/price-events';
  import {
    activeFundamentalContext,
    type FundamentalDisplayContext,
  } from './IssuerSearchView.svelte';

  export const routeDefinition = {
    id: 'price-import',
    label: 'Price import',
    order: 70,
    requiredCapabilities: ['historical_price_import', 'historical_price_overlay', 'evidence'],
  } as const satisfies RouteDefinition;

  let currentFundamentalDisplayContext = getStoreValue(activeFundamentalContext);

  export const fundamentalDisplayContext: FundamentalDisplayContext = Object.freeze({
    get issuerName() { return currentFundamentalDisplayContext.issuerName; },
    get issuerCik() { return currentFundamentalDisplayContext.issuerCik; },
    get symbol() { return currentFundamentalDisplayContext.symbol; },
    get venueMic() { return currentFundamentalDisplayContext.venueMic; },
    get currency() { return currentFundamentalDisplayContext.currency; },
    get reportingPeriod() { return currentFundamentalDisplayContext.reportingPeriod; },
    get analysisProfile() { return currentFundamentalDisplayContext.analysisProfile; },
    get snapshotId() { return currentFundamentalDisplayContext.snapshotId; },
  });

  function contextKey(context: FundamentalDisplayContext): string {
    const period = context.reportingPeriod.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '');
    return `${context.issuerCik}-${period}`;
  }

  function createFundamentalArtifacts(
    context: FundamentalDisplayContext,
  ): FundamentalArtifacts {
    const key = contextKey(context);
    const bundleId = `fundamental-bundle-${key}`;
    const analysisId = `fundamental-analysis-${key}`;
    return Object.freeze({
      bundles: Object.freeze({
        [bundleId]: Object.freeze({
          bundleId,
          issuerCik: context.issuerCik,
          reportingPeriod: context.reportingPeriod,
        }),
      }),
      analyses: Object.freeze({
        [analysisId]: Object.freeze({
          analysisId,
          analysisKind: 'fundamental',
          issuerCik: context.issuerCik,
        }),
      }),
      snapshots: Object.freeze({
        [context.snapshotId]: Object.freeze({
          snapshotId: context.snapshotId,
          issuerCik: context.issuerCik,
        }),
      }),
      activeSnapshotPointers: Object.freeze({
        [context.issuerCik]: Object.freeze({
          snapshotId: context.snapshotId,
          generation: 1,
        }),
      }),
      fingerprints: Object.freeze({
        fundamentalInputFingerprint: `sha256:${'1'.repeat(64)}`,
        fundamentalAnalysisFingerprint: `sha256:${'2'.repeat(64)}`,
      }),
    });
  }

  export interface PriceWorkspaceSnapshot {
    readonly persistence: PricePersistenceState;
    readonly lastEvent?: PriceEventResult['event'];
    readonly affected: readonly string[];
    readonly unaffected: readonly string[];
  }

  function initialWorkspace(
    context: FundamentalDisplayContext = currentFundamentalDisplayContext,
  ): PriceWorkspaceSnapshot {
    return Object.freeze({
      persistence: Object.freeze({
        fundamental: createFundamentalArtifacts(context),
        priceOverlays: Object.freeze({}),
        priceAnalyses: Object.freeze({}),
        activePricePointers: Object.freeze({}),
      }),
      affected: Object.freeze([]),
      unaffected: Object.freeze([]),
    });
  }

  export const priceWorkspace = writable<PriceWorkspaceSnapshot>(
    initialWorkspace(currentFundamentalDisplayContext),
  );

  activeFundamentalContext.subscribe((nextContext) => {
    if (nextContext.issuerCik !== currentFundamentalDisplayContext.issuerCik) {
      currentFundamentalDisplayContext = nextContext;
      priceWorkspace.set(initialWorkspace(nextContext));
      return;
    }
    currentFundamentalDisplayContext = nextContext;
  });

  export function resetPriceWorkspace(): void {
    priceWorkspace.set(initialWorkspace(currentFundamentalDisplayContext));
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
        : 'Enter a valid ISO