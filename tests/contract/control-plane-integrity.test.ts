import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

type ControlPlaneCheck = {
  readonly id: string;
  readonly status: 'PASS' | 'FAIL';
  readonly detail: string;
};

type ControlPlaneResult = {
  readonly status: 'PASS' | 'FAIL';
  readonly checkCount: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly taskCount: number;
  readonly batchCount: number;
  readonly checks: readonly ControlPlaneCheck[];
  readonly issues: readonly unknown[];
};

describe('control-plane integrity', () => {
  it('keeps task locks, batch mirrors, status and gates synchronized', async () => {
    const projectRoot = process.env.FINSCOPE_PACKAGE_ROOT ?? '.';
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['implementation-control/scripts/Validate-ControlPlaneState.mjs', projectRoot],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );

    const result = JSON.parse(stdout) as ControlPlaneResult;
    const checkIds = result.checks.map(({ id }) => id);

    expect(stderr).toContain('CONTROL_PLANE_STATE_VALID');
    expect(result.status).toBe('PASS');
    expect(result.failCount).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.taskCount).toBe(109);
    expect(result.batchCount).toBe(25);

    // The number of checks legitimately varies with the active batch because
    // each external dependency adds one ACTIVE_DEPENDENCY_* verification.
    expect(result.checkCount).toBeGreaterThan(0);
    expect(result.checkCount).toBe(result.checks.length);
    expect(result.passCount).toBe(result.checkCount);
    expect(new Set(checkIds).size).toBe(result.checkCount);
    expect(result.checks.every(({ status }) => status === 'PASS')).toBe(true);
  });
});
