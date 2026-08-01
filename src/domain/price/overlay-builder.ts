import { historicalPriceOverlayFingerprint } from '../fingerprints/fingerprint-service';
import { freezeDomainRecord } from '../model';
import type { ConfirmedHistoricalPriceImport } from './import-preview';
import { parseHistoricalPriceOverlay, type HistoricalPriceOverlay } from './types';

export interface HistoricalPriceOverlayBuilderInput {
  readonly overlayId: string;
  readonly overlayVersion: number;
  readonly confirmedImport: ConfirmedHistoricalPriceImport;
  readonly previousOverlay?: HistoricalPriceOverlay;
  readonly createdAt?: string;
  readonly additionalWarnings?: readonly string[];
  readonly displayAgeDays?: never;
  readonly evaluationDate?: never;
  readonly rangeStart?: never;
  readonly rangeEnd?: never;
  readonly asOfDate?: never;
  readonly observationCount?: never;
}

const FORBIDDEN_CLOCK_FIELDS = new Set([
  'displayAgeDays',
  'evaluationDate',
  'rangeStart',
  'rangeEnd',
  'asOfDate',
  'observationCount',
  'asOfLocalDate',
  'localDate',
  'localTime',
  'localTimezone',
  'localTimestamp',
]);

function rejectForbiddenClockFields(value: unknown, path = '$'): void {
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectForbiddenClockFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CLOCK_FIELDS.has(key)) {
      throw new TypeError(`FORBIDDEN_PRICE_CLOCK_FIELD:${path}.${key}`);
    }
    rejectForbiddenClockFields(child, `${path}.${key}`);
  }
}

function validateVersion(input: HistoricalPriceOverlayBuilderInput): void {
  if (!Number.isSafeInteger(input.overlayVersion) || input.overlayVersion < 1) {
    throw new TypeError('INVALID_PRICE_OVERLAY_VERSION');
  }
  const previous = input.previousOverlay;
  if (previous === undefined) return;
  if (previous.overlayId !== input.overlayId) {
    throw new TypeError('PRICE_OVERLAY_ID_CHANGED');
  }
  if (input.overlayVersion !== previous.overlayVersion + 1) {
    throw new TypeError('PRICE_OVERLAY_VERSION_MUST_INCREMENT_BY_ONE');
  }
}

/** Creates a new immutable overlay version from a validated, explicitly confirmed preview. */
export async function buildHistoricalPriceOverlay(
  input: HistoricalPriceOverlayBuilderInput,
): Promise<HistoricalPriceOverlay> {
  rejectForbiddenClockFields(input);
  validateVersion(input);
  if (input.confirmedImport.confirmed !== true) {
    throw new TypeError('PRICE_IMPORT_CONFIRMATION_REQUIRED');
  }
  const preview = input.confirmedImport.preview;
  if (!preview.publicationAllowed) throw new TypeError('PRICE_IMPORT_PREVIEW_INVALID');
  const warnings = [...new Set([...preview.warnings, ...(input.additionalWarnings ?? [])])]
    .sort((left, right) => left.localeCompare(right, 'en'));
  const fingerprintInput = {
    contractVersion: '5.0.0' as const,
    instrument: preview.scope.instrument,
    currency: preview.scope.currency,
    frequency: preview.scope.frequency,
    observations: preview.observations,
    adjustmentStatus: preview.scope.adjustmentStatus,
    origin: {
      profileId: preview.source.profileId,
      method: preview.source.method,
      ...(preview.source.sourceFileSha256 === undefined
        ? {}
        : { sourceFileSha256: preview.source.sourceFileSha256 }),
    },
    warnings,
    priceUse: 'historical_descriptive_only' as const,
  };
  const fingerprint = await historicalPriceOverlayFingerprint(fingerprintInput);
  const candidate = {
    overlayId: input.overlayId,
    overlayVersion: input.overlayVersion,
    contractVersion: '5.0.0' as const,
    issuerCik: preview.scope.issuerCik,
    instrument: preview.scope.instrument,
    currency: preview.scope.currency,
    frequency: preview.scope.frequency,
    observations: preview.observations,
    adjustmentStatus: preview.scope.adjustmentStatus,
    origin: fingerprintInput.origin,
    warnings,
    priceUse: 'historical_descriptive_only' as const,
    historicalPriceOverlayFingerprint: fingerprint,
    priceQuality: preview.priceQuality,
    ...(preview.source.sourceEvidenceFingerprint === undefined
      ? {}
      : { sourceEvidenceFingerprint: preview.source.sourceEvidenceFingerprint }),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  };
  const parsed = parseHistoricalPriceOverlay(candidate);
  return freezeDomainRecord(parsed) as HistoricalPriceOverlay;
}
