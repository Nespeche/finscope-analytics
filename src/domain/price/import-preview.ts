import { isSha256Digest, type Sha256Digest } from '../../core/sha256';
import {
  classifyHistoricalPriceQuality,
  type HistoricalPriceQualityAxes,
} from '../analytics/quality-classifier';
import { freezeDomainRecord, parseCik, type Cik, type QualityClassification } from '../model';
import type { HistoricalPriceObservation } from './types';

export type HistoricalPriceFrequency =
  | 'irregular'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';
export type HistoricalPriceAdjustmentStatus = 'unadjusted' | 'adjusted' | 'unknown';
export type HistoricalPriceImportMethod = 'csv_import' | 'manual_entry';
export type DuplicateDateResolution = 'reject' | 'keep_last';

export interface HistoricalPriceImportScope {
  readonly issuerCik: Cik | string;
  readonly instrument: Readonly<{
    symbol: string;
    venueMic: string;
    instrumentId?: string;
  }>;
  readonly currency: string;
  readonly frequency: HistoricalPriceFrequency;
  readonly adjustmentStatus: HistoricalPriceAdjustmentStatus;
}

export interface HistoricalPriceImportSource {
  readonly method: HistoricalPriceImportMethod;
  readonly profileId: 'local_csv_manual_v1';
  readonly sourceFileSha256?: string;
  readonly sourceEvidenceFingerprint?: Sha256Digest;
}

export interface PriceImportIssue {
  readonly code: 'DUPLICATE_DATE' | 'INVALID_SCOPE';
  readonly severity: 'error';
  readonly message: string;
  readonly date?: string;
}

export interface HistoricalPriceImportPreview {
  readonly previewId: string;
  readonly scope: Readonly<{
    issuerCik: Cik;
    instrument: Readonly<{
      symbol: string;
      venueMic: string;
      instrumentId?: string;
    }>;
    currency: string;
    frequency: HistoricalPriceFrequency;
    adjustmentStatus: HistoricalPriceAdjustmentStatus;
    window: Readonly<{ startDate: string; endDate: string }>;
  }>;
  readonly source: HistoricalPriceImportSource;
  readonly observations: readonly HistoricalPriceObservation[];
  readonly issues: readonly PriceImportIssue[];
  readonly warnings: readonly string[];
  readonly duplicateResolution: DuplicateDateResolution;
  readonly priceQuality: Readonly<{
    classification: QualityClassification;
    axes: HistoricalPriceQualityAxes;
  }>;
  readonly publicationAllowed: boolean;
}

export interface ConfirmedHistoricalPriceImport {
  readonly confirmed: true;
  readonly preview: HistoricalPriceImportPreview;
}

export interface PreviewHistoricalPriceImportInput {
  readonly previewId: string;
  readonly scope: HistoricalPriceImportScope;
  readonly source: HistoricalPriceImportSource;
  readonly observations: readonly HistoricalPriceObservation[];
  readonly duplicateResolution?: DuplicateDateResolution;
}

const CURRENCY_PATTERN = /^(?:[A-Z]{3}|XXX)$/u;
const MIC_PATTERN = /^[A-Z0-9]{4}$/u;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{64}$/u;

function validateScope(scope: HistoricalPriceImportScope): Readonly<{
  issuerCik: Cik;
  instrument: Readonly<{ symbol: string; venueMic: string; instrumentId?: string }>;
  currency: string;
  frequency: HistoricalPriceFrequency;
  adjustmentStatus: HistoricalPriceAdjustmentStatus;
}> {
  const issuerCik = parseCik(scope.issuerCik);
  const symbol = scope.instrument.symbol.trim();
  const venueMic = scope.instrument.venueMic.trim();
  if (symbol.length === 0) throw new TypeError('INVALID_PRICE_SCOPE:instrument.symbol');
  if (!MIC_PATTERN.test(venueMic)) throw new TypeError('INVALID_PRICE_SCOPE:instrument.venueMic');
  if (!CURRENCY_PATTERN.test(scope.currency)) throw new TypeError('INVALID_PRICE_SCOPE:currency');
  if (
    scope.frequency !== 'irregular'
    && scope.frequency !== 'daily'
    && scope.frequency !== 'weekly'
    && scope.frequency !== 'monthly'
    && scope.frequency !== 'quarterly'
    && scope.frequency !== 'annual'
  ) {
    throw new TypeError('INVALID_PRICE_SCOPE:frequency');
  }
  if (
    scope.adjustmentStatus !== 'unadjusted'
    && scope.adjustmentStatus !== 'adjusted'
    && scope.adjustmentStatus !== 'unknown'
  ) {
    throw new TypeError('INVALID_PRICE_SCOPE:adjustmentStatus');
  }
  return freezeDomainRecord({
    issuerCik,
    instrument: {
      symbol,
      venueMic,
      ...(scope.instrument.instrumentId === undefined
        ? {}
        : { instrumentId: scope.instrument.instrumentId }),
    },
    currency: scope.currency,
    frequency: scope.frequency,
    adjustmentStatus: scope.adjustmentStatus,
  });
}

function validateSource(source: HistoricalPriceImportSource): HistoricalPriceImportSource {
  if (source.profileId !== 'local_csv_manual_v1') {
    throw new TypeError('INACTIVE_PRICE_SOURCE_PROFILE');
  }
  if (source.method !== 'csv_import' && source.method !== 'manual_entry') {
    throw new TypeError('INVALID_PRICE_IMPORT_METHOD');
  }
  if (
    source.sourceFileSha256 !== undefined
    && !SOURCE_SHA_PATTERN.test(source.sourceFileSha256)
  ) {
    throw new TypeError('INVALID_PRICE_SOURCE_FILE_SHA256');
  }
  if (source.sourceEvidenceFingerprint !== undefined && !isSha256Digest(source.sourceEvidenceFingerprint)) {
    throw new TypeError('INVALID_PRICE_SOURCE_EVIDENCE_FINGERPRINT');
  }
  if (source.method === 'manual_entry' && source.sourceFileSha256 !== undefined) {
    throw new TypeError('MANUAL_PRICE_SOURCE_CANNOT_HAVE_FILE_SHA256');
  }
  return freezeDomainRecord({
    method: source.method,
    profileId: source.profileId,
    ...(source.sourceFileSha256 === undefined ? {} : { sourceFileSha256: source.sourceFileSha256 }),
    ...(source.sourceEvidenceFingerprint === undefined
      ? {}
      : { sourceEvidenceFingerprint: source.sourceEvidenceFingerprint }),
  });
}

function resolveObservations(
  observations: readonly HistoricalPriceObservation[],
  duplicateResolution: DuplicateDateResolution,
): Readonly<{
  observations: readonly HistoricalPriceObservation[];
  duplicateDates: readonly string[];
}> {
  if (observations.length === 0) throw new TypeError('PRICE_PREVIEW_REQUIRES_OBSERVATIONS');
  const byDate = new Map<string, HistoricalPriceObservation>();
  const duplicateDates = new Set<string>();
  for (const observation of observations) {
    if (byDate.has(observation.date)) duplicateDates.add(observation.date);
    if (!byDate.has(observation.date) || duplicateResolution === 'keep_last') {
      byDate.set(observation.date, observation);
    }
  }
  const resolved = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date, 'en'));
  return freezeDomainRecord({
    observations: duplicateDates.size === 0 || duplicateResolution === 'keep_last'
      ? resolved
      : [...observations].sort((left, right) => left.date.localeCompare(right.date, 'en')),
    duplicateDates: [...duplicateDates].sort((left, right) => left.localeCompare(right, 'en')),
  });
}

/** Builds a read-only preview. It has no persistence dependency by design. */
export function createHistoricalPriceImportPreview(
  input: PreviewHistoricalPriceImportInput,
): HistoricalPriceImportPreview {
  if (input.previewId.trim().length === 0) throw new TypeError('PRICE_PREVIEW_ID_REQUIRED');
  const duplicateResolution = input.duplicateResolution ?? 'reject';
  const scope = validateScope(input.scope);
  const source = validateSource(input.source);
  const resolved = resolveObservations(input.observations, duplicateResolution);
  const unresolvedDuplicates = resolved.duplicateDates.length > 0 && duplicateResolution === 'reject';
  const issues: PriceImportIssue[] = unresolvedDuplicates
    ? resolved.duplicateDates.map((date) => freezeDomainRecord({
      code: 'DUPLICATE_DATE' as const,
      severity: 'error' as const,
      message: `Duplicate date ${date} requires an explicit deterministic resolution.`,
      date,
    }))
    : [];
  const warnings = resolved.duplicateDates.length > 0 && duplicateResolution === 'keep_last'
    ? [`Resolved duplicate dates using keep_last: ${resolved.duplicateDates.join(', ')}`]
    : [];
  const axes: HistoricalPriceQualityAxes = freezeDomainRecord({
    rowValidity: 'all_valid',
    dateIntegrity: unresolvedDuplicates
      ? 'invalid'
      : resolved.duplicateDates.length > 0 ? 'duplicates_resolved' : 'unique_sorted',
    currencyIntegrity: scope.currency === 'XXX' ? 'unknown_declared' : 'single_declared',
    adjustmentDisclosure: scope.adjustmentStatus === 'unknown' ? 'unknown' : 'declared',
  });
  const classification = classifyHistoricalPriceQuality(axes);
  const first = resolved.observations[0];
  const last = resolved.observations.at(-1);
  if (first === undefined || last === undefined) throw new TypeError('PRICE_PREVIEW_REQUIRES_OBSERVATIONS');

  return freezeDomainRecord({
    previewId: input.previewId,
    scope: {
      ...scope,
      window: { startDate: first.date, endDate: last.date },
    },
    source,
    observations: resolved.observations,
    issues,
    warnings,
    duplicateResolution,
    priceQuality: { classification, axes },
    publicationAllowed: issues.length === 0 && classification !== 'insufficient',
  });
}

/** Explicit confirmation gate; invalid or unconfirmed previews cannot reach persistence. */
export function confirmHistoricalPriceImport(
  preview: HistoricalPriceImportPreview,
  confirmed: boolean,
): ConfirmedHistoricalPriceImport {
  if (!confirmed) throw new TypeError('PRICE_IMPORT_CONFIRMATION_REQUIRED');
  if (!preview.publicationAllowed) throw new TypeError('PRICE_IMPORT_PREVIEW_INVALID');
  return freezeDomainRecord({ confirmed: true as const, preview });
}

export async function publishConfirmedHistoricalPriceImport<Result>(
  confirmedImport: ConfirmedHistoricalPriceImport | undefined,
  persist: (confirmedImport: ConfirmedHistoricalPriceImport) => Promise<Result> | Result,
): Promise<Result> {
  if (confirmedImport?.confirmed !== true || !confirmedImport.preview.publicationAllowed) {
    throw new TypeError('PRICE_IMPORT_CONFIRMATION_REQUIRED');
  }
  return await persist(confirmedImport);
}
