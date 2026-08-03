import { describe, expect, it } from 'vitest';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';
import b20Document from '../../implementation-control/batches/B20.json';
import b21Document from '../../implementation-control/batches/B21.json';
import { resolveGitHubContext } from '../../implementation-control/scripts/Resolve-GitHubContext.mjs';

const input = () => ({
  branch: 'agent/b21-probe',
  handoff: structuredClone(handoffDocument),
  state: structuredClone(stateDocument),
  batches: { B20: structuredClone(b20Document), B21: structuredClone(b21Document) },
});

describe('GitHub transition context routing', () => {
  it('routes an ordinary branch to pending B21 and the B20 completed baseline', () => {
    const result = resolveGitHubContext(input());
    expect(result).toMatchObject({ mode: 'BATCH', batchId: 'B21', batchAuthoritySource: 'IMPLEMENTATION_STATE', batchStatus: 'PENDING', baselineRole: 'CURRENT_COMPLETED_BASELINE', baselineTag: 'v0.21.25-B20-completed', operationMatched: false });
    expect(result.commands).toHaveLength(7);
  });

  it('honors only the exact branch of a recognized complete special operation', () => {
    const value = input(); value.branch = value.handoff.operation.branch;
    expect(resolveGitHubContext(value)).toMatchObject({ mode: 'RELEASE_REMEDIATION', batchId: 'B20', batchAuthoritySource: 'MATCHED_OPERATION', baselineRole: 'HISTORICAL_OPERATION_BASELINE', operationMatched: true });
  });

  it('rejects a completed ordinary active batch', () => {
    const value = input(); value.state.batchStatus.B21 = 'COMPLETED'; value.batches.B21.status = 'COMPLETED'; value.state.completedBatchIds.push('B21');
    expect(() => resolveGitHubContext(value)).toThrowError(/COMPLETED_BATCH_SELECTED/u);
  });

  it('rejects divergent active and next-authorized batches', () => {
    const value = input(); value.state.nextAuthorizedBatchId = 'B22';
    expect(() => resolveGitHubContext(value)).toThrowError(/BATCH_AUTHORITY_MISMATCH/u);
  });

  it('rejects incompatible gates', () => {
    const value = input(); value.state.phaseGate.implementationAuthorized = false;
    expect(() => resolveGitHubContext(value)).toThrowError(/GATE_AUTHORITY_MISMATCH/u);
  });

  it('rejects convergence authorization', () => {
    const value = input(); value.state.phaseGate.convergenceAuthorized = true;
    expect(() => resolveGitHubContext(value)).toThrowError(/CONVERGENCE_UNEXPECTEDLY_AUTHORIZED/u);
  });

  it('rejects a historical baseline in ordinary routing', () => {
    const value = input(); value.handoff.completedBaseline = structuredClone(value.handoff.baseline);
    expect(() => resolveGitHubContext(value)).toThrowError(/BASELINE_ROLE_MISMATCH/u);
  });

  it('rejects a derived command set that no longer equals B21 authority', () => {
    const value = input(); value.batches.B21.localValidation.commands = [];
    expect(() => resolveGitHubContext(value)).toThrowError(/DERIVED_COMMAND_SET_MISMATCH/u);
  });

  it('runs only dedicated commands on the exact remediation branch', () => {
    const value = input(); value.branch = value.handoff.controlPlaneRemediation.branch;
    const result = resolveGitHubContext(value);
    expect(result.mode).toBe('CONTROL_PLANE_REMEDIATION');
    expect(result.commands.map((entry: { id: string }) => entry.id)).toEqual(['npm-ci', 'typecheck', 'control-plane', 'transition-contract', 'regression-vitest', 'build']);
    expect(result.commands.some((entry: { command: string }) => entry.command.includes('cloudflare/'))).toBe(false);
  });

  it.each([
    ['unknown', (value: ReturnType<typeof input>) => { value.handoff.operation.kind = 'UNKNOWN'; }],
    ['incomplete', (value: ReturnType<typeof input>) => { value.handoff.operation.branch = ''; }],
  ])('rejects an %s operation without silent fallback', (_label, mutate) => {
    const value = input(); mutate(value);
    expect(() => resolveGitHubContext(value)).toThrowError(/OPERATION_KIND_INVALID/u);
  });
});
