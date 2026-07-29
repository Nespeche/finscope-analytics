import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import accountingProfileCatalog from '../../specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json';
import fingerprintProjections from '../../specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json';
import formulaTestVectors from '../../specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json';
import metricCatalog from '../../specs/001-fundamental-analysis-platform/definitions/metric-catalog.json';
import {
  ACTIVE_AUTHORITY_CROSSWALK,
  AuthorityLoadError,
  AuthorityLoader,
  parseAuthorityCrosswalk,
  parseAuthorityReference,
  parsePackageRootPath,
} from '../../src/authority/loaders';

const schemaId = (fileName: string): string => `https://finscope.local/schemas/${fileName}`;

async function createDocuments(): Promise<ReadonlyMap<string, unknown>> {
  return new Map<string, unknown>([
    [
      'specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json',
      accountingProfileCatalog,
    ],
    [
      'specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json',
      fingerprintProjections,
    ],
    [
      'specs/001-fundamental-analysis-platform/definitions/metric-catalog.json',
      metricCatalog,
    ],
    [
      'specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json',
      formulaTestVectors,
    ],
    [
      'specs/001-fundamental-analysis-platform/data-model.md',
      await readFile('specs/001-fundamental-analysis-platform/data-model.md', 'utf8'),
    ],
    [
      'V0.21_PHASE_STATUS.md',
      await readFile('V0.21_PHASE_STATUS.md', 'utf8'),
    ],
  ]);
}

describe('exact active authority loading', () => {
  it('type-checks the active crosswalk and exposes all 36 unique authority IDs', () => {
    expect(ACTIVE_AUTHORITY_CROSSWALK.domains).toHaveLength(36);
    const ids = ACTIVE_AUTHORITY_CROSSWALK.domains.map((entry) => entry.authorityId);
    expect(new Set(ids).size).toBe(36);
    expect(ids).toContain('AUTH-003');
    expect(ids).toContain('AUTH-034');
  });

  it('loads JSON pointers and explicit Markdown anchors from exact package-root paths', async () => {
    const loader = new AuthorityLoader(await createDocuments());
    const profiles = loader.loadAuthority<unknown[]>('AUTH-004');
    expect(profiles.reference.source).toBe(
      'specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json#/profiles',
    );
    expect(profiles.value).toHaveLength(accountingProfileCatalog.profiles.length);

    const projections = loader.loadAuthority<unknown[]>('AUTH-014');
    expect(projections.value).toHaveLength(fingerprintProjections.projections.length);

    const issuer = loader.loadAuthority<string>('AUTH-003');
    expect(issuer.value).toBe('#issueridentity');
    expect(loader.loadReference('V0.21_PHASE_STATUS.md#gate')).toBe('#gate');
  });

  it('validates catalogs and fixture pointers through the authorized Ajv runtime', async () => {
    const loader = new AuthorityLoader(await createDocuments());
    const catalog = loader.loadValidatedReference<typeof metricCatalog>(
      'specs/001-fundamental-analysis-platform/definitions/metric-catalog.json',
      schemaId('metric-catalog.schema.json'),
    );
    expect(catalog.metrics).toHaveLength(32);

    const vector = loader.loadValidatedReference<(typeof formulaTestVectors.vectors)[number]>(
      'specs/001-fundamental-analysis-platform/fixtures/formulas/formula-test-vectors.json#/vectors/0',
      `${schemaId('formula-vectors.schema.json')}#/$defs/vector`,
    );
    expect(vector.vectorId).toBe('identity-normal');
  });

  it('fails closed for unknown IDs, missing pointers and missing documents', async () => {
    const loader = new AuthorityLoader(await createDocuments());
    expect(() => loader.loadAuthority('AUTH-999')).toThrowError(AuthorityLoadError);
    expect(() => loader.loadAuthority('AUTH-999')).toThrow(/Unknown active authority/u);
    expect(() => loader.loadReference(
      'specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json#/missing',
    )).toThrow(/does not exist/u);
    expect(() => loader.loadReference('specs/missing.json')).toThrow(/document is missing/u);
  });

  it('forbids path guessing, traversal, absolute paths, case folding and anchor inference', async () => {
    const documents = new Map<string, unknown>([
      ['FinScope_v0.21.3/specs/exact.json', { value: true }],
      ['Specs/Case.json', { value: true }],
      ['docs/no-explicit-anchor.md', '# Inferred Heading'],
    ]);
    const loader = new AuthorityLoader(documents);
    expect(() => loader.loadReference('specs/exact.json')).toThrow(/heuristic match/u);
    expect(() => loader.loadReference('specs/case.json')).toThrow(/heuristic match/u);
    expect(() => loader.loadReference('docs/no-explicit-anchor.md#inferred-heading'))
      .toThrow(/Explicit anchor does not exist/u);
    expect(() => parsePackageRootPath('../escape.json')).toThrow(/Invalid package-root path/u);
    expect(() => parsePackageRootPath('C:\\absolute.json')).toThrow(/Invalid package-root path/u);
    expect(() => parseAuthorityReference('https://example.test/a.json')).toThrow(/Invalid package-root path/u);
  });

  it('rejects malformed or duplicate crosswalk entries instead of repairing them by inference', () => {
    const duplicate = structuredClone({
      ...ACTIVE_AUTHORITY_CROSSWALK,
      domainCount: 2,
      domains: [
        ACTIVE_AUTHORITY_CROSSWALK.domains[0],
        ACTIVE_AUTHORITY_CROSSWALK.domains[0],
      ],
    });
    expect(() => parseAuthorityCrosswalk(duplicate)).toThrow(/must be unique/u);
  });
});
