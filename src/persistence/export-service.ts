import { canonicalizeJson, type JsonObject, type JsonValue } from '../core/canonical-json';
import { sha256Digest, type Sha256Digest } from '../core/sha256';
import type { FundamentalRepositoryRecords } from './snapshot-repository';
import type { PriceRepositoryRecords } from './price-repository';

export const LOCAL_EXPORT_FORMAT = 'finscope-local-export';
export const LOCAL_EXPORT_VERSION = '1.1.0';

export type LocalExportRecordKind =
  | 'fundamentalSnapshot'
  | 'fundamentalBundle'
  | 'fundamentalAnalysis'
  | 'historicalPriceOverlay'
  | 'priceAnalysis'
  | 'activePointer'
  | 'commitRecord';

export interface LocalExportRecord {
  readonly schemaId: string;
  readonly recordKind: LocalExportRecordKind;
  readonly recordId: string;
  readonly payloadSha256: Sha256Digest;
  readonly payload: JsonValue;
}

export interface LocalExportManifest {
  readonly format: typeof LOCAL_EXPORT_FORMAT;
  readonly formatVersion: typeof LOCAL_EXPORT_VERSION;
  readonly createdAt: string;
  readonly recordCount: number;
  readonly recordsSha256: Sha256Digest;
}

export interface LocalExportPackage {
  readonly format: typeof LOCAL_EXPORT_FORMAT;
  readonly version: typeof LOCAL_EXPORT_VERSION;
  readonly formatVersion: typeof LOCAL_EXPORT_VERSION;
  readonly manifest: LocalExportManifest;
  readonly records: readonly LocalExportRecord[];
  readonly packageSha256: Sha256Digest;
}

export interface FundamentalExportSource {
  readAllRecords(): Promise<FundamentalRepositoryRecords>;
}

export interface PriceExportSource {
  readAllRecords(): Promise<PriceRepositoryRecords>;
}

interface CandidateRecord {
  readonly schemaId: string;
  readonly recordKind: LocalExportRecordKind;
  readonly recordId: string;
  readonly payload: unknown;
}

const schemaIds = Object.freeze({
  fundamentalSnapshot: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/FundamentalSnapshotRecord',
  fundamentalBundle: 'https://finscope.local/schemas/fundamental-bundle.schema.json',
  fundamentalAnalysis: 'https://finscope.local/schemas/analysis-results.schema.json#/$defs/FundamentalAnalysis',
  historicalPriceOverlay: 'https://finscope.local/schemas/historical-price-overlay.schema.json',
  priceAnalysis: 'https://finscope.local/schemas/analysis-results.schema.json#/$defs/PriceAnalysis',
  activePointer: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/ActivePointerRecord',
  commitRecord: 'https://finscope.local/schemas/storage-records.schema.json#/$defs/CommitRecord',
} satisfies Record<LocalExportRecordKind, string>);

const forbiddenKeys = new Set([
  'refreshconsent', 'storageconsent', 'networkconsent', 'consents', 'secret', 'secrets',
  'apikey', 'authorization', 'deploymentvariables', 'environmentvariables', 'logs',
  'temporaryfiles', 'cachetimestamp',
]);

function toJsonValue(value: unknown, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError('EXPORT_PAYLOAD_NOT_CANONICAL_JSON');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('EXPORT_PAYLOAD_NOT_JSON');
  if (ancestors.has(value)) throw new TypeError('EXPORT_PAYLOAD_CYCLIC');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((entry) => toJsonValue(entry, ancestors)));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('EXPORT_PAYLOAD_NOT_PLAIN_JSON');
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new TypeError('EXPORT_PAYLOAD_CONTAINS_UNDEFINED');
      output[key] = toJsonValue(entry, ancestors);
    }
    return Object.freeze(output);
  } finally {
    ancestors.delete(value);
  }
}

function containsForbiddenData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (ancestors.has(value)) return true;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.some((entry) => containsForbiddenData(entry, ancestors));
    for (const [key, entry] of Object.entries(value)) {
      if (forbiddenKeys.has(key.toLowerCase())) return true;
      if (containsForbiddenData(entry, ancestors)) return true;
    }
    return false;
  } finally {
    ancestors.delete(value);
  }
}

function isEligibleRecord(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.userOwned === false || record.valid === false || record.quarantined === true) return false;
  if (record.integrityStatus === 'invalid' || record.integrityStatus === 'quarantined') return false;
  return !containsForbiddenData(value);
}

function pointerId(pointer: Readonly<{ issuerCik: string; pointerKind: string }>): string {
  return `${pointer.issuerCik}:${pointer.pointerKind}`;
}

function collectCandidates(
  fundamental: FundamentalRepositoryRecords,
  price: PriceRepositoryRecords,
): readonly CandidateRecord[] {
  const candidates: CandidateRecord[] = [
    ...fundamental.snapshots.map((payload) => ({ schemaId: schemaIds.fundamentalSnapshot, recordKind: 'fundamentalSnapshot' as const, recordId: payload.snapshotId, payload })),
    ...fundamental.bundles.map((payload) => ({ schemaId: schemaIds.fundamentalBundle, recordKind: 'fundamentalBundle' as const, recordId: payload.bundleId, payload })),
    ...fundamental.analyses.map((payload) => ({ schemaId: schemaIds.fundamentalAnalysis, recordKind: 'fundamentalAnalysis' as const, recordId: payload.analysisId, payload })),
    ...price.overlays.map((payload) => ({ schemaId: schemaIds.historicalPriceOverlay, recordKind: 'historicalPriceOverlay' as const, recordId: `${payload.overlayId}:${payload.overlayVersion}`, payload })),
    ...price.analyses.map((payload) => ({ schemaId: schemaIds.priceAnalysis, recordKind: 'priceAnalysis' as const, recordId: payload.analysisId, payload })),
    ...[...fundamental.pointers, ...price.pointers].map((payload) => ({ schemaId: schemaIds.activePointer, recordKind: 'activePointer' as const, recordId: pointerId(payload), payload })),
    ...[...fundamental.commits, ...price.commits].map((payload) => ({ schemaId: schemaIds.commitRecord, recordKind: 'commitRecord' as const, recordId: payload.transactionId, payload })),
  ];
  const unique = new Map<string, CandidateRecord>();
  for (const candidate of candidates) {
    if (!isEligibleRecord(candidate.payload)) continue;
    const key = `${candidate.recordKind}:${candidate.recordId}`;
    if (unique.has(key)) throw new TypeError(`DUPLICATE_EXPORT_RECORD:${key}`);
    unique.set(key, candidate);
  }
  return Object.freeze([...unique.values()].sort((left, right) => (
    left.recordKind.localeCompare(right.recordKind, 'en') || left.recordId.localeCompare(right.recordId, 'en')
  )));
}

async function buildRecord(candidate: CandidateRecord): Promise<LocalExportRecord> {
  const payload = toJsonValue(candidate.payload);
  const payloadSha256 = await sha256Digest(canonicalizeJson(payload));
  return Object.freeze({
    schemaId: candidate.schemaId,
    recordKind: candidate.recordKind,
    recordId: candidate.recordId,
    payloadSha256,
    payload,
  });
}

function checksumInput(
  manifest: LocalExportManifest,
  records: readonly LocalExportRecord[],
): JsonObject {
  return {
    format: LOCAL_EXPORT_FORMAT,
    version: LOCAL_EXPORT_VERSION,
    formatVersion: LOCAL_EXPORT_VERSION,
    manifest: manifest as unknown as JsonValue,
    records: records as unknown as JsonValue,
  };
}

export class LocalExportService {
  constructor(
    private readonly fundamentalSource: FundamentalExportSource,
    private readonly priceSource: PriceExportSource,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async createPackage(): Promise<LocalExportPackage> {
    const [fundamental, price] = await Promise.all([
      this.fundamentalSource.readAllRecords(),
      this.priceSource.readAllRecords(),
    ]);
    const candidates = collectCandidates(fundamental, price);
    const records = Object.freeze(await Promise.all(candidates.map(buildRecord)));
    const recordsSha256 = await sha256Digest(canonicalizeJson(records as unknown as JsonValue));
    const manifest: LocalExportManifest = Object.freeze({
      format: LOCAL_EXPORT_FORMAT,
      formatVersion: LOCAL_EXPORT_VERSION,
      createdAt: this.clock(),
      recordCount: records.length,
      recordsSha256,
    });
    const packageSha256 = await sha256Digest(canonicalizeJson(checksumInput(manifest, records)));
    return Object.freeze({
      format: LOCAL_EXPORT_FORMAT,
      version: LOCAL_EXPORT_VERSION,
      formatVersion: LOCAL_EXPORT_VERSION,
      manifest,
      records,
      packageSha256,
    });
  }

  async serialize(): Promise<string> {
    return canonicalizeJson(await this.createPackage() as unknown as JsonValue);
  }
}
