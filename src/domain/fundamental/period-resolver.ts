export type FiscalPeriodCode = 'FY' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type PeriodClassification = 'fy' | 'quarter' | 'unclassified';

export interface FiscalFactPeriod {
  readonly factId: string;
  readonly canonicalConceptId: string;
  readonly kind: 'instant' | 'duration';
  readonly endDate: string;
  readonly startDate?: string;
  readonly fiscalYear?: number;
  readonly fiscalPeriod?: string;
  readonly scopeId: string;
  readonly currency?: string;
  readonly restatementLineageId?: string;
}

export interface ClassifiedFiscalPeriod extends FiscalFactPeriod {
  readonly classification: PeriodClassification;
  readonly durationDays?: number;
  readonly quarterNumber?: 1 | 2 | 3 | 4;
}

export type PeriodMatch =
  | Readonly<{ state: 'available'; current: ClassifiedFiscalPeriod; prior: ClassifiedFiscalPeriod }>
  | Readonly<{ state: 'insufficient'; reasonCode: string; current?: ClassifiedFiscalPeriod }>;

export type TtmWindow =
  | Readonly<{ state: 'available'; periods: readonly ClassifiedFiscalPeriod[] }>
  | Readonly<{ state: 'insufficient'; reasonCode: string; periods: readonly ClassifiedFiscalPeriod[] }>;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const DAY_MS = 86_400_000;
const QUARTER_DURATION_VARIANCE_DAYS = 14;

function dateSerial(value: string): number {
  const match = DATE_PATTERN.exec(value);
  if (match === null) throw new TypeError('INVALID_ISO_DATE');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const serial = Date.UTC(year, month - 1, day);
  const date = new Date(serial);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError('INVALID_ISO_DATE');
  }
  return serial;
}

function durationDays(period: FiscalFactPeriod): number | undefined {
  if (period.kind === 'instant') return undefined;
  if (period.startDate === undefined) throw new TypeError('DURATION_START_REQUIRED');
  const start = dateSerial(period.startDate);
  const end = dateSerial(period.endDate);
  if (start > end) throw new TypeError('INVALID_PERIOD_ORDER');
  return Math.round((end - start) / DAY_MS);
}

function quarterNumber(code: string | undefined): 1 | 2 | 3 | 4 | undefined {
  switch (code) {
    case 'Q1': return 1;
    case 'Q2': return 2;
    case 'Q3': return 3;
    case 'Q4': return 4;
    default: return undefined;
  }
}

/** Classification requires explicit fiscal metadata; dates never imply FY or quarter. */
export function classifyFiscalPeriod(period: FiscalFactPeriod): ClassifiedFiscalPeriod {
  dateSerial(period.endDate);
  const days = durationDays(period);
  const quarter = quarterNumber(period.fiscalPeriod);
  let classification: PeriodClassification = 'unclassified';
  if (period.kind === 'duration' && period.fiscalPeriod === 'FY' && period.fiscalYear !== undefined) {
    classification = 'fy';
  } else if (period.kind === 'duration' && quarter !== undefined && period.fiscalYear !== undefined) {
    classification = 'quarter';
  }
  return Object.freeze({
    ...period,
    classification,
    ...(days === undefined ? {} : { durationDays: days }),
    ...(quarter === undefined ? {} : { quarterNumber: quarter }),
  });
}

function sameBasis(left: ClassifiedFiscalPeriod, right: ClassifiedFiscalPeriod): boolean {
  return left.canonicalConceptId === right.canonicalConceptId
    && left.scopeId === right.scopeId
    && left.currency === right.currency
    && left.restatementLineageId === right.restatementLineageId
    && left.classification === right.classification;
}

function durationsCompatible(left: ClassifiedFiscalPeriod, right: ClassifiedFiscalPeriod): boolean {
  return left.durationDays !== undefined
    && right.durationDays !== undefined
    && Math.abs(left.durationDays - right.durationDays) <= QUARTER_DURATION_VARIANCE_DAYS;
}

function periodOrdinal(period: ClassifiedFiscalPeriod): number | undefined {
  if (period.fiscalYear === undefined) return undefined;
  if (period.classification === 'fy') return period.fiscalYear;
  if (period.classification === 'quarter' && period.quarterNumber !== undefined) {
    return period.fiscalYear * 4 + period.quarterNumber - 1;
  }
  return undefined;
}

export function findComparablePrior(
  currentInput: FiscalFactPeriod,
  candidatesInput: readonly FiscalFactPeriod[],
): PeriodMatch {
  const current = classifyFiscalPeriod(currentInput);
  if (current.classification === 'unclassified' || current.fiscalYear === undefined) {
    return Object.freeze({ state: 'insufficient' as const, reasonCode: 'explicit_fiscal_metadata_required', current });
  }
  const currentFiscalYear = current.fiscalYear;
  const candidates = candidatesInput.map(classifyFiscalPeriod);
  const prior = candidates.find((candidate) =>
    candidate.fiscalYear === currentFiscalYear - 1
    && candidate.fiscalPeriod === current.fiscalPeriod
    && sameBasis(current, candidate)
    && durationsCompatible(current, candidate));
  if (prior === undefined) {
    return Object.freeze({ state: 'insufficient' as const, reasonCode: 'compatible_prior_period_missing', current });
  }
  return Object.freeze({ state: 'available' as const, current, prior });
}

export function buildTtmWindow(periodsInput: readonly FiscalFactPeriod[]): TtmWindow {
  const quarters = periodsInput.map(classifyFiscalPeriod)
    .filter((period) => period.classification === 'quarter')
    .sort((left, right) => (periodOrdinal(left) ?? -1) - (periodOrdinal(right) ?? -1)
      || left.factId.localeCompare(right.factId, 'en'));
  if (quarters.length < 4) {
    return Object.freeze({
      state: 'insufficient' as const,
      reasonCode: 'four_explicit_quarters_required' as const,
      periods: Object.freeze(quarters),
    });
  }

  const latest = quarters.at(-1);
  if (latest === undefined) throw new Error('UNREACHABLE_EMPTY_QUARTERS');
  const latestOrdinal = periodOrdinal(latest);
  if (latestOrdinal === undefined) {
    return Object.freeze({ state: 'insufficient' as const, reasonCode: 'explicit_fiscal_metadata_required', periods: Object.freeze([]) });
  }
  const requiredOrdinals = new Set([latestOrdinal - 3, latestOrdinal - 2, latestOrdinal - 1, latestOrdinal]);
  const window = quarters.filter((period) => {
    const ordinal = periodOrdinal(period);
    return ordinal !== undefined && requiredOrdinals.has(ordinal) && sameBasis(latest, period);
  });
  if (window.length !== 4 || new Set(window.map(periodOrdinal)).size !== 4) {
    return Object.freeze({
      state: 'insufficient' as const,
      reasonCode: 'consecutive_compatible_quarters_required' as const,
      periods: Object.freeze(window),
    });
  }
  const durations = window.flatMap((period) => period.durationDays === undefined ? [] : [period.durationDays]);
  if (durations.length !== 4 || Math.max(...durations) - Math.min(...durations) > QUARTER_DURATION_VARIANCE_DAYS) {
    return Object.freeze({
      state: 'insufficient' as const,
      reasonCode: 'incompatible_quarter_durations' as const,
      periods: Object.freeze(window),
    });
  }
  return Object.freeze({ state: 'available' as const, periods: Object.freeze(window) });
}

export function resolveFiscalPeriods(periodsInput: readonly FiscalFactPeriod[]): Readonly<{
  periods: readonly ClassifiedFiscalPeriod[];
  latestFy?: ClassifiedFiscalPeriod;
  latestQuarter?: ClassifiedFiscalPeriod;
  ttm: TtmWindow;
}> {
  const periods = periodsInput.map(classifyFiscalPeriod);
  const sorted = [...periods].sort((left, right) => (periodOrdinal(right) ?? -1) - (periodOrdinal(left) ?? -1)
    || right.endDate.localeCompare(left.endDate, 'en')
    || left.factId.localeCompare(right.factId, 'en'));
  const latestFy = sorted.find((period) => period.classification === 'fy');
  const latestQuarter = sorted.find((period) => period.classification === 'quarter');
  return Object.freeze({
    periods: Object.freeze(periods),
    ...(latestFy === undefined ? {} : { latestFy }),
    ...(latestQuarter === undefined ? {} : { latestQuarter }),
    ttm: buildTtmWindow(periodsInput),
  });
}
