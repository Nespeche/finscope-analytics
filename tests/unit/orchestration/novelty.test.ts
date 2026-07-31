import { describe, expect, it } from 'vitest';
import type { Sha256Digest } from '../../../src/core/sha256';
import {
  computeSubmissionsNoveltyFingerprint,
  decideCompanyFactsFetch,
  type SubmissionNoveltyRecord,
} from '../../../src/domain/orchestration/novelty';

const filings: readonly SubmissionNoveltyRecord[] = Object.freeze([
  Object.freeze({
    accessionNumber: '0000320193-25-000079',
    form: '10-Q',
    filingDate: '2025-08-01',
    reportDate: '2025-06-28',
    primaryDocument: 'aapl-20250628.htm',
  }),
  Object.freeze({
    accessionNumber: '0000320193-24-000123',
    form: '10-K',
    filingDate: '2024-11-01',
    reportDate: '2024-09-28',
    primaryDocument: 'aapl-20240928.htm',
  }),
]);

describe('Submissions novelty fingerprint', () => {
  it('is deterministic, order-independent and excludes unrelated local metadata', async () => {
    const forward = await computeSubmissionsNoveltyFingerprint(filings);
    const reverse = await computeSubmissionsNoveltyFingerprint([...filings].reverse());
    expect(forward).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(reverse).toBe(forward);
  });

  it('avoids Company Facts when Submissions are unchanged', async () => {
    const fingerprint = await computeSubmissionsNoveltyFingerprint(filings);
    expect(decideCompanyFactsFetch({
      previousFingerprint: fingerprint,
      currentFingerprint: fingerprint,
      cacheMissing: false,
      dependentAuthorityChanged: false,
      manualRefresh: false,
    })).toEqual({
      fetchCompanyFacts: false,
      noveltyDetected: false,
      reasons: [],
    });
  });

  it('fetches Company Facts only for one of the four authorized conditions', () => {
    const previous = `sha256:${'a'.repeat(64)}` as Sha256Digest;
    const current = `sha256:${'b'.repeat(64)}` as Sha256Digest;
    expect(decideCompanyFactsFetch({
      previousFingerprint: previous,
      currentFingerprint: current,
      cacheMissing: true,
      dependentAuthorityChanged: true,
      manualRefresh: true,
    })).toEqual({
      fetchCompanyFacts: true,
      noveltyDetected: true,
      reasons: [
        'novelty_detected',
        'cache_missing',
        'dependent_authority_changed',
        'manual_refresh_forced',
      ],
    });
  });
});
