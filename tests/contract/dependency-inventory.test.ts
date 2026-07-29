import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface DependencyInventoryEntry {
  readonly name: string;
  readonly version: string;
  readonly scope: 'runtime' | 'development';
  readonly license: string;
  readonly paidRequirement: false;
}

interface PackageDocument {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly scripts: Readonly<Record<string, string>>;
  readonly finscope: {
    readonly dependencyPolicy: {
      readonly exactVersions: true;
      readonly paidDependencyAllowed: false;
      readonly inventory: readonly DependencyInventoryEntry[];
    };
  };
}

interface PackageLockDocument {
  readonly lockfileVersion: number;
  readonly packages: Readonly<Record<string, unknown>>;
}

const expectedDependencies = {
  ajv: '8.20.0',
  'decimal.js': '10.6.0',
  svelte: '5.56.7',
} as const;

const expectedDevDependencies = {
  '@axe-core/playwright': '4.12.1',
  '@playwright/test': '1.61.1',
  '@sveltejs/vite-plugin-svelte': '7.1.2',
  typescript: '7.0.2',
  vite: '8.1.5',
  vitest: '4.1.10',
  wrangler: '4.112.0',
} as const;

const expectedLicenses = new Map<string, string>([
  ['ajv', 'MIT'],
  ['decimal.js', 'MIT'],
  ['svelte', 'MIT'],
  ['@axe-core/playwright', 'MPL-2.0'],
  ['@playwright/test', 'Apache-2.0'],
  ['@sveltejs/vite-plugin-svelte', 'MIT'],
  ['typescript', 'Apache-2.0'],
  ['vite', 'MIT'],
  ['vitest', 'MIT'],
  ['wrangler', 'MIT OR Apache-2.0'],
]);

const requiredScripts = [
  'bootstrap',
  'dev',
  'build',
  'preview',
  'typecheck',
  'test',
  'test:contract',
  'test:unit',
  'test:integration',
  'test:negative',
  'test:e2e',
  'test:accessibility',
  'test:performance:unit',
  'test:performance:e2e',
  'test:performance',
  'test:browser',
  'wrangler:dev',
  'wrangler:deploy:dry-run',
] as const;

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assertPackageDocument(value: unknown): asserts value is PackageDocument {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('package.json must be an object.');
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  if (
    typeof candidate.dependencies !== 'object' || candidate.dependencies === null ||
    typeof candidate.devDependencies !== 'object' || candidate.devDependencies === null ||
    typeof candidate.scripts !== 'object' || candidate.scripts === null ||
    typeof candidate.finscope !== 'object' || candidate.finscope === null
  ) {
    throw new TypeError('package.json is missing required dependency policy fields.');
  }
}

function assertPackageLockDocument(value: unknown): asserts value is PackageLockDocument {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('package-lock.json must be an object.');
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  if (candidate.lockfileVersion !== 3 || typeof candidate.packages !== 'object' || candidate.packages === null) {
    throw new TypeError('package-lock.json must use lockfileVersion 3 and contain packages.');
  }
}

function assertExactVersions(dependencies: Readonly<Record<string, string>>): void {
  for (const [name, version] of Object.entries(dependencies)) {
    expect(version, `${name} must be an exact semantic version`).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);
  }
}

describe('dependency inventory contract', () => {
  it('pins only the authorized minimal direct dependencies', async () => {
    const packageValue = await readJson('package.json');
    assertPackageDocument(packageValue);

    expect(packageValue.dependencies).toEqual(expectedDependencies);
    expect(packageValue.devDependencies).toEqual(expectedDevDependencies);
    assertExactVersions(packageValue.dependencies);
    assertExactVersions(packageValue.devDependencies);
  });

  it('records scope, exact version, license and free-only status for every direct dependency', async () => {
    const packageValue = await readJson('package.json');
    assertPackageDocument(packageValue);

    const policy = packageValue.finscope.dependencyPolicy;
    expect(policy.exactVersions).toBe(true);
    expect(policy.paidDependencyAllowed).toBe(false);
    expect(policy.inventory).toHaveLength(expectedLicenses.size);

    const declared = { ...packageValue.dependencies, ...packageValue.devDependencies };
    for (const entry of policy.inventory) {
      expect(entry.version).toBe(declared[entry.name]);
      expect(entry.license).toBe(expectedLicenses.get(entry.name));
      expect(entry.paidRequirement).toBe(false);
      expect(entry.scope).toBe(entry.name in packageValue.dependencies ? 'runtime' : 'development');
    }
  });

  it('keeps package.json and the committed lockfile root inventory aligned', async () => {
    const packageValue = await readJson('package.json');
    const lockValue = await readJson('package-lock.json');
    assertPackageDocument(packageValue);
    assertPackageLockDocument(lockValue);

    const rootPackage = lockValue.packages[''];
    expect(rootPackage).toBeTypeOf('object');
    expect(rootPackage).not.toBeNull();
    const rootRecord = rootPackage as Readonly<Record<string, unknown>>;
    expect(rootRecord.dependencies).toEqual(packageValue.dependencies);
    expect(rootRecord.devDependencies).toEqual(packageValue.devDependencies);

    for (const name of Object.keys({ ...packageValue.dependencies, ...packageValue.devDependencies })) {
      expect(lockValue.packages).toHaveProperty(`node_modules/${name}`);
    }
  });

  it('exposes the deterministic command surface without paid service bootstrap', async () => {
    const packageValue = await readJson('package.json');
    assertPackageDocument(packageValue);
    for (const script of requiredScripts) {
      expect(packageValue.scripts).toHaveProperty(script);
    }
    expect(JSON.stringify(packageValue).toLowerCase()).not.toMatch(/stripe|datadog|newrelic|sentry|premium|trial|credit card/u);
  });
});
