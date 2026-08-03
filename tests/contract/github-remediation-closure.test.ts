import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';
import {
  assertCompleteRemediationCandidate,
  assertClosureWorkflowOutcomes,
  assertExactAllowedPaths,
  buildCompletedRemediationPolicy,
  resolveRemediationClosureRequest,
  validateRemediationArtifactMetadata,
  validateRemediationCandidateEvidence,
  validateRemediationProductState,
  remediationClosureArtifactName,
} from '../../implementation-control/scripts/Apply-GitHubRemediationClosure.mjs';
import {
  assertPreparedFinalization,
  buildConditionalPushCommand,
  confirmRemotePush,
} from '../../implementation-control/scripts/Finalize-GitHubRemediationClosure.mjs';
import { resolveGitHubClosureContext } from '../../implementation-control/scripts/Resolve-GitHubContext.mjs';
import { shaBytes, validateSchemaSubset, verifyManifest } from '../../implementation-control/scripts/GitHub-Common.mjs';

const branch = 'agent/b21-clean-completed-package-remediation';
const candidate = {
  sha: '1'.repeat(40), runId: 101, artifactId: 202,
  artifactName: 'finscope-github-validation-candidate-PASS', artifactDigest: `sha256:${'2'.repeat(64)}`,
};

function pendingInput() {
  const handoff = structuredClone(handoffDocument) as any;
  const remediation = handoff.remediations.find((entry: any) => entry.id === 'b21-clean-completed-package-remediation')!;
  remediation.closurePolicy = { ...remediation.closurePolicy, stage: 'closure', status: 'PENDING', candidate: { ...candidate }, closure: { requestedAt: '2026-08-03T12:00:00.000Z' } };
  return { handoff, state: structuredClone(stateDocument), remediation };
}

function runInfo(overrides = {}) {
  return { id: candidate.runId, head_sha: candidate.sha, head_branch: branch, conclusion: 'success', event: 'pull_request', ...overrides };
}
function artifactInfo(overrides = {}) {
  return { id: candidate.artifactId, name: candidate.artifactName, expired: false, digest: candidate.artifactDigest, workflow_run: { id: candidate.runId, head_sha: candidate.sha }, ...overrides };
}
function candidateEvidence(remediation: any) {
  return {
    result: 'PASS', primaryFailure: null, commitSha: candidate.sha, runId: String(candidate.runId), branch, mode: remediation.mode,
    remediationScope: { id: remediation.id, valid: true, allowedPaths: remediation.allowedPaths, changedPaths: [] },
    releaseBaseline: { result: 'PASS', tag: handoffDocument.completedBaseline.tag, zipSha256: handoffDocument.completedBaseline.zipSha256 },
    specify: { byteIdentical: true, sha256: handoffDocument.completedBaseline.specifyTreeSha256 },
    derivedBatchCommands: structuredClone(remediation.commands),
    executedCommands: remediation.commands.map((command) => ({ ...command, status: 'PASS', exitCode: 0 })),
  };
}

describe('batch closure regression', () => {
  it('preserves routing to the existing batch closure only for its exact operation branch', () => {
    const handoff = structuredClone(handoffDocument); handoff.operation.stage = 'closure';
    expect(resolveGitHubClosureContext({ branch: handoff.operation.branch, handoff })).toMatchObject({ closureType: 'BATCH_CLOSURE', activeBatchId: 'B21' });
  });

  it('keeps the batch applicator present and independent', async () => {
    const [workflow, batch] = await Promise.all([
      readFile('.github/workflows/finscope-closure-validation.yml', 'utf8'),
      readFile('implementation-control/scripts/Apply-GitHubBatchClosure.mjs', 'utf8'),
    ]);
    expect(workflow).toContain('BATCH_CLOSURE)');
    expect(workflow).toContain('Apply-GitHubBatchClosure.mjs');
    expect(batch).toContain('CLOSURE_STATE_NOT_PENDING');
  });
});

describe('remediation closure routing and authentication', () => {
  it('resolves a valid remediation closure without batch authority', () => {
    const value = pendingInput();
    expect(resolveRemediationClosureRequest({ branch, handoff: value.handoff, state: value.state, requestSha: '3'.repeat(40) })).toMatchObject({ route: { closureType: 'REMEDIATION_CLOSURE', remediationId: value.remediation.id, historicalBatchFallbackAllowed: false }, candidate });
  });

  it('returns NOT_APPLICABLE during candidate stage', () => {
    expect(resolveGitHubClosureContext({ branch, handoff: structuredClone(handoffDocument) })).toMatchObject({ closureType: 'NOT_APPLICABLE', policyStage: 'candidate', policyStatus: 'NOT_REQUESTED' });
  });

  it('fails closed on the wrong branch for a pending remediation', () => {
    const value = pendingInput();
    expect(() => resolveGitHubClosureContext({ branch: 'agent/wrong', handoff: value.handoff })).toThrow(/REMEDIATION_BRANCH_MISMATCH/u);
  });

  it('fails closed on an unknown remediationId', () => {
    const value = pendingInput(); value.remediation.closurePolicy.remediationId = 'unknown';
    expect(() => resolveGitHubClosureContext({ branch, handoff: value.handoff })).toThrow(/REMEDIATION_ID_MISMATCH/u);
  });

  it('rejects duplicate or ambiguous remediations', () => {
    const value = pendingInput(); value.handoff.remediations.push(structuredClone(value.remediation));
    expect(() => resolveGitHubClosureContext({ branch, handoff: value.handoff })).toThrow(/REMEDIATION_AMBIGUOUS/u);
  });

  it('rejects a missing remediation-owned candidate', () => {
    const value = pendingInput(); value.remediation.closurePolicy.candidate = null;
    expect(() => resolveGitHubClosureContext({ branch, handoff: value.handoff })).toThrow(/REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE/u);
    expect(() => assertCompleteRemediationCandidate(null)).toThrow(/REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE/u);
  });

  it('rejects the wrong candidate run', () => {
    expect(() => validateRemediationArtifactMetadata({ candidate, runInfo: runInfo({ id: 999 }), artifactInfo: artifactInfo(), branch })).toThrow(/RUN_IDENTITY_MISMATCH/u);
  });

  it('rejects the wrong artifact ID or name', () => {
    expect(() => validateRemediationArtifactMetadata({ candidate, runInfo: runInfo(), artifactInfo: artifactInfo({ id: 999 }), branch })).toThrow(/ARTIFACT_ID_MISMATCH/u);
    expect(() => validateRemediationArtifactMetadata({ candidate, runInfo: runInfo(), artifactInfo: artifactInfo({ name: 'wrong' }), branch })).toThrow(/ARTIFACT_NAME_MISMATCH/u);
  });

  it('rejects a wrong artifact digest', () => {
    expect(() => validateRemediationArtifactMetadata({ candidate, runInfo: runInfo(), artifactInfo: artifactInfo({ digest: `sha256:${'9'.repeat(64)}` }), branch })).toThrow(/DIGEST_METADATA_MISMATCH/u);
  });

  it('rejects an expired artifact', () => {
    expect(() => validateRemediationArtifactMetadata({ candidate, runInfo: runInfo(), artifactInfo: artifactInfo({ expired: true }), branch })).toThrow(/ARTIFACT_EXPIRED/u);
  });

  it('accepts exact run and artifact identities', () => {
    expect(validateRemediationArtifactMetadata({ candidate, runInfo: runInfo(), artifactInfo: artifactInfo(), branch })).toBe(true);
  });

  it('rejects an invalid candidate evidence identity or required command result', () => {
    const value = pendingInput();
    expect(() => validateRemediationCandidateEvidence({ evidence: { ...candidateEvidence(value.remediation), branch: 'wrong' }, remediation: value.remediation, candidate, handoff: value.handoff })).toThrow(/EVIDENCE_SCOPE_MISMATCH/u);
    const failed = candidateEvidence(value.remediation); failed.executedCommands[0].status = 'NOT_RUN';
    expect(() => validateRemediationCandidateEvidence({ evidence: failed, remediation: value.remediation, candidate, handoff: value.handoff })).toThrow(/REQUIRED_COMMAND_NOT_PASS/u);
  });

  it('accepts an exact candidate evidence document', () => {
    const value = pendingInput();
    expect(validateRemediationCandidateEvidence({ evidence: candidateEvidence(value.remediation), remediation: value.remediation, candidate, handoff: value.handoff })).toBe(true);
  });

  it('contains an explicit candidate ancestry check', async () => {
    expect(await readFile('implementation-control/scripts/Apply-GitHubRemediationClosure.mjs', 'utf8')).toContain('git merge-base --is-ancestor');
  });

  it('prepares and commits locally without pushing from the apply script', async () => {
    const source = await readFile('implementation-control/scripts/Apply-GitHubRemediationClosure.mjs', 'utf8');
    expect(source).toContain('git commit -m');
    expect(source).toContain('prepared: true, pushed: false');
    expect(source).not.toContain('git push');
  });

  it('fails closed when apply or control-plane outcomes are not success', () => {
    expect(assertClosureWorkflowOutcomes({ applyOutcome: 'success', controlPlaneOutcome: 'success' })).toEqual({ localValidation: 'PASS', controlPlaneValidation: 'PASS' });
    expect(() => assertClosureWorkflowOutcomes({ applyOutcome: 'failure', controlPlaneOutcome: 'success' })).toThrow(/APPLY_FAILED/u);
    expect(() => assertClosureWorkflowOutcomes({ applyOutcome: 'success', controlPlaneOutcome: 'failure' })).toThrow(/CONTROL_PLANE_FAILED/u);
  });

  it('rejects a closure request diff outside its exact allowlist', () => {
    const value = pendingInput();
    expect(() => assertExactAllowedPaths(['implementation-control/GITHUB_HANDOFF.json', 'src/app.ts'], value.remediation.closurePolicy.requestAllowedPaths, 'REMEDIATION_CLOSURE_REQUEST_ALLOWLIST_VIOLATION')).toThrow(/REQUEST_ALLOWLIST_VIOLATION/u);
  });

  it('never falls back to historical handoff.operation', () => {
    const value = pendingInput(); value.handoff.operation.stage = 'closure'; value.handoff.operation.branch = 'agent/historical';
    expect(resolveGitHubClosureContext({ branch, handoff: value.handoff })).toMatchObject({ closureType: 'REMEDIATION_CLOSURE', historicalBatchFallbackAllowed: false });
  });

  it('never consumes the historical top-level candidate', () => {
    const value = pendingInput(); value.remediation.closurePolicy.candidate = null; value.handoff.candidate = { ...candidate };
    expect(() => resolveGitHubClosureContext({ branch, handoff: value.handoff })).toThrow(/REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE/u);
  });

  it('rejects any attempt to select B22 in remediation closure policy', () => {
    const value = pendingInput(); Object.assign(value.remediation.closurePolicy, { activeBatchId: 'B22' });
    expect(() => resolveGitHubClosureContext({ branch, handoff: value.handoff })).toThrow(/unexpected activeBatchId/u);
  });

  it.each([
    'specs/001-fundamental-analysis-platform/tasks.md',
    'implementation-control/IMPLEMENTATION_STATE.json',
    'implementation-control/batches/B22.json',
    'src/app/composition.ts',
    '.specify/memory/constitution.md',
  ])('rejects a forbidden closure mutation: %s', (path) => {
    const value = pendingInput();
    expect(() => assertExactAllowedPaths([path], value.remediation.closurePolicy.allowedPaths)).toThrow(/ALLOWLIST_VIOLATION/u);
  });

  it('keeps B21 completed, B22 pending and convergence unauthorized', () => {
    expect(validateRemediationProductState(structuredClone(stateDocument))).toEqual({ b21Status: 'COMPLETED', b22Status: 'PENDING', convergenceAuthorized: false });
    const state = structuredClone(stateDocument); state.batchStatus.B22 = 'COMPLETED';
    expect(() => validateRemediationProductState(state)).toThrow(/B22_NOT_PENDING/u);
  });

  it('handles repeated completion deterministically', () => {
    const value = pendingInput(); const completed = buildCompletedRemediationPolicy(value.remediation.closurePolicy, { requestSha: '3'.repeat(40), runId: 303, completedAt: '2026-08-03T13:00:00.000Z' });
    expect(completed).toMatchObject({ stage: 'completed', status: 'COMPLETED', closure: { candidateSha: candidate.sha, requestSha: '3'.repeat(40), runId: 303 } });
    expect(() => buildCompletedRemediationPolicy(completed, { requestSha: '3'.repeat(40), runId: 303, completedAt: '2026-08-03T13:00:00.000Z' })).toThrow(/REQUEST_INVALID/u);
  });

  it('does not dispatch the batch applicator from the REMEDIATION_CLOSURE case', async () => {
    const workflow = await readFile('.github/workflows/finscope-closure-validation.yml', 'utf8');
    const remediationCase = workflow.slice(workflow.lastIndexOf('REMEDIATION_CLOSURE)')).split('NOT_APPLICABLE)')[0];
    expect(remediationCase).toContain('Apply-GitHubRemediationClosure.mjs');
    expect(remediationCase).not.toContain('Apply-GitHubBatchClosure.mjs');
  });
});

describe('remediation closure atomic finalization', () => {
  const requestSha = '3'.repeat(40); const closureSha = '4'.repeat(40);
  const applyContext = {
    result: 'PASS', prepared: true, pushed: false, requestSha, closureSha, candidateSha: '1'.repeat(40),
    remoteExpectedHead: requestSha, branch,
  };
  const localContext = { result: 'PASS', localValidation: 'PASS', controlPlaneValidation: 'PASS', requestSha, closureSha, branch };

  it('rejects a remote branch that moved away from requestSha', () => {
    expect(() => assertPreparedFinalization({ applyContext, localContext, localHead: closureSha, remoteHead: '5'.repeat(40) })).toThrow(/REMOTE_HEAD_MOVED/u);
  });

  it('refuses finalization unless local and control-plane validation are PASS', () => {
    expect(() => assertPreparedFinalization({ applyContext, localContext: { ...localContext, controlPlaneValidation: 'FAIL' }, localHead: closureSha, remoteHead: requestSha })).toThrow(/LOCAL_VALIDATION_NOT_PASS/u);
  });

  it('uses force-with-lease bound to requestSha and never an unleased force', () => {
    const command = buildConditionalPushCommand({ branch, requestSha, closureSha });
    expect(command).toContain(`--force-with-lease="refs/heads/${branch}:${requestSha}"`);
    expect(command).not.toMatch(/\s--force\s/u);
  });

  it('accepts only a post-push remote read equal to closureSha', () => {
    expect(confirmRemotePush(closureSha, closureSha)).toEqual({ remotePushValidation: 'PASS', remoteBranchVerified: true, remoteHeadSha: closureSha });
    expect(() => confirmRemotePush(requestSha, closureSha)).toThrow(/REMOTE_PUSH_NOT_CONFIRMED/u);
  });

  it('queries the remote both before and after the conditional push', async () => {
    const source = await readFile('implementation-control/scripts/Finalize-GitHubRemediationClosure.mjs', 'utf8');
    expect(source.match(/await readRemoteBranchHead\(/gu)).toHaveLength(2);
    expect(source.indexOf('const confirmedRemoteHead')).toBeGreaterThan(source.indexOf('buildConditionalPushCommand'));
  });

  it('never names a failed artifact PASS', () => {
    expect(remediationClosureArtifactName(closureSha, 'FAIL')).toMatch(/_FAILED$/u);
    expect(remediationClosureArtifactName(closureSha, 'FAIL')).not.toMatch(/-PASS$/u);
  });
});

const remediationClosureEvidenceSchema = JSON.parse(await readFile('implementation-control/schemas/github-remediation-closure-evidence.schema.json', 'utf8'));

describe('remediation closure evidence schema contract', () => {
  const schema = remediationClosureEvidenceSchema;
  const ajv = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const valid = {
    schemaVersion: '1.0.0', result: 'PASS', mode: 'REMEDIATION_CLOSURE', repository: 'Nespeche/finscope-analytics',
    remediationId: 'b21-clean-completed-package-remediation', remediationMode: 'MAINTENANCE_REMEDIATION', branch,
    candidateSha: '1'.repeat(40), closureRequestSha: '3'.repeat(40), closureCommitSha: '4'.repeat(40),
    candidateRunId: 101, artifactId: 202, artifactName: 'candidate-PASS', artifactDigest: `sha256:${'2'.repeat(64)}`,
    artifactSchemaValidation: 'PASS', manifestValidation: 'PASS', requiredCommands: 'PASS', candidateAncestry: 'PASS',
    changedFiles: ['implementation-control/GITHUB_HANDOFF.json'], closureAllowedPaths: ['implementation-control/GITHUB_HANDOFF.json'],
    productStateUnchanged: true, tasksUnchanged: true, batchesUnchanged: true, specifyByteIdentical: true,
    b21Status: 'COMPLETED', b22Status: 'PENDING', convergenceAuthorized: false,
    localValidation: 'PASS', controlPlaneValidation: 'PASS', remotePushValidation: 'PASS',
    remoteBranchVerified: true, remoteHeadSha: '4'.repeat(40),
    checkedAt: '2026-08-03T13:00:00.000Z', primaryFailure: null, details: [],
  };
  const dependencyFree = (value: unknown) => validateSchemaSubset(schema, value, '$', schema, []).length === 0;

  it('accepts final PASS bytes with the dependency-free and Ajv Draft 2020-12 validators', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'finscope-remediation-schema-')); const path = join(directory, 'evidence.json');
    await writeFile(path, `${JSON.stringify(valid, null, 2)}\n`, 'utf8'); const reread = JSON.parse(await readFile(path, 'utf8'));
    expect(dependencyFree(reread)).toBe(true); expect(ajv(reread)).toBe(true);
  });

  it('rejects an invalid schema result and a PASS with false invariants', () => {
    expect(dependencyFree({ ...valid, result: 'UNKNOWN' })).toBe(false);
    expect(ajv({ ...valid, productStateUnchanged: false })).toBe(false);
    expect(dependencyFree({ ...valid, productStateUnchanged: false })).toBe(false);
    expect(ajv({ ...valid, remoteBranchVerified: false })).toBe(false);
    expect(dependencyFree({ ...valid, remoteHeadSha: null })).toBe(false);
    expect(ajv({ ...valid, controlPlaneValidation: 'FAIL' })).toBe(false);
  });

  it('rejects a manifest with invalid bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'finscope-remediation-manifest-'));
    await writeFile(join(directory, 'payload.json'), '{}\n', 'utf8');
    await writeFile(join(directory, 'EVIDENCE_MANIFEST.sha256'), `${shaBytes(Buffer.from('wrong'))}  payload.json\n`, 'utf8');
    await expect(verifyManifest(directory)).rejects.toThrow(/MANIFEST_HASH_MISMATCH/u);
  });

  it('rejects an additional evidence property with both validators', () => {
    const tampered = { ...valid, unexpected: true };
    expect(dependencyFree(tampered)).toBe(false); expect(ajv(tampered)).toBe(false);
  });

  it('prohibits batch-only fields in REMEDIATION_CLOSURE evidence', () => {
    expect(dependencyFree({ ...valid, activeBatchId: 'B22' })).toBe(false);
    expect(ajv({ ...valid, operationId: 'B21' })).toBe(false);
  });
});
