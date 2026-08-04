import { describe, expect, it } from 'vitest';
import handoffDocument from '../../implementation-control/GITHUB_HANDOFF.json';
import stateDocument from '../../implementation-control/IMPLEMENTATION_STATE.json';

const REMEDIATION_ID = 'b21-final-release-promotion-remediation';
const REMEDIATION_BRANCH = 'agent/b21-final-release-promotion-remediation';
const B20_ZIP_SHA256 = 'c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6';
const SPECIFY_TREE_SHA256 = 'e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09';
const REQUEST_REQUIRED_PATHS = [
  'implementation-control/GITHUB_HANDOFF.json',
  'implementation-control/CHANGE_LEDGER.md',
] as const;
const SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/iu;
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

function fail(code: string): never {
  throw new Error(code);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) fail(code);
}

function taskId(index: number) {
  return `T${String(index).padStart(3, '0')}`;
}

function batchId(index: number) {
  return `B${String(index).padStart(2, '0')}`;
}

function isValidIsoUtc(value: unknown) {
  if (typeof value !== 'string' || !ISO_UTC_PATTERN.test(value)) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return false;
  const normalized = value.includes('.') ? value : value.replace(/Z$/u, '.000Z');
  return parsed.toISOString() === normalized;
}

function assertExactPaths(value: unknown, code: string) {
  assertCondition(Array.isArray(value), code);
  const actual = [...value].sort();
  const expected = [...REQUEST_REQUIRED_PATHS].sort();
  assertCondition(JSON.stringify(actual) === JSON.stringify(expected), code);
}

function assertCandidate(value: unknown) {
  assertCondition(isRecord(value), 'CANDIDATE_INCOMPLETE');
  assertCondition(typeof value.sha === 'string' && SHA_PATTERN.test(value.sha), 'CANDIDATE_SHA_INVALID');
  assertCondition(Number.isInteger(value.runId) && value.runId > 0, 'CANDIDATE_RUN_ID_INVALID');
  assertCondition(Number.isInteger(value.artifactId) && value.artifactId > 0, 'CANDIDATE_ARTIFACT_ID_INVALID');
  assertCondition(typeof value.artifactName === 'string' && value.artifactName.trim().length > 0, 'CANDIDATE_ARTIFACT_NAME_INVALID');
  assertCondition(typeof value.artifactDigest === 'string' && DIGEST_PATTERN.test(value.artifactDigest), 'CANDIDATE_DIGEST_INVALID');
}

function assertProtectedState(handoff: any, state: any) {
  assertCondition(handoff.release?.pending === true, 'RELEASE_PENDING_REQUIRED');
  assertCondition(handoff.baseline?.zipSha256 === B20_ZIP_SHA256, 'BASELINE_B20_CHANGED');
  assertCondition(handoff.completedBaseline?.zipSha256 === B20_ZIP_SHA256, 'COMPLETED_BASELINE_B20_CHANGED');
  assertCondition(handoff.baseline?.specifyTreeSha256 === SPECIFY_TREE_SHA256, 'SPECIFY_TREE_CHANGED');
  assertCondition(handoff.completedBaseline?.specifyTreeSha256 === SPECIFY_TREE_SHA256, 'COMPLETED_SPECIFY_TREE_CHANGED');
  assertCondition(state.sourceBaseline?.sha256 === B20_ZIP_SHA256, 'STATE_BASELINE_B20_CHANGED');
  assertCondition(state.specifyTreeSha256 === SPECIFY_TREE_SHA256, 'STATE_SPECIFY_TREE_CHANGED');

  assertCondition(state.activeBatchId === 'B22', 'ACTIVE_BATCH_MUST_BE_B22');
  assertCondition(state.nextAuthorizedBatchId === 'B22', 'NEXT_AUTHORIZED_BATCH_MUST_BE_B22');
  assertCondition(state.phaseGate?.convergenceAuthorized === false, 'CONVERGENCE_MUST_BE_FALSE');
  assertCondition(handoff.productState?.activeBatchId === 'B22', 'HANDOFF_ACTIVE_BATCH_MUST_BE_B22');
  assertCondition(handoff.productState?.nextAuthorizedBatchId === 'B22', 'HANDOFF_NEXT_BATCH_MUST_BE_B22');
  assertCondition(handoff.productState?.completedTasksThrough === 'T095', 'HANDOFF_TASK_BOUNDARY_CHANGED');
  assertCondition(handoff.productState?.convergenceAuthorized === false, 'HANDOFF_CONVERGENCE_MUST_BE_FALSE');

  for (let index = 1; index <= 95; index += 1) {
    assertCondition(state.taskStatus?.[taskId(index)] === 'COMPLETED', 'COMPLETED_TASK_STATE_CHANGED');
  }
  for (let index = 96; index <= 109; index += 1) {
    assertCondition(state.taskStatus?.[taskId(index)] === 'PENDING', 'PENDING_TASK_STATE_CHANGED');
  }
  const completedTasks = new Set(state.completedTaskIds);
  assertCondition(completedTasks.size === 95, 'COMPLETED_TASK_SET_CHANGED');
  for (let index = 1; index <= 95; index += 1) {
    assertCondition(completedTasks.has(taskId(index)), 'COMPLETED_TASK_SET_CHANGED');
  }

  for (let index = 1; index <= 21; index += 1) {
    assertCondition(state.batchStatus?.[batchId(index)] === 'COMPLETED', 'COMPLETED_BATCH_STATE_CHANGED');
  }
  for (let index = 22; index <= 25; index += 1) {
    assertCondition(state.batchStatus?.[batchId(index)] === 'PENDING', 'PENDING_BATCH_STATE_CHANGED');
  }
  const completedBatches = new Set(state.completedBatchIds);
  assertCondition(completedBatches.size === 21, 'COMPLETED_BATCH_SET_CHANGED');
  for (let index = 1; index <= 21; index += 1) {
    assertCondition(completedBatches.has(batchId(index)), 'COMPLETED_BATCH_SET_CHANGED');
  }
}

function validateRemediationLifecycle({ handoff, state }: { handoff: any; state: any }) {
  assertProtectedState(handoff, state);

  const matches = handoff.remediations.filter((entry: any) => entry.id === REMEDIATION_ID);
  assertCondition(matches.length === 1, 'REMEDIATION_ID_AMBIGUOUS');
  const remediation = matches[0];
  const policy = remediation.closurePolicy;

  assertCondition(isRecord(policy), 'CLOSURE_POLICY_MISSING');
  assertCondition(policy.kind === 'REMEDIATION_CLOSURE', 'CLOSURE_POLICY_KIND_INVALID');
  assertCondition(policy.remediationId === REMEDIATION_ID, 'CLOSURE_POLICY_REMEDIATION_ID_INVALID');
  assertCondition(remediation.branch === REMEDIATION_BRANCH, 'REMEDIATION_BRANCH_INVALID');
  assertCondition(policy.branch === REMEDIATION_BRANCH, 'CLOSURE_POLICY_BRANCH_INVALID');
  assertExactPaths(policy.requestAllowedPaths, 'REQUEST_ALLOWED_PATHS_INVALID');

  assertCondition(Array.isArray(remediation.allowedPaths), 'PARENT_ALLOWLIST_MISSING');
  assertCondition(Array.isArray(policy.allowedPaths), 'CLOSURE_ALLOWLIST_MISSING');
  const parentAllowlist = new Set(remediation.allowedPaths);
  const missing = policy.allowedPaths.filter((path: string) => !parentAllowlist.has(path));
  assertCondition(missing.length === 0, 'CLOSURE_ALLOWLIST_OUTSIDE_PARENT');

  const lifecycle = `${policy.stage}/${policy.status}`;
  if (lifecycle === 'candidate/NOT_REQUESTED') {
    assertCondition(policy.candidate === null, 'CANDIDATE_STAGE_CANDIDATE_MUST_BE_NULL');
    assertCondition(policy.closure === null, 'CANDIDATE_STAGE_CLOSURE_MUST_BE_NULL');
    return;
  }

  if (lifecycle === 'closure/PENDING') {
    assertCandidate(policy.candidate);
    assertCondition(isRecord(policy.closure), 'PENDING_CLOSURE_INCOMPLETE');
    assertCondition(typeof policy.closure.authorizationText === 'string' && policy.closure.authorizationText.trim().length > 0, 'PENDING_CLOSURE_INCOMPLETE');
    assertCondition(isValidIsoUtc(policy.closure.requestedAt), 'PENDING_REQUESTED_AT_INVALID');
    assertCondition(Array.isArray(policy.closure.postClosureProhibitions) && policy.closure.postClosureProhibitions.length > 0, 'PENDING_PROHIBITIONS_INVALID');
    assertCondition(policy.closure.postClosureProhibitions.every((entry: unknown) => typeof entry === 'string' && entry.trim().length > 0), 'PENDING_PROHIBITIONS_INVALID');
    assertExactPaths(policy.closure.requestRequiredPaths, 'REQUEST_REQUIRED_PATHS_INVALID');
    return;
  }

  if (lifecycle === 'completed/COMPLETED') {
    assertCandidate(policy.candidate);
    assertCondition(isRecord(policy.closure), 'COMPLETED_CLOSURE_INCOMPLETE');
    assertCondition(typeof policy.closure.candidateSha === 'string' && SHA_PATTERN.test(policy.closure.candidateSha), 'COMPLETED_CANDIDATE_SHA_INVALID');
    assertCondition(policy.closure.candidateSha === policy.candidate.sha, 'COMPLETED_CANDIDATE_SHA_MISMATCH');
    assertCondition(typeof policy.closure.requestSha === 'string' && SHA_PATTERN.test(policy.closure.requestSha), 'COMPLETED_REQUEST_SHA_INVALID');
    assertCondition(Number.isInteger(policy.closure.runId) && policy.closure.runId > 0, 'COMPLETED_RUN_ID_INVALID');
    assertCondition(isValidIsoUtc(policy.closure.completedAt), 'COMPLETED_AT_INVALID');
    return;
  }

  fail('LIFECYCLE_STAGE_STATUS_INCOMPATIBLE');
}

const validCandidate = {
  sha: '1'.repeat(40),
  runId: 101,
  artifactId: 202,
  artifactName: 'finscope-github-validation-candidate-PASS',
  artifactDigest: `sha256:${'2'.repeat(64)}`,
};

function fixture(stage: 'candidate' | 'closure' | 'completed') {
  const handoff = structuredClone(handoffDocument) as any;
  const state = structuredClone(stateDocument) as any;
  const remediation = handoff.remediations.find((entry: any) => entry.id === REMEDIATION_ID)!;

  if (stage === 'candidate') {
    Object.assign(remediation.closurePolicy, {
      stage: 'candidate', status: 'NOT_REQUESTED', candidate: null, closure: null,
    });
  } else if (stage === 'closure') {
    Object.assign(remediation.closurePolicy, {
      stage: 'closure',
      status: 'PENDING',
      candidate: structuredClone(validCandidate),
      closure: {
        authorizationText: 'Autorizo exclusivamente el cierre autenticado del candidato exacto.',
        requestedAt: '2026-08-04T18:00:00.000Z',
        postClosureProhibitions: ['No merge.', 'No Release.'],
        requestRequiredPaths: [...REQUEST_REQUIRED_PATHS],
      },
    });
  } else {
    Object.assign(remediation.closurePolicy, {
      stage: 'completed',
      status: 'COMPLETED',
      candidate: structuredClone(validCandidate),
      closure: {
        candidateSha: validCandidate.sha,
        requestSha: '3'.repeat(40),
        runId: 303,
        completedAt: '2026-08-04T18:30:00.000Z',
      },
    });
  }
  return { handoff, state, remediation };
}

describe('remediation validation allowlist lifecycle integrity', () => {
  it('accepts valid candidate/NOT_REQUESTED', () => {
    expect(() => validateRemediationLifecycle(fixture('candidate'))).not.toThrow();
  });

  it('accepts valid closure/PENDING', () => {
    expect(() => validateRemediationLifecycle(fixture('closure'))).not.toThrow();
  });

  it('accepts valid completed/COMPLETED', () => {
    expect(() => validateRemediationLifecycle(fixture('completed'))).not.toThrow();
  });

  it('accepts the real current handoff', () => {
    expect(() => validateRemediationLifecycle({
      handoff: structuredClone(handoffDocument),
      state: structuredClone(stateDocument),
    })).not.toThrow();
  });

  it.each([
    ['stage/status incompatible', 'LIFECYCLE_STAGE_STATUS_INCOMPATIBLE', () => {
      const value = fixture('candidate'); value.remediation.closurePolicy.status = 'PENDING'; return value;
    }],
    ['candidate incomplete', 'CANDIDATE_INCOMPLETE', () => {
      const value = fixture('closure'); delete value.remediation.closurePolicy.candidate.artifactId; return value;
    }],
    ['candidate SHA invalid', 'CANDIDATE_SHA_INVALID', () => {
      const value = fixture('closure'); value.remediation.closurePolicy.candidate.sha = 'not-a-sha'; return value;
    }],
    ['candidate digest invalid', 'CANDIDATE_DIGEST_INVALID', () => {
      const value = fixture('closure'); value.remediation.closurePolicy.candidate.artifactDigest = 'sha256:bad'; return value;
    }],
    ['pending closure incomplete', 'PENDING_CLOSURE_INCOMPLETE', () => {
      const value = fixture('closure'); delete value.remediation.closurePolicy.closure.authorizationText; return value;
    }],
    ['request paths incomplete', 'REQUEST_REQUIRED_PATHS_INVALID', () => {
      const value = fixture('closure'); value.remediation.closurePolicy.closure.requestRequiredPaths.pop(); return value;
    }],
    ['request paths contain additions', 'REQUEST_REQUIRED_PATHS_INVALID', () => {
      const value = fixture('closure'); value.remediation.closurePolicy.closure.requestRequiredPaths.push('unexpected/path'); return value;
    }],
    ['completed closure lacks requestSha', 'COMPLETED_REQUEST_SHA_INVALID', () => {
      const value = fixture('completed'); delete value.remediation.closurePolicy.closure.requestSha; return value;
    }],
    ['completed candidateSha differs', 'COMPLETED_CANDIDATE_SHA_MISMATCH', () => {
      const value = fixture('completed'); value.remediation.closurePolicy.closure.candidateSha = '4'.repeat(40); return value;
    }],
    ['closure allowlist escapes parent', 'CLOSURE_ALLOWLIST_OUTSIDE_PARENT', () => {
      const value = fixture('candidate'); value.remediation.closurePolicy.allowedPaths.push('src/forbidden.ts'); return value;
    }],
    ['release pending is false', 'RELEASE_PENDING_REQUIRED', () => {
      const value = fixture('candidate'); value.handoff.release.pending = false; return value;
    }],
    ['B22 is not pending', 'PENDING_BATCH_STATE_CHANGED', () => {
      const value = fixture('candidate'); value.state.batchStatus.B22 = 'COMPLETED'; return value;
    }],
    ['convergence is authorized', 'CONVERGENCE_MUST_BE_FALSE', () => {
      const value = fixture('candidate'); value.state.phaseGate.convergenceAuthorized = true; return value;
    }],
  ] as const)('rejects %s', (_label, expectedCode, build) => {
    expect(() => validateRemediationLifecycle(build())).toThrow(expectedCode);
  });
});
