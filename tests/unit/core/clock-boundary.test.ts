import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  createFixedClock,
  isRfc3339Instant,
  readClock,
  type Clock,
  type Rfc3339Instant,
} from '../../../src/core/clock';
import {
  calculateDisplayAgeDays,
  createPresentationTimeContext,
  formatInstantForPresentation,
  formatIsoDateForPresentation,
  parseIsoDate,
} from '../../../src/core/presentation-time';

describe('clock and presentation-only time boundary', () => {
  it('requires an injected clock and validates every value read from it', () => {
    const clock = createFixedClock('2025-01-15T12:00:00.000Z');
    expect(readClock(clock)).toBe('2025-01-15T12:00:00.000Z');
    expect(isRfc3339Instant('2024-02-29T23:59:59Z')).toBe(true);
    expect(isRfc3339Instant('2025-02-29T00:00:00Z')).toBe(false);
    const invalidClock: Clock = { read: () => 'not-an-instant' as Rfc3339Instant };
    expect(() => readClock(invalidClock)).toThrow(/Invalid RFC 3339/u);
  });

  it('derives display age only from explicit ISO dates, including leap-day boundaries', () => {
    expect(calculateDisplayAgeDays(parseIsoDate('2024-02-28'), parseIsoDate('2024-03-01'))).toBe(2);
    expect(calculateDisplayAgeDays(parseIsoDate('2025-01-01'), parseIsoDate('2025-01-01'))).toBe(0);
    expect(() => calculateDisplayAgeDays(parseIsoDate('2025-01-02'), parseIsoDate('2025-01-01')))
      .toThrow(/must not precede/u);
  });

  it('requires explicit locale, timezone and evaluation date for presentation formatting', () => {
    const context = createPresentationTimeContext({
      evaluationDate: '2025-01-15',
      locale: 'en-US',
      timeZone: 'America/New_York',
    });
    const instant = '2025-01-15T12:00:00.000Z' as Rfc3339Instant;
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'America/New_York',
    }).format(new Date(instant));
    expect(formatInstantForPresentation(instant, context)).toBe(expected);
    expect(formatIsoDateForPresentation(parseIsoDate('2025-01-15'), context)).toContain('2025');
    expect(() => createPresentationTimeContext({
      evaluationDate: '2025-01-15',
      locale: '',
      timeZone: 'UTC',
    })).toThrow(/explicit non-empty/u);
  });

  it('does not consult ambient Date.now or default locale/timezone', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('ambient clock consulted');
    });
    const clock = createFixedClock('2025-01-15T12:00:00.000Z');
    expect(readClock(clock)).toBe('2025-01-15T12:00:00.000Z');
    expect(calculateDisplayAgeDays(parseIsoDate('2025-01-10'), parseIsoDate('2025-01-15'))).toBe(5);
    nowSpy.mockRestore();
  });

  it('keeps the normative clock module free of ambient clock and locale APIs', async () => {
    const clockSource = await readFile('src/core/clock.ts', 'utf8');
    const presentationSource = await readFile('src/core/presentation-time.ts', 'utf8');
    expect(clockSource).not.toContain('Date.now');
    expect(clockSource).not.toContain('new Date');
    expect(clockSource).not.toContain('Intl.');
    expect(presentationSource).not.toContain('Date.now');
    expect(presentationSource).not.toMatch(/new Intl\.DateTimeFormat\(\s*\)/u);
  });
});
