import { describe, expect, it, vi } from 'vitest';
import bundleVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/bundles/fundamental-bundle-test-vectors.json';
import analysisVectorsJson from '../../../specs/001-fundamental-analysis-platform/fixtures/analysis/analysis-result-test-vectors.json';
import { canonicalizeJson, type JsonValue } from '../../../src/core/canonical-json';
import { sha256Digest } from '../../../src/core/sha256';
import { parseFundamentalAnalysis, parseFundamentalBundle } from '../../../src/domain/fundamental/types';
import { LocalExportService, type LocalExportPackage } from '../../../src/persistence/export-service';
import {
  MAXIMUM_RESTORE_SIZE_BYTES,
  RestorePreviewError,
  RestorePreviewService,
  type RestoreRepositoryLookup,
} from '../../../src/persistence/restore-preview';
import type { FundamentalRepositoryRecords } from '../../../src/persistence/snapshot-repository';
import type { PriceRepositoryRecords } from '../../../src/persistence/price-repository';

interface Fixture { readonly fixtureId: string; readonly input: unknown }
const bundle = parseFundamentalBundle(
  (bundleVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures[0]?.input,
);
const analysis = parseFundamentalAnalysis(
  (analysisVectorsJson as { readonly validFixtures: readonly Fixture[] }).validFixtures
    .find((fixture) => fixture.fixtureId === 'ANALYSIS-FUNDAMENTAL-VALID')?.input,
);
const snapshot = Object.freeze({
  recordType: 'fundamental_snapshot' as const,
  snapshotId: 'snapshot-restore-1', issuerCik: bundle.issuer.cik,
  bundleId: bundle.bundleId, analysisId: analysis.analysisId,
  fundamentalInputFingerprint: bundle.fundamentalInputFingerprint,
  fundamentalAnalysisFingerprint: analysis.fundamentalAnalysisFingerprint,
  state: 'committed' as const,
});
const pointer = Object.freeze({
  recordType: 'active_pointer' as const, issuerCik: bundle.issuer.cik,
  pointerKind: 'fundamental_snapshot' as const, targetId: snapshot.snapshotId,
  targetFingerprint: analysis.fundamentalAnalysisFingerprint, generation: 1,
});
const commit = Object.freeze({
  recordType: 'commit' as const, transactionId: 'commit-restore-1', issuerCik: bundle.issuer.cik,
  writtenRecordIds: [bundle.bundleId, analysis.analysisId, snapshot.snapshotId],
  pointerUpdates: [`${bundle.issuer.cik}:fundamental_snapshot`], status: 'committed' as const,
});

function sources(): Readonly<{
  fundamental: FundamentalRepositoryRecords;
  price: PriceRepositoryRecords;
}> {
  return {
    fundamental: { snapshots: [snapshot], bundles: [bundle], analyses: [analysis], pointers: [pointer], commits: [commit] },
    price: { overlays: [], analyses: [], pointers: [], commits: [] },
  };
}

async function validPackage(): Promise<LocalExportPackage> {
  const records = sources();
  return await new LocalExportService(
    { readAllRecords: async () => records.fundamental },
    { readAllRecords: async () => records.price },
    () => '2026-08-01T12:00:00.000Z',
  ).createPackage();
}

async function reseal(candidate: Record<string, unknown>): Promise<void> {
  const records = candidate.records as JsonValue;
  const manifest = candidate.manifest as Record<string, unknown>;
  manifest.recordCount = (candidate.records as unknown[]).length;
  manifest.recordsSha256 = await sha256Digest(canonicalizeJson(records));
  const packageInput = {
    format: candidate.format,
    version: candidate.version,
    formatVersion: candidate.formatVersion,
    manifest: candidate.manifest,
    records: candidate.records,
  } as unknown as JsonValue;
  candidate.packageSha256 = await sha256Digest(canonicalizeJson(packageInput));
}

function code(error: unknown): string | undefined {
  return error instanceof RestorePreviewError ? error.code : undefined;
}

describe('fail-closed restore preview', () => {
  it('parses and previews a valid package without any write surface', async () => {
    const find = vi.fn<RestoreRepositoryLookup['find']>(async () => undefined);
    const preview = await new RestorePreviewService({ find }).preview(JSON.stringify(await validPackage()));

    expect(preview.valid).toBe(true);
    expect(preview.recordCountsByKind).toMatchObject({
      fundamentalSnapshot: 1, fundamentalBundle: 1, fundamentalAnalysis: 1,
      activePointer: 1, commitRecord: 1,
    });
    expect(preview.issuerCiks).toEqual(['0000320193']);
    expect(preview.readyForExplicitRestore).toBe(true);
    expect(preview.explicitConfirmationRequired).toBe(true);
    expect(preview).not.toHaveProperty('write');
    expect(find).toHaveBeenCalled();
  });

  it('reports existing repository conflicts and requires explicit resolution', async () => {
    const packageValue = await validPackage();
    const incoming = packageValue.records[0];
    if (incoming === undefined) throw new Error('Expected export record.');
    const preview = await new RestorePreviewService({
      find: async (kind, id) => kind === incoming.recordKind && id === incoming.recordId
        ? { payloadSha256: `sha256:${'f'.repeat(64)}` as never }
        : undefined,
    }).preview(JSON.stringify(packageValue));

    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0]).toMatchObject({ identical: false, recordId: incoming.recordId });
    expect(preview.readyForExplicitRestore).toBe(false);
  });

  it.each([
    ['RESTORE_INVALID_JSON', '{'],
    ['RESTORE_ARCHIVE_UNSUPPORTED', new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
    ['RESTORE_PACKAGE_TOO_LARGE', new Uint8Array(MAXIMUM_RESTORE_SIZE_BYTES + 1)],
  ] as const)('rejects %s before repository evaluation', async (
    expectedCode: RestorePreviewError['code'],
    input: string | Uint8Array,
  ) => {
    const find = vi.fn<RestoreRepositoryLookup['find']>(async () => undefined);
    await expect(new RestorePreviewService({ find }).preview(input)).rejects.toSatisfy(
      (error: unknown) => code(error) === expectedCode,
    );
    expect(find).not.toHaveBeenCalled();
  });

  it('rejects corrupt payload hashes, duplicate IDs, unknown kinds and incompatible versions', async () => {
    const base = JSON.parse(JSON.stringify(await validPackage())) as Record<string, unknown>;
    const payloadCorrupt = structuredClone(base) as Record<string, unknown>;
    ((payloadCorrupt.records as Array<Record<string, unknown>>)[0]?.payload as Record<string, unknown>).state = 'tampered';
    await expect(new RestorePreviewService({ find: async () => undefined }).preview(JSON.stringify(payloadCorrupt)))
      .rejects.toSatisfy((error: unknown) => code(error) === 'RESTORE_SCHEMA_VALIDATION_FAILED'
        || code(error) === 'RESTORE_PAYLOAD_HASH_MISMATCH');

    const duplicate = structuredClone(base) as Record<string, unknown>;
    (duplicate.records as unknown[]).push(structuredClone((duplicate.records as unknown[])[0]));
    (duplicate.manifest as Record<string, unknown>).recordCount = (duplicate.records as unknown[]).length;
    await expect(new RestorePreviewService({ find: async () => undefined }).preview(JSON.stringify(duplicate)))
      .rejects.toSatisfy((error: unknown) => code(error) === 'RESTORE_DUPLICATE_RECORD_ID');

    const unknown = structuredClone(base) as Record<string, unknown>;
    ((unknown.records as Array<Record<string, unknown>>)[0] as Record<string, unknown>).recordKind = 'unknown';
    await expect(new RestorePreviewService({ find: async () => undefined }).preview(JSON.stringify(unknown)))
      .rejects.toSatisfy((error: unknown) => code(error) === 'RESTORE_UNKNOWN_RECORD_KIND');

    const incompatible = structuredClone(base) as Record<string, unknown>;
    incompatible.version = '2.0.0';
    incompatible.formatVersion = '2.0.0';
    (incompatible.manifest as Record<string, unknown>).formatVersion = '2.0.0';
    await expect(new RestorePreviewService({ find: async () => undefined }).preview(JSON.stringify(incompatible)))
      .rejects.toSatisfy((error: unknown) => code(error) === 'RESTORE_INCOMPATIBLE_VERSION');
  });

  it('rejects packages with missing cross-record references after complete hash validation', async () => {
    const candidate = JSON.parse(JSON.stringify(await validPackage())) as Record<string, unknown>;
    candidate.records = (candidate.records as Array<Record<string, unknown>>)
      .filter((record) => record.recordKind !== 'fundamentalBundle');
    await reseal(candidate);

    await expect(new RestorePreviewService({ find: async () => undefined }).preview(JSON.stringify(candidate)))
      .rejects.toSatisfy((error: unknown) => code(error) === 'RESTORE_REFERENCE_MISSING');
  });

  it('recognizes only the explicit 1.0.0 to 1.1.0 preview migration', async () => {
    const candidate = JSON.parse(JSON.stringify(await validPackage())) as Record<string, unknown>;
    candidate.version = '1.0.0';
    candidate.formatVersion = '1.0.0';
    (candidate.manifest as Record<string, unknown>).formatVersion = '1.0.0';
    await reseal(candidate);
    const preview = await new RestorePreviewService({ find: async () => undefined })
      .preview(JSON.stringify(candidate));
    expect(preview.migrationPlan).toEqual({
      migrationId: 'local-export-1.0-to-1.1', sourceVersion: '1.0.0',
      targetVersion: '1.1.0', previewOnly: true,
    });
  });
});
