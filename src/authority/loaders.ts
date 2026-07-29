import authorityCrosswalkDocument from '../../specs/001-fundamental-analysis-platform/governance/authority-crosswalk.json';
import { createProductSchemaValidator, type ProductSchemaValidator } from '../core/schema-validator';
import type {
  AuthorityCrosswalk,
  AuthorityCrosswalkEntry,
  AuthorityDocumentCollection,
  AuthorityId,
  AuthorityReference,
  LoadedAuthority,
  PackageRootPath,
} from './types';

export type AuthorityLoadErrorCode =
  | 'INVALID_CROSSWALK'
  | 'UNKNOWN_AUTHORITY_ID'
  | 'INVALID_PACKAGE_PATH'
  | 'MISSING_DOCUMENT'
  | 'HEURISTIC_PATH_FORBIDDEN'
  | 'INVALID_POINTER'
  | 'MISSING_POINTER'
  | 'INVALID_DOCUMENT';

export class AuthorityLoadError extends Error {
  constructor(readonly code: AuthorityLoadErrorCode, message: string) {
    super(message);
    this.name = 'AuthorityLoadError';
  }
}

const AUTHORITY_ID_PATTERN = /^AUTH-[0-9]{3}$/u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:/u;
const URI_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePackageRootPath(value: string): PackageRootPath {
  if (
    value === ''
    || value.startsWith('/')
    || value.startsWith('./')
    || value.includes('\\')
    || WINDOWS_ABSOLUTE_PATH_PATTERN.test(value)
    || URI_SCHEME_PATTERN.test(value)
  ) {
    throw new AuthorityLoadError('INVALID_PACKAGE_PATH', `Invalid package-root path: ${value}`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new AuthorityLoadError('INVALID_PACKAGE_PATH', `Invalid package-root path: ${value}`);
  }
  return value as PackageRootPath;
}

function parseAuthorityId(value: unknown): AuthorityId {
  if (typeof value !== 'string' || !AUTHORITY_ID_PATTERN.test(value)) {
    throw new AuthorityLoadError('INVALID_CROSSWALK', `Invalid authority ID: ${String(value)}`);
  }
  return value as AuthorityId;
}

function parseCrosswalkEntry(value: unknown): AuthorityCrosswalkEntry {
  if (!isRecord(value)) {
    throw new AuthorityLoadError('INVALID_CROSSWALK', 'Crosswalk domain entry must be an object.');
  }
  if (
    typeof value.domainId !== 'string'
    || value.domainId === ''
    || typeof value.primaryAuthority !== 'string'
    || !Array.isArray(value.consumers)
    || value.consumers.length === 0
    || value.status !== 'ACTIVE'
  ) {
    throw new AuthorityLoadError('INVALID_CROSSWALK', 'Crosswalk domain entry is incomplete.');
  }
  return Object.freeze({
    authorityId: parseAuthorityId(value.authorityId),
    domainId: value.domainId,
    primaryAuthority: value.primaryAuthority,
    consumers: Object.freeze(value.consumers.map((consumer) => {
      if (typeof consumer !== 'string') {
        throw new AuthorityLoadError('INVALID_CROSSWALK', 'Authority consumer path must be a string.');
      }
      return parsePackageRootPath(consumer);
    })),
    status: 'ACTIVE' as const,
  });
}

export function parseAuthorityCrosswalk(value: unknown): AuthorityCrosswalk {
  if (
    !isRecord(value)
    || typeof value.crosswalkId !== 'string'
    || value.crosswalkId === ''
    || typeof value.version !== 'string'
    || value.status !== 'ACTIVE_AUTHORITY'
    || !Array.isArray(value.domains)
    || typeof value.domainCount !== 'number'
  ) {
    throw new AuthorityLoadError('INVALID_CROSSWALK', 'Authority crosswalk is malformed.');
  }
  const domains = value.domains.map(parseCrosswalkEntry);
  if (value.domainCount !== domains.length) {
    throw new AuthorityLoadError('INVALID_CROSSWALK', 'Authority crosswalk domainCount is inconsistent.');
  }
  const authorityIds = new Set<string>();
  const domainIds = new Set<string>();
  for (const domain of domains) {
    if (authorityIds.has(domain.authorityId) || domainIds.has(domain.domainId)) {
      throw new AuthorityLoadError('INVALID_CROSSWALK', 'Authority IDs and domain IDs must be unique.');
    }
    authorityIds.add(domain.authorityId);
    domainIds.add(domain.domainId);
    parseAuthorityReference(domain.primaryAuthority);
  }
  return Object.freeze({
    crosswalkId: value.crosswalkId,
    version: value.version,
    status: 'ACTIVE_AUTHORITY' as const,
    domains: Object.freeze(domains),
  });
}

export function parseAuthorityReference(reference: string): AuthorityReference {
  const fragmentIndex = reference.indexOf('#');
  const pathText = fragmentIndex < 0 ? reference : reference.slice(0, fragmentIndex);
  const fragment = fragmentIndex < 0 ? '' : reference.slice(fragmentIndex);
  if (fragment !== '' && !fragment.startsWith('#')) {
    throw new AuthorityLoadError('INVALID_POINTER', `Invalid authority fragment: ${reference}`);
  }
  return Object.freeze({
    source: reference,
    path: parsePackageRootPath(pathText),
    fragment: fragment as '' | `#${string}`,
  });
}

function isReadonlyMap(
  collection: AuthorityDocumentCollection,
): collection is ReadonlyMap<string, unknown> {
  return typeof (collection as ReadonlyMap<string, unknown>).get === 'function';
}

function readDocument(collection: AuthorityDocumentCollection, path: PackageRootPath): unknown {
  const exact = isReadonlyMap(collection) ? collection.get(path) : collection[path];
  if (exact !== undefined) {
    return exact;
  }
  const availablePaths = isReadonlyMap(collection) ? [...collection.keys()] : Object.keys(collection);
  const lower = path.toLowerCase();
  const heuristicMatch = availablePaths.find((candidate) => (
    candidate.toLowerCase() === lower
    || candidate.endsWith(`/${path}`)
    || path.endsWith(`/${candidate}`)
  ));
  if (heuristicMatch !== undefined) {
    throw new AuthorityLoadError(
      'HEURISTIC_PATH_FORBIDDEN',
      `Exact package-root path is required; refusing heuristic match ${heuristicMatch} for ${path}.`,
    );
  }
  throw new AuthorityLoadError('MISSING_DOCUMENT', `Authority document is missing: ${path}`);
}

function decodePointerToken(token: string): string {
  if (/~(?:[^01]|$)/u.test(token)) {
    throw new AuthorityLoadError('INVALID_POINTER', `Invalid JSON Pointer token: ${token}`);
  }
  return token.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function resolveJsonPointer(document: unknown, fragment: `#/${string}`): unknown {
  const tokens = fragment.slice(2).split('/').map(decodePointerToken);
  let current = document;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(token)) {
        throw new AuthorityLoadError('INVALID_POINTER', `Invalid array pointer token: ${token}`);
      }
      const index = Number(token);
      if (index >= current.length) {
        throw new AuthorityLoadError('MISSING_POINTER', `Array pointer does not exist: ${fragment}`);
      }
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, token)) {
      throw new AuthorityLoadError('MISSING_POINTER', `Object pointer does not exist: ${fragment}`);
    }
    current = current[token];
  }
  return current;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function resolveExplicitAnchor(document: unknown, fragment: `#${string}`): string {
  if (typeof document !== 'string') {
    throw new AuthorityLoadError('INVALID_POINTER', `Anchor ${fragment} requires a text document.`);
  }
  const anchor = fragment.slice(1);
  if (anchor === '' || anchor.includes('/')) {
    throw new AuthorityLoadError('INVALID_POINTER', `Invalid explicit anchor: ${fragment}`);
  }
  const escaped = escapeRegularExpression(anchor);
  const anchorPattern = new RegExp(`<a\\s+id=["']${escaped}["']\\s*><\\/a>`, 'u');
  if (!anchorPattern.test(document)) {
    throw new AuthorityLoadError('MISSING_POINTER', `Explicit anchor does not exist: ${fragment}`);
  }
  return fragment;
}

function resolveReference(document: unknown, reference: AuthorityReference): unknown {
  if (reference.fragment === '') {
    return document;
  }
  if (reference.fragment.startsWith('#/')) {
    return resolveJsonPointer(document, reference.fragment as `#/${string}`);
  }
  return resolveExplicitAnchor(document, reference.fragment);
}

export const ACTIVE_AUTHORITY_CROSSWALK = parseAuthorityCrosswalk(authorityCrosswalkDocument);

export class AuthorityLoader {
  readonly #entries: ReadonlyMap<string, AuthorityCrosswalkEntry>;

  constructor(
    readonly documents: AuthorityDocumentCollection,
    crosswalk: AuthorityCrosswalk = ACTIVE_AUTHORITY_CROSSWALK,
    readonly schemaValidator: ProductSchemaValidator = createProductSchemaValidator(),
  ) {
    this.#entries = new Map(crosswalk.domains.map((entry) => [entry.authorityId, entry]));
  }

  listAuthorityIds(): readonly AuthorityId[] {
    return Object.freeze([...this.#entries.values()].map((entry) => entry.authorityId));
  }

  loadReference<T = unknown>(referenceText: string): T {
    const reference = parseAuthorityReference(referenceText);
    return resolveReference(readDocument(this.documents, reference.path), reference) as T;
  }

  loadAuthority<T = unknown>(authorityId: string): LoadedAuthority<T> {
    const entry = this.#entries.get(authorityId);
    if (entry === undefined) {
      throw new AuthorityLoadError('UNKNOWN_AUTHORITY_ID', `Unknown active authority ID: ${authorityId}`);
    }
    const reference = parseAuthorityReference(entry.primaryAuthority);
    const value = resolveReference(readDocument(this.documents, reference.path), reference) as T;
    return Object.freeze({
      authorityId: entry.authorityId,
      domainId: entry.domainId,
      reference,
      value,
    });
  }

  loadValidatedReference<T>(referenceText: string, schemaReference: string): T {
    const value = this.loadReference<unknown>(referenceText);
    const result = this.schemaValidator.validate<T>(schemaReference, value);
    if (!result.valid) {
      const first = result.errors[0];
      throw new AuthorityLoadError(
        'INVALID_DOCUMENT',
        `Authority document failed ${schemaReference}: ${first?.instancePath ?? ''} ${first?.message ?? 'invalid'}`,
      );
    }
    return result.value;
  }
}
