import { canonicalizeJson, type JsonObject, type JsonValue } from '../core/canonical-json';
import { createProductSchemaValidator } from '../core/schema-validator';
import { sha256Digest, type Sha256Digest } from '../core/sha256';
import {
  LOCAL_EXPORT_FORMAT,
  LOCAL_EXPORT_VERSION,
  type LocalExportRecord,
  type LocalExportRecordKind,
} from './export-service';

export const MAXIMUM_RESTORE_SIZE_BYTES = 52_428_800;

export type RestorePreviewErrorCode =
  | 'RESTORE_PACKAGE_TOO_LARGE'
  | 'RESTORE_ARCHIVE_UNSUPPORTED'
  | 'RESTORE_INVALID_UTF8'
  | 'RESTORE_INVALID_JSON'
  | 'RESTORE_INVALID_STRUCTURE'
  | 'RESTORE_UNKNOWN_FORMAT'
  | 'RESTORE_INCOMPATIBLE_VERSION'
  | 'RESTORE_UNKNOWN_RECORD_KIND'
  | 'RESTORE_SCHEMA_ID_MISMATCH'
  | 'RESTORE_DUPLICATE_RECORD_ID'
  | 'RESTORE_PAYLOAD_HASH_MISMATCH'
  | 'RESTORE_RECORDS_HASH_MISMATCH'
  | 'RESTORE_PACKAGE_HASH_MISMATCH'
  | 'RESTORE_SCHEMA_VALIDATION_FAILED'
  | 'RESTORE_REFERENCE_MISSING';

export class RestorePreviewError extends Error {
  constructor(readonly code: RestorePreviewErrorCode, message: string) {
    super(message);
    this.name = 'RestorePreviewError';
  }
}

export interface ExistingRestoreRecord {
  readonly payloadSha256?: Sha256Digest;
}

export interface RestoreRepositoryLookup {
  find(recordKind: LocalExportRecordKind, recordId: string): Promise<ExistingRestoreRecord | undefined>;
}

export interface RestoreConflict {
  readonly recordKind: LocalExportRecordKind;
  readonly recordId: string;
  readonly incomingPayloadSha256: Sha256Digest;
  readonly existingPayloadSha256?: Sha256Digest;
  readonly identical: boolean;
}

export interface RestoreMigrationPlan {
  readonly migrationId: 'local-export-1.0-to-1.1';
  readonly sourceVersion: '1.0.0';
  readonly targetVersion: typeof LOCAL_EXPORT_VERSION;
  readonly previewOnly: true;
}

export interface RestorePreview {
  readonly valid: true;
  readonly previewId: Sha256Digest;
  readonly formatVersion: string;
  readonly targetFormatVersion: typeof LOCAL_EXPORT_VERSION;
  readonly migrationPlan?: RestoreMigrationPlan;
  readonly recordCountsByKind: Readonly<Record<LocalExportRecordKind, number>>;
  readonly issuerCiks: readonly string[];
  readonly overlayCount: number;
  readonly conflicts: readonly RestoreConflict[];
  readonly incompatibleRecords: readonly string[];
  readonly estimatedWrites: number;
  readonly readyForExplicitRestore: boolean;
  readonly explicitConfirmationRequired: true;
  readonly packageSha256: Sha256Digest;
  readonly records: readonly LocalExportRecord[];
}

const expectedSchemas = Object.freeze({
  fundamentalSnapshot: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/FundamentalSnapshotRecord',
  fundamentalBundle: 'https://finscope.local/schemas/fundamental-bundle.schema.json',
  fundamentalAnalysis: 'https://finscope.local/schemas/analysis-results.schema.json#/$defs/FundamentalAnalysis',
  historicalPriceOverlay: 'https://finscope.local/schemas/historical-price-overlay.schema.json',
  priceAnalysis: 'https://finscope.local/schemas/analysis-results.schema.json#/$defs/PriceAnalysis',
  activePointer: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/ActivePointerRecord',
  commitRecord: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/CommitRecord',
} satisfies Record<LocalExportRecordKind, string>);
const recordKinds = Object.freeze(Object.keys(expectedSchemas) as LocalExportRecordKind[]);
const recordKindSet = new Set<string>(recordKinds);
const textEncoder = new TextEncoder();

function fail(code: RestorePreviewErrorCode, message: string): never {
  throw new RestorePreviewError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], location: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('RESTORE_INVALID_STRUCTURE', `${location} contains missing or unknown fields.`);
  }
}

function decodeInput(input: string | Uint8Array): Readonly<{ text: string; sizeBytes: number }> {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : Uint8Array.from(input);
  if (bytes.byteLength > MAXIMUM_RESTORE_SIZE_BYTES) {
    fail('RESTORE_PACKAGE_TOO_LARGE', `Restore candidate exceeds ${MAXIMUM_RESTORE_SIZE_BYTES} bytes.`);
  }
  if (
    (bytes[0] === 0x50 && bytes[1] === 0x4b)
    || (bytes[0] === 0x1f && bytes[1] === 0x8b)
  ) {
    fail('RESTORE_ARCHIVE_UNSUPPORTED', 'ZIP and other archive containers are unsupported.');
  }
  if (typeof input === 'string') return Object.freeze({ text: input, sizeBytes: bytes.byteLength });
  try {
    return Object.freeze({ text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), sizeBytes: bytes.byteLength });
  } catch {
    fail('RESTORE_INVALID_UTF8', 'Restore candidate must be valid UTF-8 JSON.');
  }
}

function parseVersion(value: unknown): readonly [number, number, number] {
  if (typeof value !== 'string') fail('RESTORE_INCOMPATIBLE_VERSION', 'formatVersion must be a semantic version.');
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
  if (match === null) fail('RESTORE_INCOMPATIBLE_VERSION', `Unsupported format version ${value}.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

function resolveMigration(version: string): RestoreMigrationPlan | undefined {
  const [major, minor, patch] = parseVersion(version);
  if (major !== 1) fail('RESTORE_INCOMPATIBLE_VERSION', `Format major ${major} is incompatible.`);
  if (major === 1 && minor === 1 && patch === 0) return undefined;
  if (major === 1 && minor === 0 && patch === 0) {
    return Object.freeze({
      migrationId: 'local-export-1.0-to-1.1', sourceVersion: '1.0.0',
      targetVersion: LOCAL_EXPORT_VERSION, previewOnly: true,
    });
  }
  fail('RESTORE_INCOMPATIBLE_VERSION', `No explicit migration exists from ${version}.`);
}

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function checksumInput(packageObject: Record<string, unknown>): JsonObject {
  return {
    format: packageObject.format as JsonValue,
    version: packageObject.version as JsonValue,
    formatVersion: packageObject.formatVersion as JsonValue,
    manifest: packageObject.manifest as JsonValue,
    records: packageObject.records as JsonValue,
  };
}

function recordIdFromPayload(kind: LocalExportRecordKind, payload: Record<string, unknown>): string | undefined {
  switch (kind) {
    case 'fundamentalSnapshot': return typeof payload.snapshotId === 'string' ? payload.snapshotId : undefined;
    case 'fundamentalBundle': return typeof payload.bundleId === 'string' ? payload.bundleId : undefined;
    case 'fundamentalAnalysis': return typeof payload.analysisId === 'string' ? payload.analysisId : undefined;
    case 'historicalPriceOverlay': return typeof payload.overlayId === 'string' && Number.isSafeInteger(payload.overlayVersion)
      ? `${payload.overlayId}:${String(payload.overlayVersion)}` : undefined;
    case 'priceAnalysis': return typeof payload.analysisId === 'string' ? payload.analysisId : undefined;
    case 'activePointer': return typeof payload.issuerCik === 'string' && typeof payload.pointerKind === 'string'
      ? `${payload.issuerCik}:${payload.pointerKind}` : undefined;
    case 'commitRecord': return typeof payload.transactionId === 'string' ? payload.transactionId : undefined;
  }
}

function issuerCikFromPayload(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.issuerCik === 'string') return payload.issuerCik;
  return isPlainObject(payload.issuer) && typeof payload.issuer.cik === 'string' ? payload.issuer.cik : undefined;
}

function emptyCounts(): Record<LocalExportRecordKind, number> {
  return {
    fundamentalSnapshot: 0, fundamentalBundle: 0, fundamentalAnalysis: 0,
    historicalPriceOverlay: 0, priceAnalysis: 0, activePointer: 0, commitRecord: 0,
  };
}

async function requireReference(
  packageIds: ReadonlySet<string>,
  lookup: RestoreRepositoryLookup,
  kind: LocalExportRecordKind,
  recordId: string,
  sourceId: string,
): Promise<void> {
  if (packageIds.has(`${kind}:${recordId}`)) return;
  if (await lookup.find(kind, recordId) !== undefined) return;
  fail('RESTORE_REFERENCE_MISSING', `${sourceId} references missing ${kind}:${recordId}.`);
}

export class RestorePreviewService {
  readonly #validator = createProductSchemaValidator();

  constructor(private readonly lookup: RestoreRepositoryLookup) {}

  async preview(input: string | Uint8Array): Promise<RestorePreview> {
    const decoded = decodeInput(input);
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded.text) as unknown;
    } catch {
      fail('RESTORE_INVALID_JSON', 'Restore candidate is not valid JSON.');
    }
    if (!isPlainObject(parsed)) fail('RESTORE_INVALID_STRUCTURE', 'Restore package must be a JSON object.');
    assertExactKeys(parsed, ['format', 'version', 'formatVersion', 'manifest', 'records', 'packageSha256'], 'package');
    if (parsed.format !== LOCAL_EXPORT_FORMAT) fail('RESTORE_UNKNOWN_FORMAT', 'Unknown restore package format.');
    if (parsed.version !== parsed.formatVersion || typeof parsed.formatVersion !== 'string') {
      fail('RESTORE_INCOMPATIBLE_VERSION', 'version and formatVersion must match.');
    }
    const migrationPlan = resolveMigration(parsed.formatVersion);
    if (!isPlainObject(parsed.manifest)) fail('RESTORE_INVALID_STRUCTURE', 'manifest must be an object.');
    assertExactKeys(parsed.manifest, ['format', 'formatVersion', 'createdAt', 'recordCount', 'recordsSha256'], 'manifest');
    if (parsed.manifest.format !== parsed.format || parsed.manifest.formatVersion !== parsed.formatVersion) {
      fail('RESTORE_INVALID_STRUCTURE', 'Manifest identity does not match package identity.');
    }
    if (!Array.isArray(parsed.records) || !Number.isSafeInteger(parsed.manifest.recordCount)
      || parsed.manifest.recordCount !== parsed.records.length) {
      fail('RESTORE_INVALID_STRUCTURE', 'Manifest recordCount does not match records.');
    }

    const records: LocalExportRecord[] = [];
    const seen = new Set<string>();
    const counts = emptyCounts();
    const issuerCiks = new Set<string>();
    for (const [index, candidate] of parsed.records.entries()) {
      if (!isPlainObject(candidate)) fail('RESTORE_INVALID_STRUCTURE', `records[${index}] must be an object.`);
      assertExactKeys(candidate, ['schemaId', 'recordKind', 'recordId', 'payloadSha256', 'payload'], `records[${index}]`);
      if (typeof candidate.recordKind !== 'string' || !recordKindSet.has(candidate.recordKind)) {
        fail('RESTORE_UNKNOWN_RECORD_KIND', `Unknown record kind at index ${index}.`);
      }
      const recordKind = candidate.recordKind as LocalExportRecordKind;
      if (candidate.schemaId !== expectedSchemas[recordKind]) {
        fail('RESTORE_SCHEMA_ID_MISMATCH', `Schema ID does not match ${recordKind}.`);
      }
      if (typeof candidate.recordId !== 'string' || candidate.recordId.length === 0) {
        fail('RESTORE_INVALID_STRUCTURE', `Invalid recordId at index ${index}.`);
      }
      const duplicateKey = `${recordKind}:${candidate.recordId}`;
      if (seen.has(duplicateKey)) fail('RESTORE_DUPLICATE_RECORD_ID', `Duplicate record ${duplicateKey}.`);
      seen.add(duplicateKey);
      if (!isPlainObject(candidate.payload)) fail('RESTORE_INVALID_STRUCTURE', `${duplicateKey} payload must be an object.`);
      if (recordIdFromPayload(recordKind, candidate.payload) !== candidate.recordId) {
        fail('RESTORE_INVALID_STRUCTURE', `${duplicateKey} recordId does not match payload identity.`);
      }
      const validation = this.#validator.validate(expectedSchemas[recordKind], candidate.payload);
      if (!validation.valid) {
        fail('RESTORE_SCHEMA_VALIDATION_FAILED', `${duplicateKey} failed schema validation.`);
      }
      const calculatedPayloadHash = await sha256Digest(canonicalizeJson(asJsonValue(candidate.payload)));
      if (candidate.payloadSha256 !== calculatedPayloadHash) {
        fail('RESTORE_PAYLOAD_HASH_MISMATCH', `${duplicateKey} payload hash mismatch.`);
      }
      const issuerCik = issuerCikFromPayload(candidate.payload);
      if (issuerCik !== undefined) issuerCiks.add(issuerCik);
      counts[recordKind] += 1;
      records.push(Object.freeze({
        schemaId: candidate.schemaId as string,
        recordKind,
        recordId: candidate.recordId,
        payloadSha256: candidate.payloadSha256 as Sha256Digest,
        payload: candidate.payload as JsonValue,
      }));
    }

    const frozenRecords = Object.freeze(records);
    const recordsHash = await sha256Digest(canonicalizeJson(frozenRecords as unknown as JsonValue));
    if (parsed.manifest.recordsSha256 !== recordsHash) {
      fail('RESTORE_RECORDS_HASH_MISMATCH', 'Complete records array checksum mismatch.');
    }
    const packageHash = await sha256Digest(canonicalizeJson(checksumInput(parsed)));
    if (parsed.packageSha256 !== packageHash) {
      fail('RESTORE_PACKAGE_HASH_MISMATCH', 'Complete package checksum mismatch.');
    }

    for (const record of frozenRecords) {
      const payload = record.payload as JsonObject;
      if (record.recordKind === 'fundamentalSnapshot') {
        await requireReference(seen, this.lookup, 'fundamentalBundle', String(payload.bundleId), record.recordId);
        await requireReference(seen, this.lookup, 'fundamentalAnalysis', String(payload.analysisId), record.recordId);
      }
      if (record.recordKind === 'activePointer') {
        const pointerKind = payload.pointerKind;
        if (pointerKind === 'fundamental_snapshot') {
          await requireReference(seen, this.lookup, 'fundamentalSnapshot', String(payload.targetId), record.recordId);
        } else if (pointerKind === 'price_overlay') {
          await requireReference(seen, this.lookup, 'historicalPriceOverlay', String(payload.targetId), record.recordId);
        }
      }
    }

    const conflicts: RestoreConflict[] = [];
    for (const record of frozenRecords) {
      const existing = await this.lookup.find(record.recordKind, record.recordId);
      if (existing === undefined) continue;
      conflicts.push(Object.freeze({
        recordKind: record.recordKind,
        recordId: record.recordId,
        incomingPayloadSha256: record.payloadSha256,
        ...(existing.payloadSha256 === undefined ? {} : { existingPayloadSha256: existing.payloadSha256 }),
        identical: existing.payloadSha256 === record.payloadSha256,
      }));
    }
    conflicts.sort((left, right) => left.recordKind.localeCompare(right.recordKind, 'en')
      || left.recordId.localeCompare(right.recordId, 'en'));

    return Object.freeze({
      valid: true,
      previewId: packageHash,
      formatVersion: parsed.formatVersion,
      targetFormatVersion: LOCAL_EXPORT_VERSION,
      ...(migrationPlan === undefined ? {} : { migrationPlan }),
      recordCountsByKind: Object.freeze(counts),
      issuerCiks: Object.freeze([...issuerCiks].sort((left, right) => left.localeCompare(right, 'en'))),
      overlayCount: counts.historicalPriceOverlay,
      conflicts: Object.freeze(conflicts),
      incompatibleRecords: Object.freeze([]),
      estimatedWrites: frozenRecords.length,
      readyForExplicitRestore: conflicts.length === 0,
      explicitConfirmationRequired: true,
      packageSha256: packageHash,
      records: frozenRecords,
    });
  }
}
