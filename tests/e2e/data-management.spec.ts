import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { canonicalizeJson, type JsonValue } from '../../src/core/canonical-json';
import { sha256Digest } from '../../src/core/sha256';
import type { FundamentalAnalysis, FundamentalBundle } from '../../src/domain/fundamental/types';
import { LocalExportService, type LocalExportPackage } from '../../src/persistence/export-service';
import type {
  ActivePointerRecord,
  CommitRecord,
  FundamentalRepositoryRecords,
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

async function press(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
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
  await expect(consent).toBeChecked();
}

function repositoryRecords(): FundamentalRepositoryRecords {
  const bundle = bundleVectors.validFixtures[0]?.input as FundamentalBundle;
  const analysis = analysisVectors.validFixtures.find(
    (fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID',
  )?.input as FundamentalAnalysis;
  const snapshot: FundamentalSnapshotRecord = {
    recordType: 'fundamental_snapshot',
    snapshotId: 'e2e-restore-snapshot',
    issuerCik: bundle.issuer.cik,
    bundleId: bundle.bundleId,
    analysisId: analysis.analysisId,
    fundamentalInputFingerprint: bundle.fundamentalInputFingerprint,
    fundamentalAnalysisFingerprint: analysis.fundamentalAnalysisFingerprint,
    state: 'committed',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
  const pointer: ActivePointerRecord = {
    recordType: 'active_pointer',
    issuerCik: bundle.issuer.cik,
    pointerKind: 'fundamental_snapshot',
    targetId: snapshot.snapshotId,
    targetFingerprint: snapshot.fundamentalAnalysisFingerprint,
    generation: 1,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  const commit: CommitRecord = {
    recordType: 'commit',
    transactionId: 'e2e-restore-commit',
    issuerCik: bundle.issuer.cik,
    writtenRecordIds: [bundle.bundleId, analysis.analysisId, snapshot.snapshotId],
    pointerUpdates: [`${bundle.issuer.cik}:fundamental_snapshot`],
    status: 'committed',
    committedAt: '2026-08-01T00:00:00.000Z',
  };
  return { snapshots: [snapshot], bundles: [bundle], analyses: [analysis], pointers: [pointer], commits: [commit] };
}

async function createPackage(version: '1.1.0' | '1.0.0' = '1.1.0'): Promise<LocalExportPackage> {
  const current = await new LocalExportService(
    { readAllRecords: async () => repositoryRecords() },
    { readAllRecords: async () => ({ overlays: [], analyses: [], pointers: [], commits: [] }) },
    () => '2026-08-01T00:00:00.000Z',
  ).createPackage();
  if (version === '1.1.0') return current;
  const manifest = { ...current.manifest, formatVersion: '1.0.0' };
  const checksumInput = {
    format: current.format,
    version: '1.0.0',
    formatVersion: '1.0.0',
    manifest,
    records: current.records,
  };
  return {
    ...checksumInput,
    packageSha256: await sha256Digest(canonicalizeJson(checksumInput as unknown as JsonValue)),
  } as unknown as LocalExportPackage;
}

async function seedPackage(page: Page, packageObject: LocalExportPackage): Promise<void> {
  await page.evaluate(async (records) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('finscope_personal_v1', 1);
      request.onupgradeneeded = () => {
        const definitions: Array<[string, string | string[]]> = [
          ['fundamentalSnapshots', 'snapshotId'],
          ['fundamentalBundles', 'bundleId'],
          ['fundamentalAnalyses', 'analysisId'],
          ['priceOverlays', ['overlayId', 'overlayVersion']],
          ['priceAnalyses', 'analysisId'],
          ['activePointers', ['issuerCik', 'pointerKind']],
          ['commitLog', 'transactionId'],
        ];
        for (const [name, keyPath] of definitions) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores: Record<string, string> = {
      fundamentalSnapshot: 'fundamentalSnapshots',
      fundamentalBundle: 'fundamentalBundles',
      fundamentalAnalysis: 'fundamentalAnalyses',
      historicalPriceOverlay: 'priceOverlays',
      priceAnalysis: 'priceAnalyses',
      activePointer: 'activePointers',
      commitRecord: 'commitLog',
    };
    const transaction = database.transaction(
      [...new Set(records.map((record) => stores[record.recordKind]))],
      'readwrite',
    );
    for (const record of records) transaction.objectStore(stores[record.recordKind] as string).put(record.payload);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, packageObject.records);
}

test('restore UI previews an allowed migration and requires explicit confirmation', async ({ page }) => {
  await resetDatabase(page);
  await openDataManagement(page);
  const packageObject = await createPackage('1.0.0');
  await page.getByLabel('Preview restore file').setInputFiles({
    name: 'finscope-v1.0.json',
    mimeType: 'application/json',
    buffer: Buffer.from(canonicalizeJson(packageObject as unknown as JsonValue)),
  });

  const preview = page.getByTestId('restore-preview');
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('restore-migration')).toContainText('1.0.0 → 1.1.0');
  await expect(page.getByTestId('data-management-status')).toContainText('Review the preview');
  await press(preview.getByRole('button', { name: 'Confirm atomic restore' }));
  await expect(page.getByTestId('data-management-status')).toContainText('Atomic restore completed: 5 record(s)');
  await expect(preview).toHaveCount(0);
});

test('restore UI discloses conflicts and restricts replacement to matching IDs', async ({ page }, testInfo) => {
  await resetDatabase(page);
  const packageObject = await createPackage();
  await seedPackage(page, packageObject);
  await openDataManagement(page);
  await page.getByLabel('Preview restore file').setInputFiles({
    name: 'finscope-conflicts.json',
    mimeType: 'application/json',
    buffer: Buffer.from(canonicalizeJson(packageObject as unknown as JsonValue)),
  });

  await expect(page.getByTestId('restore-conflicts').getByRole('listitem')).toHaveCount(5);
  await expect(page.getByLabel('Reject restore when conflicts exist')).toBeChecked();
  const replacementPolicy = page.getByLabel('Replace only matching record IDs');
  try {
    await replacementPolicy.check({ timeout: 5_000 });
  } catch (caught: unknown) {
    const geometry = await replacementPolicy.evaluate((element) => {
      const describe = (node: Element | null) => {
        if (node === null) return null;
        const rectangle = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          tag: node.tagName,
          id: node.id,
          className: node.getAttribute('class'),
          text: node.textContent?.trim().slice(0, 160) ?? '',
          rect: {
            x: rectangle.x,
            y: rectangle.y,
            top: rectangle.top,
            right: rectangle.right,
            bottom: rectangle.bottom,
            left: rectangle.left,
            width: rectangle.width,
            height: rectangle.height,
          },
          style: {
            display: style.display,
            position: style.position,
            zIndex: style.zIndex,
            opacity: style.opacity,
            pointerEvents: style.pointerEvents,
            visibility: style.visibility,
            transform: style.transform,
            overflow: style.overflow,
            inlineSize: style.inlineSize,
            blockSize: style.blockSize,
          },
        };
      };
      const inputRectangle = element.getBoundingClientRect();
      const center = {
        x: inputRectangle.left + inputRectangle.width / 2,
        y: inputRectangle.top + inputRectangle.height / 2,
      };
      const label = document.querySelector(`label[for="${element.id}"]`);
      const viewport = window.visualViewport;
      return {
        input: describe(element),
        parent: describe(element.parentElement),
        offsetParent: describe(element instanceof HTMLElement ? element.offsetParent : null),
        label: describe(label),
        fieldset: describe(element.closest('fieldset')),
        preview: describe(element.closest('[data-testid="restore-preview"]')),
        main: describe(document.querySelector('main')),
        localActions: describe(document.querySelector('[aria-label="Local data actions"]')),
        center,
        hitStack: document.elementsFromPoint(center.x, center.y).slice(0, 12).map(describe),
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          visualViewport: viewport === null ? null : {
            width: viewport.width,
            height: viewport.height,
            offsetLeft: viewport.offsetLeft,
            offsetTop: viewport.offsetTop,
            pageLeft: viewport.pageLeft,
            pageTop: viewport.pageTop,
            scale: viewport.scale,
          },
        },
        activeElement: describe(document.activeElement),
      };
    });
    console.log(`B18_MOBILE_HIT_TEST_DIAGNOSTIC=${JSON.stringify({ project: testInfo.project.name, geometry })}`);
    throw caught;
  }
  await press(page.getByRole('button', { name: 'Confirm atomic restore' }));
  await expect(page.getByTestId('data-management-status')).toContainText('5 replacement(s)');
});
