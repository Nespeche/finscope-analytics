import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';

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

  it('keeps remediation product and batch invariants anchored to the B20 source baseline', async () => {
    expect(stateDocument.batchStatus.B21).toBe('COMPLETED');
    expect(stateDocument.batchStatus.B22).toBe('PENDING');
    expect(stateDocument.activeBatchId).toBe('B22');
    expect(stateDocument.nextAuthorizedBatchId).toBe('B22');
    expect(stateDocument.phaseGate.convergenceAuthorized).toBe(false);
    await expect(execFileAsync('git', [
      'diff', '--quiet', 'b04cb4db010ab3a9575fa45c166e6e28f4246699', '--',
      'specs/001-fundamental-analysis-platform/tasks.md',
      'implementation-control/IMPLEMENTATION_STATE.json',
      'implementation-control/batches',
      '.specify',
      'src',
      'workers',
    ])).resolves.toMatchObject({ stdout: '', stderr: '' });
  });
});
