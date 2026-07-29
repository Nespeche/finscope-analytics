import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BatchTask {
  readonly id: string;
  readonly tests: readonly string[];
}

interface BatchDocument {
  readonly batchId: string;
  readonly tasks: readonly BatchTask[];
}

interface ImplementationState {
  readonly taskStatus: Readonly<Record<string, string>>;
}

type Runner =
  | 'vitest-unit'
  | 'vitest-integration'
  | 'vitest-contract'
  | 'vitest-negative'
  | 'vitest-performance'
  | 'playwright-e2e'
  | 'playwright-accessibility'
  | 'playwright-performance';

const implementedTaskStatuses = new Set([
  'COMPLETED',
  'IMPLEMENTED_PENDING_VALIDATION',
  'IN_PROGRESS',
]);

function runnerFor(path: string): Runner | null {
  if (path.endsWith('.test.ts')) {
    if (path.startsWith('tests/unit/')) return 'vitest-unit';
    if (path.startsWith('tests/integration/')) return 'vitest-integration';
    if (path.startsWith('tests/contract/')) return 'vitest-contract';
    if (path.startsWith('tests/negative/')) return 'vitest-negative';
    if (path.startsWith('tests/performance/')) return 'vitest-performance';
    throw new Error(`Runnable Vitest file has no project: ${path}`);
  }

  if (path.endsWith('.spec.ts')) {
    if (path.startsWith('tests/e2e/')) return 'playwright-e2e';
    if (path.startsWith('tests/accessibility/')) return 'playwright-accessibility';
    if (path.startsWith('tests/performance/')) return 'playwright-performance';
    throw new Error(`Runnable Playwright file has no project: ${path}`);
  }

  return null;
}

function registerRunnerOwnership(
  mappings: Map<string, Runner>,
  path: string,
  runner: Runner,
): void {
  const previous = mappings.get(path);
  if (previous !== undefined && previous !== runner) {
    throw new Error(`${path} resolves to incompatible runners: ${previous} and ${runner}`);
  }
  mappings.set(path, runner);
}

async function readBatchDocuments(): Promise<readonly BatchDocument[]> {
  const directory = 'implementation-control/batches';
  const names = (await readdir(directory)).filter((name) => /^B\d{2}\.json$/u.test(name)).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(directory, name), 'utf8')) as BatchDocument));
}

async function readImplementationState(): Promise<ImplementationState> {
  return JSON.parse(
    await readFile('implementation-control/IMPLEMENTATION_STATE.json', 'utf8'),
  ) as ImplementationState;
}

describe('test discovery contract', () => {
  it('enforces one runner per path while allowing shared task ownership', async () => {
    const [batches, implementationState] = await Promise.all([
      readBatchDocuments(),
      readImplementationState(),
    ]);
    const mappings = new Map<string, Runner>();
    const owners = new Map<string, string[]>();
    const existenceChecks: Promise<void>[] = [];

    for (const batch of batches) {
      for (const task of batch.tasks) {
        const taskStatus = implementationState.taskStatus[task.id];
        expect(taskStatus, `Missing implementation status for ${task.id}`).toBeDefined();

        for (const path of task.tests) {
          if (taskStatus !== undefined && implementedTaskStatuses.has(taskStatus)) {
            existenceChecks.push(access(path));
          }

          const runner = runnerFor(path);
          if (runner === null) continue;

          registerRunnerOwnership(mappings, path, runner);
          owners.set(path, [...(owners.get(path) ?? []), `${batch.batchId}/${task.id}`]);
        }
      }
    }

    await expect(Promise.all(existenceChecks)).resolves.toBeDefined();
    expect(mappings.size).toBeGreaterThan(0);
    expect(new Set(mappings.values())).toEqual(new Set<Runner>([
      'vitest-unit',
      'vitest-integration',
      'vitest-contract',
      'vitest-negative',
      'vitest-performance',
      'playwright-e2e',
      'playwright-accessibility',
      'playwright-performance',
    ]));

    expect(owners.get('tests/contract/cloudflare/wrangler-bindings.test.ts')).toEqual([
      'B02/T007',
      'B06/T028',
    ]);
    expect(owners.get('tests/e2e/consent.spec.ts')).toEqual([
      'B05/T021',
      'B17/T072',
    ]);
    expect(owners.get('tests/negative/sec/sec-negative.test.ts')).toEqual([
      'B06/T028',
      'B07/T035',
    ]);
  });

  it('accepts repeated ownership when every reference uses the same runner', () => {
    const mappings = new Map<string, Runner>();
    registerRunnerOwnership(mappings, 'tests/contract/shared.test.ts', 'vitest-contract');
    registerRunnerOwnership(mappings, 'tests/contract/shared.test.ts', 'vitest-contract');
    expect(mappings.get('tests/contract/shared.test.ts')).toBe('vitest-contract');
  });

  it('rejects shared ownership across incompatible runner categories', () => {
    const mappings = new Map<string, Runner>();
    registerRunnerOwnership(mappings, 'tests/shared.test.ts', 'vitest-contract');
    expect(() => registerRunnerOwnership(
      mappings,
      'tests/shared.test.ts',
      'vitest-negative',
    )).toThrow(/resolves to incompatible runners/u);
  });

  it('declares every runner category and aggregates only executable Playwright specs', async () => {
    const [vitestConfig, playwrightConfig, packageJson, appShellSpec, validationScript] = await Promise.all([
      readFile('vitest.config.ts', 'utf8'),
      readFile('playwright.config.ts', 'utf8'),
      readFile('package.json', 'utf8'),
      readFile('tests/e2e/app-shell.spec.ts', 'utf8'),
      readFile('implementation-control/scripts/Invoke-FinScopeBatchValidation.ps1', 'utf8'),
    ]);
    const packageDocument = JSON.parse(packageJson) as {
      readonly scripts: Readonly<Record<string, string>>;
    };

    for (const project of ['unit', 'integration', 'contract', 'negative', 'performance']) {
      expect(vitestConfig).toContain(`name: '${project}'`);
    }
    for (const pattern of ['e2e/**/*.spec.ts', 'accessibility/**/*.spec.ts', 'performance/**/*.spec.ts']) {
      expect(playwrightConfig).toContain(pattern);
    }
    expect(packageDocument.scripts).toEqual(expect.objectContaining({
      'validate:control-plane': 'node implementation-control/scripts/Validate-ControlPlaneState.mjs .',
      'test:e2e': 'playwright test tests/e2e',
      'test:accessibility': 'playwright test tests/accessibility',
      'test:performance:e2e': 'playwright test tests/performance',
      'test:browser': 'playwright test',
    }));
    expect(packageDocument.scripts['test:browser']).not.toMatch(/--pass-with-no-tests/u);
    expect(appShellSpec).not.toMatch(/\btest\.skip\b/u);
    expect(validationScript).toContain('function Get-TestLogPolicyViolation');
    expect(validationScript).toContain('NO_TESTS_DISCOVERED');
    expect(validationScript).toContain('SKIPPED_OR_PENDING_TESTS_REPORTED');
    expect(validationScript).toContain('FAIL_FAST_AFTER:');
    expect(validationScript).toContain("status = 'NOT_RUN'");
    expect(validationScript).toContain('Validate-ControlPlaneState.mjs');
    expect(validationScript).toContain('TASK_MIRROR_MISMATCH');
    expect(validationScript).toContain('sidecarLogicalZipName');
  });
});
