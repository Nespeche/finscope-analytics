import { canonicalJsonBytes, type JsonObject } from '../../core/canonical-json';
import { sha256Digest, type Sha256Digest } from '../../core/sha256';

export interface SubmissionNoveltyRecord {
  readonly accessionNumber: string;
  readonly form: string;
  readonly filingDate: string;
  readonly reportDate: string;
  readonly primaryDocument: string;
}

export type CompanyFactsFetchReason =
  | 'novelty_detected'
  | 'cache_missing'
  | 'dependent_authority_changed'
  | 'manual_refresh_forced';

export interface CompanyFactsFetchDecisionInput {
  readonly previousFingerprint?: Sha256Digest;
  readonly currentFingerprint: Sha256Digest;
  readonly cacheMissing: boolean;
  readonly dependentAuthorityChanged: boolean;
  readonly manualRefresh: boolean;
}

export interface CompanyFactsFetchDecision {
  readonly fetchCompanyFacts: boolean;
  readonly noveltyDetected: boolean;
  readonly reasons: readonly CompanyFactsFetchReason[];
}

function requireText(value: string, field: keyof SubmissionNoveltyRecord): string {
  if (value.length === 0) throw new TypeError(`EMPTY_SUBMISSION_NOVELTY_FIELD:${field}`);
  return value;
}

function projectRecord(record: SubmissionNoveltyRecord): JsonObject {
  return Object.freeze({
    accessionNumber: requireText(record.accessionNumber, 'accessionNumber'),
    form: requireText(record.form, 'form'),
    filingDate: requireText(record.filingDate, 'filingDate'),
    reportDate: requireText(record.reportDate, 'reportDate'),
    primaryDocument: requireText(record.primaryDocument, 'primaryDocument'),
  });
}

function compareRecord(left: SubmissionNoveltyRecord, right: SubmissionNoveltyRecord): number {
  return left.accessionNumber.localeCompare(right.accessionNumber, 'en')
    || left.form.localeCompare(right.form, 'en')
    || left.filingDate.localeCompare(right.filingDate, 'en')
    || left.reportDate.localeCompare(right.reportDate, 'en')
    || left.primaryDocument.localeCompare(right.primaryDocument, 'en');
}

/**
 * Computes the submissions novelty fingerprint from only the five authority fields.
 * Input ordering and local-clock metadata cannot change the result.
 */
export async function computeSubmissionsNoveltyFingerprint(
  records: readonly SubmissionNoveltyRecord[],
): Promise<Sha256Digest> {
  const ordered = [...records].sort(compareRecord).map(projectRecord);
  return sha256Digest(canonicalJsonBytes(ordered));
}

export function decideCompanyFactsFetch(
  input: CompanyFactsFetchDecisionInput,
): CompanyFactsFetchDecision {
  const noveltyDetected = input.previousFingerprint !== undefined
    && input.previousFingerprint !== input.currentFingerprint;
  const reasons: CompanyFactsFetchReason[] = [];
  if (noveltyDetected) reasons.push('novelty_detected');
  if (input.cacheMissing) reasons.push('cache_missing');
  if (input.dependentAuthorityChanged) reasons.push('dependent_authority_changed');
  if (input.manualRefresh) reasons.push('manual_refresh_forced');
  return Object.freeze({
    fetchCompanyFacts: reasons.length > 0,
    noveltyDetected,
    reasons: Object.freeze(reasons),
  });
}
