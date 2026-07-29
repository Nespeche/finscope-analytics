const rfc3339InstantBrand: unique symbol = Symbol('Rfc3339Instant');

export type Rfc3339Instant = string & {
  readonly [rfc3339InstantBrand]: true;
};

export interface Clock {
  read(): Rfc3339Instant;
}

const RFC3339_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximum = days[month - 1];
  return maximum !== undefined && day >= 1 && day <= maximum;
}

export function isRfc3339Instant(value: unknown): value is Rfc3339Instant {
  if (typeof value !== 'string') {
    return false;
  }
  const match = RFC3339_INSTANT_PATTERN.exec(value);
  if (match === null) {
    return false;
  }
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  if (
    year === undefined
    || month === undefined
    || day === undefined
    || hour === undefined
    || minute === undefined
    || second === undefined
  ) {
    return false;
  }
  return isCalendarDate(Number(year), Number(month), Number(day))
    && Number(hour) <= 23
    && Number(minute) <= 59
    && Number(second) <= 59
    && (offsetHour === undefined || Number(offsetHour) <= 23)
    && (offsetMinute === undefined || Number(offsetMinute) <= 59);
}

export function assertRfc3339Instant(value: unknown): asserts value is Rfc3339Instant {
  if (!isRfc3339Instant(value)) {
    throw new TypeError(`Invalid RFC 3339 instant: ${JSON.stringify(value)}`);
  }
}

export function createFixedClock(instant: string): Clock {
  assertRfc3339Instant(instant);
  return Object.freeze({
    read: (): Rfc3339Instant => instant,
  });
}

export function readClock(clock: Clock): Rfc3339Instant {
  const instant = clock.read();
  assertRfc3339Instant(instant);
  return instant;
}
