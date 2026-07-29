const packageRootPathBrand: unique symbol = Symbol('PackageRootPath');
const authorityIdBrand: unique symbol = Symbol('AuthorityId');

export type PackageRootPath = string & {
  readonly [packageRootPathBrand]: true;
};

export type AuthorityId = `AUTH-${string}` & {
  readonly [authorityIdBrand]: true;
};

export interface AuthorityCrosswalkEntry {
  readonly authorityId: AuthorityId;
  readonly domainId: string;
  readonly primaryAuthority: string;
  readonly consumers: readonly PackageRootPath[];
  readonly status: 'ACTIVE';
}

export interface AuthorityCrosswalk {
  readonly crosswalkId: string;
  readonly version: string;
  readonly status: 'ACTIVE_AUTHORITY';
  readonly domains: readonly AuthorityCrosswalkEntry[];
}

export interface AuthorityReference {
  readonly source: string;
  readonly path: PackageRootPath;
  readonly fragment: '' | `#${string}`;
}

export interface LoadedAuthority<T = unknown> {
  readonly authorityId: AuthorityId;
  readonly domainId: string;
  readonly reference: AuthorityReference;
  readonly value: T;
}

export type AuthorityDocumentCollection =
  | ReadonlyMap<string, unknown>
  | Readonly<Record<string, unknown>>;
