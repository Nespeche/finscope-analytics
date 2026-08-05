import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';
import b20Document from '../../implementation-control/batches/B20.json';
import b21Document from '../../implementation-control/batches/B21.json';
import b22Document from '../../implementation-control/batches/B22.json';
import {
  buildReleasePublicationAuthorization,
  resolveGitHubClosureContext,
  resolveGitHubContext,
  resolveGitHubReleasePublicationContext,
  resolveGitHubReleasePublicationDispatchContext,
  validateRemediationScope,
} from '../../implementation-control/scripts/Resolve-GitHubContext.mjs';

const input = () => ({
  branch: 'agent/b21-probe',
  handoff: structuredClone(handoffDocument),
  state: structuredClone(stateDocument),
  batches: { B20: structuredClone(b20Document), B21: structuredClone(b21Document), B22: structuredClone(b22Document) },
});

const releaseInput = () => structuredClone(handoffDocument) as any;
const mainSha = '1140f9b1d70d579dd57f449628f1d8fd308d075e';
const releaseWorkflow = readFileSync('.github/workflows/finscope-completed-release.yml', 'utf8');
const publicationDispatchInput = () => {
  const handoff = releaseInput();
  handoff.operation.stage = 'completed';
  handoff.release.pending = true;
  const authorizationText = buildReleasePublicationAuthorization({
    mainSha,
    tag: handoff.release.tag,
    zipName: handoff.release.zipName,
    sidecarName: handoff.release.sidecarName,
  });
  return {
    handoff,
    eventName: 'workflow_dispatch',
    refName: 'main',
    githubSha: mainSha,
    checkedOutSha: mainSha,
    expectedMainSha: mainSha,
    authorizationText,
    tagExists: false,
  };
};

const publicationRemediationPaths = [
  '.github/workflows/finscope-completed-release.yml',
  'implementation-control/GITHUB_HANDOFF.json',
  'implementation-control/GITHUB_RELEASE_PROTOCOL.md',
  'implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md',
  'implementation-control/GITHUB_VALIDATION_PROTOCOL.md',
  'implementation-control/scripts/Resolve-GitHubContext.mjs',
  'tests/contract/github-transition-routing.test.ts',
];

describe('GitHub transition context routing', () => {
  it('routes an ordinary branch to pending B22 only after the completed Release hold is cleared', () => {
    const value = input(); value.handoff.release.pending = false;
    const result = resolveGitHubContext(value);
    expect(result).toMatchObject({ mode: 'BATCH', batchId: 'B22', batchAuthoritySource: 'IMPLEMENTATION_STATE', batchStatus: 'PENDING', baselineRole: 'CURRENT_COMPLETED_BASELINE', baselineTag: 'v0.21.25-B20-completed', operationMatched: false });
    expect(result.commands).toHaveLength(b22Document.localValidation.commands.length);
  });

  it('blocks ordinary B22 routing while completed Release promotion is pending', () => {
    const value = input();
    expect(value.handoff.release.pending).toBe(true);
    expect(() => resolveGitHubContext(value)).toThrowError(/COMPLETED_RELEASE_PENDING/u);
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
    const value = input(); value.handoff.release.pending = false; value.state.batchStatus.B22 = 'COMPLETED'; value.batches.B22.status = 'COMPLETED'; value.state.completedBatchIds.push('B22');
    expect(() => resolveGitHubContext(value)).toThrowError(/COMPLETED_BATCH_SELECTED/u);
  });

  it('rejects divergent active and next-authorized batches', () => {
    const value = input(); value.handoff.release.pending = false; value.state.nextAuthorizedBatchId = 'B23';
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
    const value = input(); value.handoff.release.pending = false;
    value.handoff.completedBaseline = {
      ...structuredClone(value.handoff.completedBaseline),
      role: 'HISTORICAL_OPERATION_BASELINE',
    };
    expect(() => resolve@ÏtHubContext(value)).toThrowError(/BASELINE_ROLE_MISMATCH/u);
  });

  it('rejects a derived command set that no longer equals B21 authority', () => {
    const value = input(); value.handoff.release.pending = false; value.batches.B22.localValidation.commands = [];
    expect(() => resolve@ÏtHubContext(value)).toThrowError(/DERIVED_COMMAND_SET_MISMATCH/u);
  });

  it('runs only dedicated commands on the exact control-plane remediation branch', () => {
    const value = input(); value.branch = 'agent/maintenance-remediation-routing';
    const result = resolve@ÏtHubContext(value);
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
      batchId: 'B22',
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
    const result = resolve@ÏtHubContext(value);
    expect(validateRemediationScope(['package.json', 'vite.config.ts'], result.allowedPaths)).toMatchObject({ valid: true });
    expect(() => validateRemediationScope(['workers/sec-gateway/src/index.ts'], result.allowedPaths)).toThrowError(/MAINTENANCE_SCOPE_MISMATCH/u);
  });

  it('routes the B21 clean-package remediation to its closed scope and dedicated commands', () => {
    const value = input(); value.branch = 'agent/b21-clean-completed-package-remediation';
    const result = resolve@ÏtHubContext(value);
    expect(result).toMatchObject({
      mode: 'MAINTENANCE_REMEDIATION',
      remediationMatched: true,
      remediationId: 'b21-clean-completed-package-remediation',
      baselineRole: 'CURRENT_COMPLETED_BASELINE',
    });
    expect(result.commands.map((entry: { id: string }) => entry.id)).toContain('reject-historical-b21');
    expect(validateRemediationScope([
      '.github/workflows/finscope-completed-release.yml',
      'implementation-control/scripts/Verify-GitHubCompletedPackage.mjs',
    ], result.allowedPaths)).toMatchObject({ valid: true });
    expect(() => validateRemediationScope(['src/app/composition.ts'], result.allowedPaths)).toThrowError(/MAINTENANCE_SCOPE_MISMATCH/u);
  });

  it('routes the final B21 Release promotion remediation despite the ordinary release hold', () => {
    const value = input(); value.branch = 'agent/b21-final-release-promotion-remediation';
    const result = resolve@ÏtHubContext(value);
    expect(result).toMatchObject({
      mode: 'MAINTENANCE_REMEDIATION',
      remediationMatched: true,
      remediationId: 'b21-final-release-promotion-remediation',
      batchId: 'B22',
      baselineTag: 'v0.21.25-B20-completed',
    });
    expect(result.commands.map((entry: { id: string }) => entry.id)).toContain('closure-contract');
    expect(result.commands.map((entry: { id: string }) => entry.id)).toContain('verify-clean-package');
    expect(validateRemediationScope([
      'implementation-control/GITHUB_HANDOFF.json',
      'implementation-control/scripts/Apply-GitHubRemediationClosure.mjs',
      'implementation-control/scripts/Package-GitHubCompletedRelease.mjs',
      'tests/contract/github-remediation-closure.test.ts',
      'tests/contract/github-transition-routing.test.ts',
    ], result.allowedPaths)).toMatchObject({ valid: true });
  });

  it('routes only the exact formal publication-gate remediation in candidate state', () => {
    const value = input(); value.branch = 'agent/release-publication-gate-hardening';
    const result = resolve@ÏtHubContext(value);
    expect(result).toMatchObject({
      mode: 'CONTROL_PLANE_REMEDIATION',
      remediationMatched: true,
      remediationId: 'release-publication-gate-hardening',
      remediationStage: 'candidate',
      remediationStatus: 'NOT_REQUESTED',
      baselineRole: 'CURRENT_COMPLETED_BASELINE',
    });
    expect(result.allowedPaths).toEqual(publicationRemediationPaths);
    expect(result.commands.map((entry: { id: string }) => entry.id)).toEqual([
      'npm-ci', 'typecheck', 'control-plane', 'publication-gate-contract', 'regression-vitest', 'build',
    ]);
    expect(validateRemediationScope(publicationRemediationPaths, result.allowedPaths)).toMatchObject({ valid: true });
    expect(() => validateRemediationScope(['implementation-control/IMPLEMENTATION_STATE.json'], result.allowedPaths)).toThrowError(/MAINTENANCE_SCOPE_MISMATCH/u);
    expect(resolve@ÏtHubClosureContext({ branch: value.branch, handoff: value.handoff })).toMatchObject({
      closureType: 'NOT_APPLICABLE',
      remediationId: 'release-publication-gate-hardening',
      policyStage: 'candidate',
      policyStatus: 'NOT_REQUESTED',
      candidate: null,
    });
  });

  it('rejects incomplete or evidence-reusing formal remediation state', () => {
    const incomplete = input();
    const remediation = incomplete.handoff.remediations.find((entry: any) => entry.id === 'release-publication-gate-hardening');
    delete remediation.status;
    expect(() => resolvee@ÏtHubContext(incomplete)).toThrowError(/REMEDIATION_STATE_INVALID/u);

    const reused = input();
    const reusedRemediation = reused.handoff.remediations.find((entry: any) => entry.id === 'release-publication-gate-hardening');
    reusedRemediation.candidate = { sha: mainSha };
    expect(() => resolveGitHubContext(reused)).toThrowError(/REMEDIATION_STATE_INVALID/u);
  });

  it('rejects ambiguous or incomplete remediation declarations', () => {
    const duplicate = input(); duplicate.handoff.remediations.push(structuredClone(duplicate.handoff.remediations[0]));
    duplicate.branch = 'agent/maintenance-remediation-routing';
    expect(() => resolvegitHubContext(duplicate)).toThrowError(/OPERATION_BRANCH_MISMATCH/u);

    const incomplete = input(); incomplete.handoff.remediations[0].allowedPaths = [];
    expect(() => resolve@ÏtHubContext(incomplete)).toThrowError(/OPERATION_KIND_INVALID/u);
  });

  it.each([
    ['unknown', (value: ReturnType<typeof input>) => { value.handoff.operation.kind = 'UNKNOWN'; }],
    ['incomplete', (value: ReturnType<typeof input>) => { value.handoff.operation.branch = ''; }],
  ])('rejects an %s operation without silent fallback', (_label, mutate) => {
    const value = input(); mutate(value);
    expect(() => resolvegitHubContext(value)).toThrowError(/OPERATION_KIND_INVALID/u);
  });
});

describe('completed Release publication authority', () => {
  it.each(['candidate', 'closure'])('does not publish a %s RELEASE_REMEDIATION even when pending and tagged', (stage) => {
    const handoff = releaseInput();
    handoff.operation.stage = stage;
    handoff.release.pending = true;
    expect(resolvegitHubReleasePublicationContext({ handoff })).toMatchObject({
      enabled: false,
      reason: 'OPERATION_STAGE_NOT_COMPLETED',
      operationKind: 'RELEASE_REMEDIATION',
      operationStage: stage,
      releasePending: true,
      tag: 'v0.21.27-B21-completed-r2',
    });
  });

  it('does not publish a completed operation when release.pending is false', () => {
    const handoff = releaseInput();
    handoff.operation.stage = 'completed';
    handoff.release.pending = false;
    expect(resolveGitHubReleasePublicationContext({ handoff })).toMatchObject({ enabled: false, reason: 'RELEASE_NOT_PENDING' });
  });

  it('enables only a completed pending operation with complete immutable identity', () => {
    const handoff = releaseInput();
    handoff.operation.stage = 'completed';
    handoff.release.pending = true;
    handoff.release.tag = 'v0.21.27-B21-completed-r2';
    handoff.release.packageRevision = 'v0.21.27_B21_completed_r2';
    handoff.release.zipName = 'FS_v0.21.27_B21_completed_r2.zip';
    handoff.release.sidecarName = 'FS_v0.21.27_B21_completed_r2.zip.sha256';
    expect(resolveGitHubReleasePublicationContext({ handoff })).toMatchObject({
      enabled: true,
      reason: 'COMPLETE_RELEASE_AUTHORITY',
      operationBranch: 'agent/b21-final-completed-release',
      tag: 'v0.21.27-B21-completed-r2',
      zipName: 'FS_v0.21.27_B21_completed_r2.zip',
    });
  });

  it('fails closed for an incomplete candidate after completed publication intent', () => {
    const handoff = releaseInput();
    handoff.operation.stage = 'completed';
    handoff.release.pending = true;
    delete handoff.candidate.artifactId;
    expect(() => resolvegitHubReleasePublicationContext({ handoff })).toThrowError(/RELEASE_PUBLICATION_AUTHORITY_INCOMPLETE:candidate\.artifactId/u);
  });

  it('fails closed for an incomplete closure after completed publication intent', () => {
    const handoff = releaseInput();
    handoff.operation.stage = 'completed';
    handoff.release.pending = true;
    delete handoff.closure.commitSha;
    expect(() => resolveGitHubReleasePublicationContext({ handoff })).toThrowError(/RELEASE_PUBLICATION_AUTHORITY_INCOMPLETE:closure\.commitSha/u);
  });

  it('never enables MAINTENANCE_REMEDIATION', () => {
    const handoff = releaseInput();
    handoff.operation.kind = 'MAINTENANCE_REMEDIATION';
    handoff.operation.stage = 'completed';
    handoff.release.pending = true;
    expect(resolvgitHubReleasePublicationContext({ handoff })).toMatchObject({
      enabled: false,
      reason: 'OPERATION_KIND_NOT_RELEASE_REMEDIATION',
    });
  });

  it('preserves immutable release identity while intrinsic completed authority is present', () => {
    const handoff = releaseInput();
    const releaseBefore = structuredClone(handoff.release);
    const result = resolveGitHubReleasePublicationContext({ handoff });
    expect(result).toMatchObject({ enabled: true, reason: 'COMPLETED_RELEASE_AUTHORITY', releasePending: true, tag: 'v0.21.27-B21-completed-r2' });
    expect(handoff.release).toEqual(releaseBefore);
    expect(handoff.release).toMatchObject({
      pending: true,
      tag: 'v0.21.27-B21-completed-r2',
      zipName: 'FS_v0.21.27_B21_completed_r2.zip',
      sidecarName: 'FS_v0.21.27_B21_completed_r2.zip.sha256',
    });
  });
});

describe('independent completed Release publication dispatch', () => {
  it('declares workflow_dispatch as the only trigger and requires both exact inputs', () => {
    const triggerBlock = releaseWorkflow.slice(releaseWorkflow.indexOf('\non:\n') + 1, releaseWorkflow.indexOf('\npermissions:'));
    expect(triggerBlock).toContain('workflow_dispatch:');
    expect(triggerBlock).toContain('expected_main_sha:');
    expect(triggerBlock).toContain('authorization_text:');
    for (const event of ['push', 'pull_request', 'schedule', 'workflow_run']) {
      expect(triggerBlock).not.toMatch(new RegExp(`^\\s+${event}:`, 'mu'));
    }
  });

  it('rejects empty and generic authorization text', () => {
    const empty = publicationDispatchInput(); empty.authorizationText = '';
    expect(() => resolveGitHubReleasePublicationDispatchContext(empty)).toThrowError(/RELEASE_PUBLICATION_AUTHORIZATION_MISMATCH/u);
    const generic = publicationDispatchInput(); generic.authorizationText = 'AUTHORIZE RELEASE';
    expect(() => resolvgitHubReleasePublicationDispatchContext(generic)).toThrowError(/RELEASE_PUBLICATION_AUTHORIZATION_MISMATCH/u);
  });

  it('rejects an incorrect expected main SHA or checkout identity', () => {
    const wrongExpected = publicationDispatchInput(); wrongExpected.expectedMainSha = '0'.repeat(40);
    expect(() => resolveGitHubReleasePublicationDispatchContext(wrongExpected)).toThrowError(/RELEASE_PUBLICATION_EXPECTED_SHA_MISMATCH/u);
    const wrongCheckout = publicationDispatchInput(); wrongCheckout.checkedOutSha = '0'.repeat(40);
    expect(() => resolveGitHubReleasePublicationDispatchContext(wrongCheckout)).toThrowError(/RELEASE_PUBLICATION_CHECKOUT_MISMATCH/u);
  });

  it.each([
    ['tag', '|tag=v0.21.27-B21-completed-r2|', '|tag=v0.21.27-B21-completed-wrong|'],
    ['ZIP', '|zip=FS_v0.21.27_B21_completed_r2.zip|', '|zip=wrong.zip|'],
    ['sidecar', '|sidecar=FS_v0.21.27_B21_completed_r2.zip.sha256', '|sidecar=wrong.zip.sha256'],
  ])(rejects an incorrect %s in the canonical authorization', (_field, expected, replacement) => {
    const value = publicationDispatchInput();
    value.authorizationText = value.authorizationText.replace(expected, replacement);
    expect(() => resolvgitHubReleasePublicationDispatchContext(value)).toThrowError(/RELEASE_PUBLICATION_AUTHORIZATION_MISMATCH/u);
  });

  it('rejects any additional whitespace or a branch other than main', () => {
    const spaced = publicationDispatchInput(); spaced.authorizationText = `${spaced.authorizationText} `;
    expect(() => resolvegitHubReleasePublicationDispatchContext(spaced)).toThrowError(/RELEASE_PUBLICATION_AUTHORIZATION_MISMATCH/u);
    const branch = publicationDispatchInput(); branch.refName = 'agent/release-publication-gate-hardening';
    expect(() => resolveGitHubReleasePublicationDispatchContext(branch)).toThrowError(/RELEASE_PUBLICATION_BRANCH_INVALID/u);
  });

  it('accepts only the exact canonical authorization for the exact workflow dispatch identity', () => {
    const value = publicationDispatchInput();
    const result = resolveGitHubReleasePublicationDispatchContext(value);
    expect(result).toMatchObject({
      enabled: true,
      reason: 'CANONICAL_WORKFLOW_DISPATCH_AUTHORIZED',
      eventName: 'workflow_dispatch',
      refName: 'main',
      githubSha: mainSha,
      expectedMainSha: mainSha,
      tagExists: false,
    });
    expect(result.canonicalAuthorization).toBe(
      `AUTHORIZE_FIN_SCOPE_RELEASE_PUBLICATION|main=${mainSha}|tag=v0.21.27-B21-completed-r2|zip=FS_v0.21.27_B21_completed_r2.zip|sidecar=FS_v0.21.27_B21_completed_r2.zip.sha256`,
    );
  });

  it('does not let release.pending=true enable publication without dispatch authorization', () => {
    const value = publicationDispatchInput(); value.eventName = 'push';
    expect(value.handoff.release.pending).toBe(true);
    expect(() => resolvgitHubReleasePublicationDispatchContext(value)).toThrowError(/RELEASE_PUBLICATION_EVENT_INVALID/u);
  });

  it('serializes the exact SHA and canonical identity and rejects a second publication', () => {
    expect(releaseWorkflow).toContain('group: ${{ inputs.authorization_text }}');
    expect(releaseWorkflow).toContain('cancel-in-progress: false');
    const duplicate = publicationDispatchInput(); duplicate.tagExists = true;
    expect(() => resolvegitHubReleasePublicationDispatchContext(duplicate)).toThrowError(/RELEASE_PUBLICATION_TAG_ALREADY_EXISTS/u);
  });
});
