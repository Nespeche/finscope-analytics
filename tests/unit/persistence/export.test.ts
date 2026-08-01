import { describe, expect, it } from 'vitest';
import { canonicalizeJson, type JsonValue } from '../../../src/core/canonical-json';
import { sha256Digest } from '../../../src/core/sha256';
import {
  LOCAL_EXPORT_FORMAT,
  LOCAL_EXPORT_VERSION,
  LocalExportService,
} from '../../../src/persistence/export-service';
import type { PriceRepositoryRecords } from '../../../src/persistence/price-repository';
import type { FundamentalRepositoryRecords } from '../../../src/persistence/snapshot-repository';

const fundamentalRecords = (snapshots: readonly unknown[] = []): FundamentalRepositoryRecords => ({
  snapshots, bundles: [], analyses: [], pointers: [], commits: [],
} as unknown as FundamentalRepositoryRecords);
const priceRecords = (overlays: readonly unknown[] = []): PriceRepositoryRecords => ({
  overlays, analyses: [], pointers: [], commits: [],
} as unknown as PriceRepositoryRecords);

describe('versioned local export', () => {
  it('reads repository records, hashes every payload and produces reproducible canonical output', async () => {
    const fundamental = fundamentalRecords([{
      recordType: 'fundamental_snapshot', snapshotId: 'snapshot-1', issuerCik: '0000320193',
      bundleId: 'bundle-1', analysisId: 'analysis-1',
      fundamentalInputFingerprint: `sha256:${'1'.repeat(64)}`,
      fundamentalAnalysisFingerprint: `sha256:${'2'.repeat(64)}`,
      state: 'committed',
    }]);
    const price = priceRecords([{
      overlayId: 'overlay-1', overlayVersion: 1, issuerCik: '0000320193',
      contractVersion: '5.0.0', instrument: { symbol: 'AAPL', venueMic: 'XNAS' },
      currency: 'USD', frequency: 'monthly', observations: [], adjustmentStatus: 'unadjusted',
      origin: { profileId: 'local_csv_manual_v1', method: 'manual_entry' }, warnings: [],
      priceUse: 'historical_descriptive_only', historicalPriceOverlayFingerprint: `sha256:${'3'.repeat(64)}`,
    }]);
    const service = new LocalExportService(
      { readAllRecords: async () => fundamental },
      { readAllRecords: async () => price },
      () => '2026-08-01T12:00:00.000Z',
    );

    const first = await service.createPackage();
    const second = await service.createPackage();
    expect(first).toEqual(second);
    expect(await service.serialize()).toBe(canonicalizeJson(first as unknown as JsonValue));
    expect(first).toMatchObject({
      format: LOCAL_EXPORT_FORMAT, version: LOCAL_EXPORT_VERSION, formatVersion: LOCAL_EXPORT_VERSION,
      manifest: { recordCount: 2, createdAt: '2026-08-01T12:00:00.000Z' },
    });
    for (const record of first.records) {
      await expect(sha256Digest(canonicalizeJson(record.payload))).resolves.toBe(record.payloadSha256);
    }
    await expect(sha256Digest(canonicalizeJson(first.records as unknown as JsonValue)))
      .resolves.toBe(first.manifest.recordsSha256);
  });

  it('excludes invalid, quarantined, foreign and privacy/deployment contaminated records', async () => {
    const fundamental = fundamentalRecords([
      { snapshotId: 'valid', issuerCik: '0000320193', state: 'committed' },
      { snapshotId: 'invalid', integrityStatus: 'invalid' },
      { snapshotId: 'quarantine', quarantined: true },
      { snapshotId: 'foreign', userOwned: false },
      { snapshotId: 'consent', refreshConsent: true },
      { snapshotId: 'secret', deploymentVariables: { API_KEY: 'forbidden' } },
      { snapshotId: 'temporary', temporaryFiles: ['cache.tmp'] },
    ]);
    const service = new LocalExportService(
      { readAllRecords: async () => fundamental },
      { readAllRecords: async () => priceRecords() },
      () => '2026-08-01T12:00:00.000Z',
    );

    const result = await service.createPackage();
    expect(result.records.map((record) => record.recordId)).toEqual(['valid']);
    expect(JSON.stringify(result)).not.toContain('refreshConsent');
    expect(JSON.stringify(result)).not.toContain('API_KEY');
    expect(JSON.stringify(result)).not.toContain('cache.tmp');
  });

  it('rejects duplicate record identities rather than producing an ambiguous package', async () => {
    const service = new LocalExportService(
      { readAllRecords: async () => fundamentalRecords([
        { snapshotId: 'duplicate', issuerCik: '0000320193' },
        { snapshotId: 'duplicate', issuerCik: '0000789019' },
      ]) },
      { readAllRecords: async () => priceRecords() },
    );
    await expect(service.createPackage()).rejects.toThrow('DUPLICATE_EXPORT_RECORD');
  });
});
