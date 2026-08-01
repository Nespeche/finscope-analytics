import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canonicalizeJson, type JsonValue } from '../../src/core/canonical-json';
import type { FundamentalAnalysis, FundamentalBundle } from '../../src/domain/fundamental/types';
import { LocalExportService, type LocalExportPackage } from '../../src/persistence/export-service';
import type {
  ActivePointerRecord,
  CommitRecord,
  FundamentalSnapshotRecord,
} from '../../src/persistence/snapshot-repository';

interface Fixture { readonly fixtureId: string; readonly input: unknown }
const bundleVectors = JSON.parse(readFileSync(new URL(
  '../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json',
  import.meta.url,
), 'utf8')) as { readonly validFixtures: readonly Fixture[] };
const analysisVectors = JSON.parse(readFileSync(new URL(
  '../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json',
  import.meta.url,
), 'utf8')) as { readonly validFixtures: readonly Fixture[] };

const storesByKind: Readonly<Record<string, string>> = {
  fundamentalSnapshot: 'fundamentalSnapshots',
  fundamentalBundle: 'fundamentalBundles',
  fundamentalAnalysis: 'fundamentalAnalyses',
  historicalPriceOverlay: 'priceOverlays',
  priceAnalysis: 'priceAnalyses',
  activePointer: 'activePointers',
  commitRecord: 'commitLog',
};
const allStores = [
  'fundamentalSnapshots', 'fundamentalBundles', 'fundamentalAnalyses',
  'priceOverlays', 'priceAnalyses', 'activePointers', 'commitLog',
] as const;

async function press(control: Locator): Promise<void> {
  await control.focus();
  await control.press('Enter');
}

async function resetDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('finscope_personal_v1');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('DATABASE_DELETE_BLOCKED'));
    });
  });
}

async function openDataManagement(page: Page): Promise<void> {
  await press(page.getByRole('button', { name: 'Data management', exact: true }));
  const consent = page.getByRole('checkbox', { name: 'Allow this view to open and change IndexedDB' });
  await consent.focus();
  await consent.press('Space');
}

function records() {
  const bundle = bundleVectors.validFixtures[0]?.input as FundamentalBundle;
  const analysis = analysisVectors.validFixtures.find(
    (fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID',
  )?.input as FundamentalAnalysis;
  const snapshot: FundamentalSnapshotRecord = {
    recordType: 'fundamental_snapshot', snapshotId: 'lifecycle-snapshot', issuerCik: bundle.issuer.cik,
    bundleId: bundle.bundleId, analysisId: analysis.analysisId,
    fundamentalInputFingerprint: bundle.fundamentalInputFingerprint,
    fundamentalAnalysisFingerprint: analysis.fundamentalAnalysisFingerprint, state: 'committed',
  };
  const pointer: ActivePointerRecord = {
    recordType: 'active_pointer', issuerCik: bundle.issuer.cik, pointerKind: 'fundamental_snapshot',
    targetId: snapshot.snapshotId, targetFingerprint: snapshot.fundamentalAnalysisFingerprint, generation: 1,
  };
  const commit: CommitRecord = {
    recordType: 'commit', transactionId: 'lifecycle-commit', issuerCik: bundle.issuer.cik,
    writtenRecordIds: [bundle.bundleId, analysis.analysisId, snapshot.snapshotId],
    pointerUpdates: [`${bundle.issuer.cik}:fundamental_snapshot`], status: 'committed',
  };
  return { bundle, analysis, snapshot, pointer, commit };
}

async function createPackage(): Promise<LocalExportPackage> {
  const value = records();
  return await new LocalExportService(
    { readAllRecords: async () => ({
      snapshots: [value.snapshot], bundles: [value.bundle], analyses: [value.analysis],
      pointers: [value.pointer], commits: [value.commit],
    }) },
    { readAllRecords: async () => ({ overlays: [], analyses: [], pointers: [], commits: [] }) },
    () => '2026-08-01T00:00:00.000Z',
  ).createPackage();
}

async function openDatabase(): Promise<IDBDatabase> {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('finscope_personal_v1', 1);
    request.onupgradeneeded = () => {
      const definitions: Array<[string, string | string[]]> = [
        ['fundamentalSnapshots', 'snapshotId'], ['fundamentalBundles', 'bundleId'],
        ['fundamentalAnalyses', 'analysisId'], ['priceOverlays', ['overlayId', 'overlayVersion']],
        ['priceAnalyses', 'analysisId'], ['activePointers', ['issuerCik', 'pointerKind']],
        ['commitLog', 'transactionId'],
      ];
      for (const [name, keyPath] of definitions) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seedPayloads(page: Page, rows: readonly { recordKind: string; payload: unknown }[]): Promise<void> {
  await page.evaluate(async ({ recordsToSeed, storeMap }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('finscope_personal_v1', 1);
      request.onupgradeneeded = () => {
        const definitions: Array<[string, string | string[]]> = [
          ['fundamentalSnapshots', 'snapshotId'], ['fundamentalBundles', 'bundleId'],
          ['fundamentalAnalyses', 'analysisId'], ['priceOverlays', ['overlayId', 'overlayVersion']],
          ['priceAnalyses', 'analysisId'], ['activePointers', ['issuerCik', 'pointerKind']],
          ['commitLog', 'transactionId'],
        ];
        for (const [name, keyPath] of definitions) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = [...new Set(recordsToSeed.map((record) => storeMap[record.recordKind]))];
    const transaction = database.transaction(names, 'readwrite');
    for (const record of recordsToSeed) transaction.objectStore(storeMap[record.recordKind] as string).put(record.payload);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, { recordsToSeed: rows, storeMap: storesByKind });
}

async function storeCounts(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(async (names) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('finscope_personal_v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(names, 'readonly');
    const result: Record<string, number> = {};
    await Promise.all(names.map(async (name) => {
      result[name] = await new Promise<number>((resolve, reject) => {
        const request = transaction.objectStore(name).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }));
    database.close();
    return result;
  }, allStores);
}

test('late stale conflict aborts the full restore and leaves no orphan records', async ({ page }) => {
  await resetDatabase(page);
  await openDataManagement(page);
  const candidate = await createPackage();
  await page.getByLabel('Preview restore file').setInputFiles({
    name: 'rollback.json', mimeType: 'application/json',
    buffer: Buffer.from(canonicalizeJson(candidate as unknown as JsonValue)),
  });
  await expect(page.getByTestId('restore-preview')).toBeVisible();

  const pointer = candidate.records.find((record) => record.recordKind === 'activePointer');
  expect(pointer).toBeDefined();
  await seedPayloads(page, [pointer as NonNullable<typeof pointer>]);
  await press(page.getByRole('button', { name: 'Confirm atomic restore' }));

  await expect(page.getByTestId('data-management-status')).toContainText('RESTORE_PREVIEW_STALE_CONFLICT:activePointer');
  const counts = await storeCounts(page);
  expect(counts.activePointers).toBe(1);
  expect(counts.fundamentalBundles).toBe(0);
  expect(counts.fundamentalAnalyses).toBe(0);
  expect(counts.fundamentalSnapshots).toBe(0);
  expect(counts.commitLog).toBe(0);
});

test('corrupt pointers are quarantined and delete-all offers backup before atomic deletion', async ({ page }) => {
  await resetDatabase(page);
  await seedPayloads(page, [{
    recordKind: 'activePointer',
    payload: {
      recordType: 'active_pointer', issuerCik: '0000320193', pointerKind: 'fundamental_snapshot',
      targetId: 'missing-snapshot', targetFingerprint: `sha256:${'a'.repeat(64)}`, generation: 1,
    },
  }]);
  await openDataManagement(page);
  await press(page.getByRole('button', { name: 'Check local data integrity' }));
  await expect(page.getByTestId('corruption-recovery')).toBeVisible();
  await expect(page.getByTestId('data-management-status')).toContainText('quarantined without deletion');

  const downloadPromise = page.waitForEvent('download');
  await press(page.getByRole('button', { name: 'Export backup and delete all data' }));
  expect((await downloadPromise).suggestedFilename()).toBe('finscope-pre-delete-backup.json');
  const dialog = page.getByRole('dialog', { name: 'Delete all personal data?' });
  await expect(dialog).toBeVisible();
  await press(dialog.getByRole('button', { name: /Delete all personal data: Delete all personal data/u }));
  await expect(page.getByTestId('data-management-status')).toContainText('deleted atomically');
  expect(Object.values(await storeCounts(page)).every((count) => count === 0)).toBe(true);
});
