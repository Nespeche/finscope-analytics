import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface TypeScriptConfigDocument {
  readonly extends?: string;
  readonly compilerOptions: Readonly<Record<string, unknown>>;
  readonly files?: readonly string[];
  readonly include?: readonly string[];
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function assertTypeScriptConfig(value: unknown): asserts value is TypeScriptConfigDocument {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('TypeScript configuration must be an object.');
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  if (typeof candidate.compilerOptions !== 'object' || candidate.compilerOptions === null) {
    throw new TypeError('TypeScript configuration must define compilerOptions.');
  }
}

async function collectProductionTypeScriptFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectProductionTypeScriptFiles(path));
    } else if (extname(entry.name) === '.ts') {
      files.push(path);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

describe('TypeScript strict configuration contract', () => {
  it('enables every required strictness boundary in the browser configuration', async () => {
    const value = await readJson('tsconfig.json');
    assertTypeScriptConfig(value);
    const options = value.compilerOptions;
    for (const flag of [
      'strict',
      'noImplicitAny',
      'useUnknownInCatchVariables',
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'noImplicitOverride',
      'noImplicitReturns',
      'noFallthroughCasesInSwitch',
      'forceConsistentCasingInFileNames',
      'isolatedModules',
    ]) {
      expect(options[flag], flag).toBe(true);
    }
  });

  it('extends strict browser settings for the Worker without DOM globals', async () => {
    const value = await readJson('workers/sec-gateway/tsconfig.json');
    assertTypeScriptConfig(value);
    expect(value.extends).toBe('../../tsconfig.json');
    expect(value.compilerOptions.lib).toEqual(['ES2022', 'WebWorker']);
    expect(value.compilerOptions.types).toEqual([]);
    expect(value.files).toBeUndefined();
    expect(value.include).toEqual(['src/**/*.ts']);
  });

  it('contains no explicit any annotation in current production TypeScript boundaries', async () => {
    const roots = ['src', 'workers/sec-gateway/src'];
    const files = (await Promise.all(roots.map(collectProductionTypeScriptFiles))).flat();
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:as\s+any|:\s*any\b|<any>)/u);
    }
  });
});
