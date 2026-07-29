import {
  parseCik,
  toSecCikFilename,
  toSecCikPathSegment,
  type Cik,
} from '../../../../src/domain/identity/cik';

export const ALLOWED_SEC_HOSTS = Object.freeze(['data.sec.gov', 'www.sec.gov'] as const);
export type AllowedSecHost = (typeof ALLOWED_SEC_HOSTS)[number];

export const ALLOWED_TAXONOMIES = Object.freeze(['us-gaap', 'ifrs-full', 'dei'] as const);
export type AllowedTaxonomy = (typeof ALLOWED_TAXONOMIES)[number];

export const SEC_TAG_PATTERN = /^[A-Za-z][A-Za-z0-9]+$/u;
const SEC_PATH_PATTERNS = Object.freeze([
  /^\/submissions\/CIK[0-9]{10}\.json$/u,
  /^\/api\/xbrl\/companyfacts\/CIK[0-9]{10}\.json$/u,
  /^\/api\/xbrl\/companyconcept\/CIK[0-9]{10}\/(?:us-gaap|ifrs-full|dei)\/[A-Za-z][A-Za-z0-9]+\.json$/u,
]);

export function isAllowedTaxonomy(value: unknown): value is AllowedTaxonomy {
  return typeof value === 'string' && ALLOWED_TAXONOMIES.includes(value as AllowedTaxonomy);
}

export function parseSecTag(value: unknown): string {
  if (typeof value !== 'string' || !SEC_TAG_PATTERN.test(value)) {
    throw new TypeError('INVALID_SEC_TAG');
  }
  return value;
}

export function isAllowlistedSecPath(pathname: string): boolean {
  return SEC_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isAllowedSecUrl(input: URL, redirectSource?: URL): boolean {
  if (
    input.protocol !== 'https:'
    || input.username.length > 0
    || input.password.length > 0
    || input.port.length > 0
    || input.search.length > 0
    || input.hash.length > 0
    || !ALLOWED_SEC_HOSTS.includes(input.hostname as AllowedSecHost)
    || !isAllowlistedSecPath(input.pathname)
  ) {
    return false;
  }
  return redirectSource === undefined || redirectSource.hostname === input.hostname;
}

export function assertAllowedSecUrl(input: URL, redirectSource?: URL): URL {
  if (!isAllowedSecUrl(input, redirectSource)) {
    throw new TypeError('SEC_URL_BLOCKED_BY_POLICY');
  }
  return input;
}

export function createSubmissionsSecUrl(cik: Cik): URL {
  return assertAllowedSecUrl(new URL(`https://data.sec.gov/submissions/${toSecCikFilename(cik)}`));
}

export function createCompanyFactsSecUrl(cik: Cik): URL {
  return assertAllowedSecUrl(new URL(
    `https://data.sec.gov/api/xbrl/companyfacts/${toSecCikFilename(cik)}`,
  ));
}

export function createCompanyConceptSecUrl(
  cik: Cik,
  taxonomy: AllowedTaxonomy,
  tag: string,
): URL {
  parseCik(cik);
  if (!isAllowedTaxonomy(taxonomy)) throw new TypeError('INVALID_SEC_TAXONOMY');
  const parsedTag = parseSecTag(tag);
  return assertAllowedSecUrl(new URL(
    `https://data.sec.gov/api/xbrl/companyconcept/${toSecCikPathSegment(cik)}/${taxonomy}/${parsedTag}.json`,
  ));
}
