import {
  normalizeCik,
  type Cik,
} from './cik';
import {
  parseLocalOperationIssue,
  type IdentityAmbiguousIssue,
} from '../issues/local-issue';

export type AccountingStandard = 'us_gaap' | 'ifrs' | 'unknown';
export type EntityType =
  | 'operating_company'
  | 'financial_institution'
  | 'insurance'
  | 'reit'
  | 'unknown';

export interface IssuerIdentity {
  readonly cik: Cik;
  readonly legalName: string;
  readonly accountingStandard: AccountingStandard;
  readonly entityType: EntityType;
  readonly analysisProfile: string;
}

export interface IssuerCandidateInput {
  readonly cik: string | number;
  readonly legalName: string;
  readonly aliases: readonly string[];
  readonly accountingStandard?: AccountingStandard;
  readonly entityType?: EntityType;
  readonly analysisProfile: string;
}

export interface IssuerCandidate extends IssuerIdentity {
  readonly aliases: readonly string[];
}

export type IssuerResolution =
  | Readonly<{ readonly status: 'resolved'; readonly issuer: IssuerIdentity }>
  | Readonly<{
    readonly status: 'ambiguous';
    readonly issue: IdentityAmbiguousIssue;
    readonly candidates: readonly IssuerIdentity[];
  }>
  | Readonly<{ readonly status: 'not_found'; readonly query: string }>;

function normalizeLookupText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleUpperCase('en-US');
}

function freezeIdentity(candidate: IssuerCandidate): IssuerIdentity {
  return Object.freeze({
    cik: candidate.cik,
    legalName: candidate.legalName,
    accountingStandard: candidate.accountingStandard,
    entityType: candidate.entityType,
    analysisProfile: candidate.analysisProfile,
  });
}

export function createIssuerCandidate(input: IssuerCandidateInput): IssuerCandidate {
  const legalName = input.legalName.trim();
  const analysisProfile = input.analysisProfile.trim();
  if (legalName.length === 0 || analysisProfile.length === 0) {
    throw new TypeError('INVALID_ISSUER_CANDIDATE');
  }

  const aliases = [...new Set(input.aliases.map(normalizeLookupText).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'en'));
  if (aliases.length === 0) {
    throw new TypeError('ISSUER_CANDIDATE_REQUIRES_ALIAS');
  }

  return Object.freeze({
    cik: normalizeCik(input.cik),
    legalName,
    aliases: Object.freeze(aliases),
    accountingStandard: input.accountingStandard ?? 'unknown',
    entityType: input.entityType ?? 'unknown',
    analysisProfile,
  });
}

function createIdentityAmbiguousIssue(query: string): IdentityAmbiguousIssue {
  const issue = parseLocalOperationIssue({
    kind: 'local_operation_issue',
    code: 'identity_ambiguous',
    message: `More than one issuer matches "${query}". Select the issuer by CIK.`,
    pipelineState: 'failed',
    retryability: 'after_user_action',
    recoveryActions: ['select_issuer_by_cik'],
    preservedCapabilities: ['definitions', 'evidence'],
    blockedOperations: ['requested_operation'],
    messageKey: 'error.identity_ambiguous',
    accessibilityKey: 'a11y.error.identity_ambiguous',
  });
  if (issue.code !== 'identity_ambiguous') {
    throw new Error('IDENTITY_AMBIGUOUS_ISSUE_INVARIANT');
  }
  return issue;
}

export function resolveIssuer(
  query: string,
  candidateInputs: readonly IssuerCandidateInput[],
): IssuerResolution {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return Object.freeze({ status: 'not_found', query: trimmedQuery });
  }

  const candidates = candidateInputs.map(createIssuerCandidate);
  let matches: readonly IssuerCandidate[];

  try {
    const cik = normalizeCik(trimmedQuery);
    matches = candidates.filter((candidate) => candidate.cik === cik);
  } catch {
    const normalizedQuery = normalizeLookupText(trimmedQuery);
    matches = candidates.filter((candidate) => (
      candidate.aliases.includes(normalizedQuery)
      || normalizeLookupText(candidate.legalName) === normalizedQuery
    ));
  }

  const uniqueMatches = [...new Map(matches.map((candidate) => [candidate.cik, candidate])).values()]
    .sort((left, right) => left.cik.localeCompare(right.cik, 'en'));

  if (uniqueMatches.length === 1) {
    const issuer = uniqueMatches[0];
    if (issuer === undefined) throw new Error('ISSUER_RESOLUTION_INVARIANT');
    return Object.freeze({ status: 'resolved', issuer: freezeIdentity(issuer) });
  }
  if (uniqueMatches.length > 1) {
    return Object.freeze({
      status: 'ambiguous',
      issue: createIdentityAmbiguousIssue(trimmedQuery),
      candidates: Object.freeze(uniqueMatches.map(freezeIdentity)),
    });
  }
  return Object.freeze({ status: 'not_found', query: trimmedQuery });
}
