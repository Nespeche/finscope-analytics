import { describe, expect, it } from 'vitest';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';
import b20Document from '../../implementation-control/batches/B20.json';
import b21Document from '../../implementation-control/batches/B21.json';
import { resolveGitHubContext, validateRemediationScope } from '../../implementation-control/scripts/Resolve-GitHubContext.mjs';

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
    const expectedMode = value.handoff.operation.kind === 'RELEASE_REMEDIATION'
      ? 'RELEASE_REMEDIATION'
      : value.handoff.operation.stage === 'closure'
        ? 'BATCH_CLOSURE'
        : 'GH0_BOOTSTRAP';
    expect(resolveGitHubContext(value)).toMatchObject({
      mode: expectedMode,
      batchId: value.handoff.operation.activeBatchId,
      batchAuthoritySource: 'MATCHED_OPERATION',
      baselineRole: value.handoff.operation.baselineRole,
      operationMatched: true,
    });
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
    const value = input();
    value.handoff.completedBaseline = {
      ...structuredClone(value.handoff.completedBaseline),
      role: 'HISTORICAL_OPERATION_BASELINE',
    };
    expect(() => resolveGitHubContext(value)).toThrowError(/BASELINE_ROLE_MISMATCH/u);
  });

  it('rejects a derived command set that no longer equals B21 authority', () => {
    const value = input(); value.batches.B21.localValidation.commands = [];
    expect(() => resolveGitHubContext(value)).toThrowError(/DERIVED_COMMAND_SET_MISMATCH/u);
  });

  it('runs only dedicated commands on the exact control-plane remediation branch', () => {
    const value = input(); value.branch = 'agent/maintenance-remediation-routing';
    const result = resolveGitHubContext(value);
    expect(result.mode).toBe('CONTROL_PLANE_REMEDIATION');
    expect(result.remediationId).toBe('maintenance-routing-hardening');
    expect(result.commands.map((entry: { id: string }) => entry.id)).toEqual(['npm-ci', 'typecheck', 'control-plane', 'transition-contract', 'regression-vitest', 'build']);
    expect(result.commands.some((entry: { command: string }) => entry.command.includes('cloudflare/'))).toBe(false);
  });

  it('routes the exact maintenance branch without inheriting B21 commands', () => {
    const value = input(); value.branch = 'agent/residual-risk-hardening';
    const result = resolveGitHubContext(value);
    expect(result).toMatchObject({
      mode: 'MAINTENANCE_REMEDIATION',
      batchId: 'B21',
      batchAuthoritySource: 'IMPLEMENTATION_STATE',
      baselineRole: 'CURRENT_COMPLETED_BASELINE',
      remediationMatched: true,
      remediationId: 'residual-risk-hardening',
    });
    expect(result.commands.map((entry: { id: string }) => entry.id)).toEqual([
      'npm-ci', 'typecheck', 'control-plane', 'maintenance-contract', 'dependency-audit', 'regression-vitest', 'build',
    ]);
    expect(result.commands.some((entry: { command: string }) => entry.command.includes('d1-budget'))).toBe(false);
  });

  it('accepts only changed paths declared by the matched remediation', () => {
    const value = input(); value.branch = 'agent/residual-risk-hardening';
    const result = resolveGitHubContext(value);
    expect(validateRemediationScope(['package.json', 'vite.config.ts'], result.allowedPaths)).toMatchObject({ valid: true });
    expect(() => validateRemediationScope(['workers/sec-gateway/src/index.ts'], result.allowedPaths)).toThrowError(/MAINTENANCE_SCOPE_MISMATCH/u);
  });

  it('rejects ambiguous or incomplete remediation declarations', () => {
    const duplicate = input(); duplicate.handoff.remediations.push(structuredClone(duplicate.handoff.remediations[0]));
    duplicate.branch = 'agent/maintenance-remediation-routing';
    expect(() => resolveGitHubContext(duplicate)).toThrowError(/OPERATION_BRANCH_MISMATCH/u);

    const incomplete = input(); incomplete.handoff.remediations[0].allowedPaths = [];
    expect(() => resolveGitHubContext(incomplete)).toThrowError(/OPERATION_KIND_INVALID/u);
  });

  it.each([
    ['unknown', (value: ReturnType<typeof input>) => { value.handoff.operation.kind = 'UNKNOWN'; }],
    ['incomplete', (value: ReturnType<typeof input>) => { value.handoff.operation.branch = ''; }],
  ])('rejects an %s operation without silent fallback', (_label, mutate) => {
    const value = input(); mutate(value);
    expect(() => resolveGitHubContext(value)).toThrowError(/OPERATION_KIND_INVALID/u);
  });
});
