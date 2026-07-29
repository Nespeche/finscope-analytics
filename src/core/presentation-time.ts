import { assertRfc3339Instant, type Rfc3339Instant } from './clock';

const isoDateBrand: unique symbol = Symbol('IsoDate');

export type IsoDate = string & {
  readonly [isoDateBrand]: true;
};

export interface PresentationTimeContext {
  readonly evaluationDate: IsoDate;
  readonly locale: string;
  readonly timeZone: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MILLISECONDS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function parseIsoDateParts(value: string): readonly [number, number, number] {
  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new TypeError(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  const [, yearText, monthText, dayText] = match;
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    throw new TypeError(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximum = days[month - 1];
  if (maximum === undefined || day < 1 || day > maximum) {
    throw new TypeError(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
  return [year, month, day];
}

export function parseIsoDate(value: string): IsoDate {
  parseIsoDateParts(value);
  return value as IsoDate;
}

function epochMillisecondsForIsoDate(value: IsoDate): number {
  const [year, month, day] = parseIsoDateParts(value);
  return Date.UTC(year, month - 1, day);
}

export function calculateDisplayAgeDays(asOfDate: IsoDate, evaluationDate: IsoDate): number {
  const delta = epochMillisecondsForIsoDate(evaluationDate) - epochMillisecondsForIsoDate(asOfDate);
  if (delta < 0) {
    throw new RangeError('evaluationDate must not precede asOfDate.');
  }
  return delta / MILLISECONDS_PER_DAY;
}

export function createPresentationTimeContext(input: {
  readonly evaluationDate: string;
  readonly locale: string;
  readonly timeZone: string;
}): PresentationTimeContext {
  if (input.locale.trim() === '' || input.timeZone.trim() === '') {
    throw new TypeError('Presentation locale and timezone must be explicit non-empty strings.');
  }
  const evaluationDate = parseIsoDate(input.evaluationDate);
  new Intl.DateTimeFormat(input.locale, { timeZone: input.timeZone }).format(0);
  return Object.freeze({
    evaluationDate,
    locale: input.locale,
    timeZone: input.timeZone,
  });
}

export function formatInstantForPresentation(
  instant: Rfc3339Instant,
  context: PresentationTimeContext,
): string {
  assertRfc3339Instant(instant);
  return new Intl.DateTimeFormat(context.locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: context.timeZone,
  }).format(new Date(instant));
}

export function formatIsoDateForPresentation(
  date: IsoDate,
  context: PresentationTimeContext,
): string {
  const [year, month, day] = parseIsoDateParts(date);
  return new Intl.DateTimeFormat(context.locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
