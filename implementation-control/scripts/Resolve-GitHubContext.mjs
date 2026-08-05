import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class ContextResolutionError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `:${detail}` : ''}`); this.code = code; }
}

const fail = (code, detail) => { throw new ContextResolutionError(code, detail); };
const requiredGates = ['tasksAuthorized', 'analysisAuthorized', 'implementationAuthorized'];
const operationStages = { BOOTSTRAP: ['candidate', 'closure'], RELEASE_REMEDIATION: ['candidate', 'closure', 'completed'] };
const remediationModes = new Set(['CONTROL_PLANE_REMEDIATION', 'MAINTENANCE_REMEDIATION']);
const remediationClosureStages = new Map([
  ['candidate', 'NOT_REQUESTED'],
  ['closure', 'PENDING'],
  ['completed', 'COMPLETED'],
]);
const remediationClosureKinds = new Set(['REMEDIATION_CLOSURE']);
const shaPattern = /^[0-9a-f]{40}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;

function normalizedCommands(commands = []) {
  return commands.map(({ id, category, command, required }) => ({ id, category, command, required: Boolean(required) }));
}

function validateOperation(operation) {
  if (!operation || typeof operation !== 'object') fail('OPERATION_KIND_INVALID', 'missing operation');
  if (!Object.hasOwn(operationStages, operation.kind)) fail('OPERATION_KIND_INVALID', String(operation.kind));
  for (const field of ['id', 'branch', 'stage', 'activeBatchId', 'baselineRole']) {
    if (typeof operation[field] !== 'string' || !operation[field].trim()) fail('OPERATION_KIND_INVALID', `missing ${field}`);
  }
  if (!operationStages[operation.kind].includes(operation.stage)) fail('OPERATION_KIND_INVALID', `${operation.kind}/${operation.stage}`);
}

function validateRemediationState(remediation) {
  const fields = ['stage', 'status', 'candidate', 'closure'];
  const present = fields.filter((field) => Object.hasOwn(remediation, field));
  if (present.length === 0) return;
  if (present.length !== fields.length) fail('REMEDIATION_STATE_INVALID', `${remediation.id}:incomplete`);
  if (!remediationClosureStages.has(remediation.stage) || remediationClosureStages.get(remediation.stage) !== remediation.status) {
    fail('REMEDIATION_STATE_INVALID', `${remediation.id}:${remediation.stage}/${remediation.status}`);
  }
  if (remediation.stage === 'candidate' && (remediation.candidate !== null || remediation.closure !== null)) {
    fail('REMEDIATION_STATE_INVALID', `${remediation.id}:candidate must not reuse evidence`);
  }
}

function validateRemediation(remediation) {
  if (!remediation || typeof remediation !== 'object') fail('OPERATION_KIND_INVALID', 'missing remediation');
  for (const field of ['id', 'mode', 'branch', 'baselineRole']) {
    if (typeof remediation[field] !== 'string' || !remediation[field].trim()) fail('OPERATION_KIND_INVALID', `remediation missing ${field}`);
  }
  if (!remediationModes.has(remediation.mode)) fail('OPERATION_KIND_INVALID', `remediation ${remediation.mode}`);
  if (remediation.baselineRole !== 'CURRENT_COMPLETED_BASELINE') fail('BASELINE_ROLE_MISMATCH', remediation.baselineRole);
  if (!Array.isArray(remediation.allowedPaths) || remediation.allowedPaths.length === 0) fail('OPERATION_KIND_INVALID', `remediation ${remediation.id} missing allowedPaths`);
  const uniquePaths = new Set();
  for (const path of remediation.allowedPaths) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || /^[A-Za-z]:/u.test(path) || path.split('/').includes('..')) fail('OPERATION_KIND_INVALID', `unsafe remediation path ${String(path)}`);
    if (uniquePaths.has(path)) fail('OPERATION_KIND_INVALID', `duplicate remediation path ${path}`);
    uniquePaths.add(path);
  }
  if (normalizedCommands(remediation.commands).length === 0) fail('DERIVED_COMMAND_SET_MISMATCH', `remediation ${remediation.id} has no commands`);
  validateRemediationState(remediation);
  if (remediation.closurePolicy !== undefined) validateRemediationClosurePolicy(remediation);
}

function validateSafePathList(paths, code, label) {
  if (!Array.isArray(paths) || paths.length === 0) fail(code, `${label} missing`);
  const unique = new Set();
  for (const path of paths) {
    if (typeof path !== 'string' || !path || path.startsWith('/') || /^[A-Za-z]:/u.test(path) || path.split('/').includes('..')) fail(code, `unsafe ${label} path ${String(path)}`);
    if (unique.has(path)) fail(code, `duplicate ${label} path ${path}`);
    unique.add(path);
  }
}

export function validateRemediationClosurePolicy(remediation) {
  const policy = remediation?.closurePolicy;
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('REMEDIATION_CLOSURE_POLICY_INVALID', `${remediation?.id ?? 'unknown'} missing closurePolicy`);
  const allowedKeys = new Set(['kind', 'remediationId', 'branch', 'stage', 'status', 'candidate', 'closure', 'requestAllowedPaths', 'allowedPaths']);
  const unexpected = Object.keys(policy).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) fail('REMEDIATION_CLOSURE_POLICY_INVALID', `unexpected ${unexpected.join(',')}`);
  if (!remediationClosureKinds.has(policy.kind)) fail('REMEDIATION_CLOSURE_KIND_INVALID', String(policy.kind));
  if (policy.remediationId !== remediation.id) fail('REMEDIATION_ID_MISMATCH', `${policy.remediationId}/${remediation.id}`);
  if (policy.branch !== remediation.branch) fail('REMEDIATION_BRANCH_MISMATCH', `${policy.branch}/${remediation.branch}`);
  if (!remediationClosureStages.has(policy.stage) || remediationClosureStages.get(policy.stage) !== policy.status) fail('REMEDIATION_CLOSURE_STATE_INVALID', `${policy.stage}/${policy.status}`);
  validateSafePathList(policy.requestAllowedPaths, 'REMEDIATION_CLOSURE_POLICY_INVALID', 'requestAllowedPaths');
  validateSafePathList(policy.allowedPaths, 'REMEDIATION_CLOSURE_POLICY_INVALID', 'allowedPaths');
  const forbidden = ['specs/001-fundamental-analysis-platform/tasks.md', 'implementation-control/IMPLEMENTATION_STATE.json', 'implementation-control/TASK_SOURCE_LOCK.json', 'implementation-control/IMPLEMENTATION_BATCH_MAP.json'];
  if (policy.allowedPaths.some((path) => forbidden.includes(path) || path.startsWith('implementation-control/batches/') || path.startsWith('.specify/') || path.startsWith('src/') || path.startsWith('workers/'))) fail('REMEDIATION_CLOSURE_POLICY_INVALID', 'forbidden closure path');
  if (policy.stage === 'candidate' && (policy.candidate !== null || policy.closure !== null)) fail('REMEDIATION_CLOSURE_STATE_INVALID', 'candidate stage must not reuse candidate or closure');
  if (policy.stage !== 'candidate') {
    for (const field of ['sha', 'runId', 'artifactId', 'artifactName', 'artifactDigest']) if (policy.candidate?.[field] === undefined || policy.candidate?.[field] === null || policy.candidate?.[field] === '') fail('REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE', field);
    if (!/^[0-9a-f]{40}$/u.test(policy.candidate.sha) || !/^sha256:[0-9a-f]{64}$/u.test(policy.candidate.artifactDigest)) fail('REMEDIATION_CANDIDATE_REFERENCE_INVALID');
  }
  if (policy.stage === 'closure' && (!policy.closure || typeof policy.closure.requestedAt !== 'string')) fail('REMEDIATION_CLOSURE_REQUEST_INVALID', 'closure request metadata missing');
  if (policy.stage === 'completed') {
    for (const field of ['candidateSha', 'requestSha', 'runId', 'completedAt']) if (policy.closure?.[field] === undefined || policy.closure?.[field] === null || policy.closure?.[field] === '') fail('REMEDIATION_CLOSURE_COMPLETION_INVALID', field);
    if (policy.closure.candidateSha !== policy.candidate.sha || !/^[0-9a-f]{40}$/u.test(policy.closure.requestSha)) fail('REMEDIATION_CLOSURE_COMPLETION_INVALID', 'identity');
  }
  return policy;
}

export function resolveGitHubClosureContext({ branch, handoff }) {
  if (typeof branch !== 'string' || !branch) fail('OPERATION_BRANCH_MISMATCH', 'branch missing');
  validateOperation(handoff.operation);
  if (!Array.isArray(handoff.remediations)) fail('OPERATION_KIND_INVALID', 'missing remediations');
  const ids = new Set(); const branches = new Set();
  for (const remediation of handoff.remediations) {
    validateRemediation(remediation);
    if (ids.has(remediation.id) || branches.has(remediation.branch)) fail('REMEDIATION_AMBIGUOUS', `${remediation.id}/${remediation.branch}`);
    ids.add(remediation.id); branches.add(remediation.branch);
  }
  const matches = handoff.remediations.filter((remediation) => remediation.branch === branch);
  if (matches.length > 1 || (matches.length === 1 && handoff.operation.branch === branch)) fail('REMEDIATION_AMBIGUOUS', branch);
  const pending = handoff.remediations.filter((remediation) => remediation.closurePolicy?.stage === 'closure');
  if (pending.length > 1) fail('REMEDIATION_AMBIGUOUS', 'multiple pending remediation closures');
  if (pending.length === 1 && matches[0]?.id !== pending[0].id) fail('REMEDIATION_BRANCH_MISMATCH', `${branch}/${pending[0].branch}`);
  if (matches.length === 1) {
    const remediation = matches[0]; const policy = remediation.closurePolicy;
    if (!policy) return {
      closureType: 'NOT_APPLICABLE', branch, remediationId: remediation.id, remediationMode: remediation.mode,
      policyStage: remediation.stage ?? null, policyStatus: remediation.status ?? null, candidate: remediation.candidate ?? null,
    };
    return {
      closureType: policy.stage === 'closure' ? 'REMEDIATION_CLOSURE' : 'NOT_APPLICABLE',
      branch,
      remediationId: remediation.id,
      remediationMode: remediation.mode,
      policyStage: policy.stage,
      policyStatus: policy.status,
      requestAllowedPaths: [...policy.requestAllowedPaths],
      allowedPaths: [...policy.allowedPaths],
      candidate: policy.candidate,
      historicalBatchFallbackAllowed: false,
    };
  }
  if (branch === handoff.operation.branch && handoff.operation.stage === 'closure') return {
    closureType: 'BATCH_CLOSURE', branch, operationId: handoff.operation.id, activeBatchId: handoff.operation.activeBatchId,
  };
  return { closureType: 'NOT_APPLICABLE', branch, remediationId: null, remediationMode: null, policyStage: null, policyStatus: null };
}

export function validateRemediationScope(changedPaths, allowedPaths) {
  if (!Array.isArray(changedPaths) || !Array.isArray(allowedPaths) || allowedPaths.length === 0) fail('MAINTENANCE_SCOPE_MISMATCH', 'invalid scope inputs');
  const allowed = new Set(allowedPaths);
  const normalized = changedPaths.map((path) => String(path).replaceAll('\\', '/')).filter(Boolean);
  const rejected = normalized.filter((path) => !allowed.has(path));
  if (rejected.length > 0) fail('MAINTENANCE_SCOPE_MISMATCH', rejected.join(','));
  return { allowedPaths: [...allowedPaths], changedPaths: normalized, valid: true };
}

export function resolveGitHubReleasePublicationContext({ handoff }) {
  const operation = handoff?.operation;
  const release = handoff?.release;
  const base = {
    enabled: false,
    reason: 'NOT_APPLICABLE',
    operationKind: operation?.kind ?? null,
    operationStage: operation?.stage ?? null,
    releasePending: release?.pending === true,
    operationBranch: operation?.branch ?? null,
    tag: release?.tag ?? null,
    zipName: release?.zipName ?? null,
  };

  if (operation?.kind !== 'RELEASE_REMEDIATION') return { ...base, reason: 'OPERATION_KIND_NOT_RELEASE_REMEDIATION' };
  if (operation?.stage !== 'completed') return { ...base, reason: 'OPERATION_STAGE_NOT_COMPLETED' };
  if (release?.pending !== true) return { ...base, reason: 'RELEASE_NOT_PENDING' };

  const invalid = [];
  if (typeof operation.branch !== 'string' || !operation.branch.trim()) invalid.push('operation.branch');
  const candidate = handoff?.candidate;
  for (const field of ['sha', 'runId', 'artifactId', 'artifactName', 'artifactDigest']) {
    if (candidate?.[field] === undefined || candidate?.[field] === null || candidate?.[field] === '') invalid.push(`candidate.${field}`);
  }
  if (candidate?.sha !== undefined && !shaPattern.test(candidate.sha)) invalid.push('candidate.sha');
  if (candidate?.artifactDigest !== undefined && !digestPattern.test(candidate.artifactDigest)) invalid.push('candidate.artifactDigest');

  const closure = handoff?.closure;
  if (closure?.status !== 'COMPLETED') invalid.push('closure.status');
  for (const field of ['candidateSha', 'commitSha', 'runId', 'artifactId', 'artifactName', 'artifactDigest']) {
    if (closure?.[field] === undefined || closure?.[field] === null || closure?.[field] === '') invalid.push(`closure.${field}`);
  }
  if (candidate?.sha && closure?.candidateSha !== candidate.sha) invalid.push('closure.candidateSha');
  if (closure?.commitSha !== undefined && !shaPattern.test(closure.commitSha)) invalid.push('closure.commitSha');
  if (closure?.artifactDigest !== undefined && !digestPattern.test(closure.artifactDigest)) invalid.push('closure.artifactDigest');

  for (const field of ['tag', 'packageRevision', 'zipName', 'sidecarName']) {
    if (typeof release?.[field] !== 'string' || !release[field].trim()) invalid.push(`release.${field}`);
  }
  if (handoff?.productState?.convergenceAuthorized !== false) invalid.push('productState.convergenceAuthorized');
  if (invalid.length > 0) fail('RELEASE_PUBLICATION_AUTHORITY_INCOMPLETE', invalid.join(','));

  return { ...base, enabled: true, reason: 'COMPLETED_RELEASE_AUTHORITY' };
}

export function buildReleasePublicationAuthorization({ mainSha, tag, zipName, sidecarName }) {
  const values = { mainSha, tag, zipName, sidecarName };
  for (const [field, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.length === 0 || value !== value.trim() || /[\s|]/u.test(value)) fail('RELEASE_PUBLICATION_AUTHORIZATION_IDENTITY_INVALID', field);
  }
  if (!shaPattern.test(mainSha)) fail('RELEASE_PUBLICATION_AUTHORIZATION_IDENTITY_INVALID', 'mainSha');
  return `AUTHORIZE_FIN_SCOPE_RELEASE_PUBLICATION|main=${mainSha}|tag=${tag}|zip=${zipName}|sidecar=${sidecarName}`;
}

export function resolveGitHubReleasePublicationDispatchContext({
  handoff,
  eventName,
  refName,
  githubSha,
  checkedOutSha,
  expectedMainSha,
  authorizationText,
  tagExists,
}) {
  const publication = resolveGitHubReleasePublicationContext({ handoff });
  if (!publication.enabled) fail('RELEASE_PUBLICATION_NOT_AUTHORIZED', publication.reason);
  if (eventName !== 'workflow_dispatch') fail('RELEASE_PUBLICATION_EVENT_INVALID', String(eventName));
  if (refName !== 'main') fail('RELEASE_PUBLICATION_BRANCH_INVALID', String(refName));
  if (!shaPattern.test(githubSha ?? '')) fail('RELEASE_PUBLICATION_SHA_INVALID', 'GITHUB_SHA');
  if (checkedOutSha !== githubSha) fail('RELEASE_PUBLICATION_CHECKOUT_MISMATCH', `${checkedOutSha}/${githubSha}`);
  if (expectedMainSha !== githubSha) fail('RELEASE_PUBLICATION_EXPECTED_SHA_MISMATCH', `${expectedMainSha}/${githubSha}`);
  if (tagExists !== false) fail('RELEASE_PUBLICATION_TAG_ALREADY_EXISTS', handoff.release.tag);
  const canonicalAuthorization = buildReleasePublicationAuthorization({
    mainSha: githubSha,
    tag: handoff.release.tag,
    zipName: handoff.release.zipName,
    sidecarName: handoff.release.sidecarName,
  });
  if (authorizationText !== canonicalAuthorization) fail('RELEASE_PUBLICATION_AUTHORIZATION_MISMATCH');
  return {
    ...publication,
    reason: 'CANONICAL_WORKFLOW_DISPATCH_AUTHORIZED',
    eventName,
    refName,
    githubSha,
    checkedOutSha,
    expectedMainSha,
    canonicalAuthorization,
    tagExists: false,
  };
}

function validateGates(state) {
  for (const gate of requiredGates) if (state.phaseGate?.[gate] !== true) fail('GATE_AUTHORITY_MISMATCH', gate);
  if (state.phaseGate?.convergenceAuthorized !== false) fail('CONVERGENCE_UNEXPECTEDLY_AUTHORIZED');
}

function validateBaseline(baseline, expectedRole) {
  if (!baseline || baseline.role !== expectedRole) fail('BASELINE_ROLE_MISMATCH', `${baseline?.role ?? 'missing'}/${expectedRole}`);
  for (const field of ['tag', 'commitSha', 'zipName', 'sidecarName', 'zipSha256', 'root', 'specifyTreeSha256']) {
    if (typeof baseline[field] !== 'string' || !baseline[field].trim()) fail('BASELINE_ROLE_MISMATCH', `missing ${field}`);
  }
}

export function resolveGitHubContext({ branch, handoff, state, batches }) {
  if (typeof branch !== 'string' || !branch) fail('OPERATION_BRANCH_MISMATCH', 'branch missing');
  validateOperation(handoff.operation);
  validateGates(state);
  const operationMatched = branch === handoff.operation.branch;
  if (!Array.isArray(handoff.remediations)) fail('OPERATION_KIND_INVALID', 'missing remediations');
  for (const remediation of handoff.remediations) validateRemediation(remediation);
  const matchingRemediations = handoff.remediations.filter((remediation) => remediation.branch === branch);
  if (matchingRemediations.length > 1 || (matchingRemediations.length === 1 && operationMatched)) fail('OPERATION_BRANCH_MISMATCH', 'ambiguous special branches');
  const remediation = matchingRemediations[0] ?? null;

  let mode; let batchId; let batchAuthoritySource; let baseline; let baselineRole; let commands; let allowedPaths = [];
  if (remediation) {
    mode = remediation.mode;
    batchId = state.activeBatchId;
    batchAuthoritySource = 'IMPLEMENTATION_STATE';
    baselineRole = remediation.baselineRole;
    baseline = handoff.completedBaseline;
    commands = normalizedCommands(remediation.commands);
    allowedPaths = [...remediation.allowedPaths];
  } else if (operationMatched) {
    mode = handoff.operation.kind === 'RELEASE_REMEDIATION' ? 'RELEASE_REMEDIATION' : handoff.operation.stage === 'closure' ? 'BATCH_CLOSURE' : 'GH0_BOOTSTRAP';
    batchId = handoff.operation.activeBatchId;
    batchAuthoritySource = 'MATCHED_OPERATION';
    baselineRole = handoff.operation.baselineRole;
    baseline = handoff.baseline;
    commands = mode === 'BATCH_CLOSURE' ? [] : normalizedCommands(handoff.operation.qualificationCommands ?? batches[batchId]?.localValidation?.commands);
  } else {
    if (handoff.release?.pending === true) {
      fail('COMPLETED_RELEASE_PENDING', `${handoff.release.tag ?? 'missing-tag'}/${handoff.operation.stage}`);
    }
    mode = 'BATCH';
    batchId = state.activeBatchId;
    batchAuthoritySource = 'IMPLEMENTATION_STATE';
    baselineRole = 'CURRENT_COMPLETED_BASELINE';
    baseline = handoff.completedBaseline;
    commands = normalizedCommands(batches[batchId]?.localValidation?.commands);
  }

  const batch = batches[batchId];
  if (!batch) fail('BATCH_AUTHORITY_MISMATCH', batchId);
  if (batch.batchId !== batchId || state.batchStatus?.[batchId] !== batch.status) fail('BATCH_AUTHORITY_MISMATCH', batchId);
  if (batchAuthoritySource === 'IMPLEMENTATION_STATE') {
    if (state.activeBatchId !== state.nextAuthorizedBatchId) fail('BATCH_AUTHORITY_MISMATCH', `${state.activeBatchId}/${state.nextAuthorizedBatchId}`);
    if (state.completedBatchIds?.includes(batchId)) fail('COMPLETED_BATCH_SELECTED', batchId);
    if (batch.status !== 'PENDING') fail('ACTIVE_BATCH_NOT_PENDING', `${batchId}/${batch.status}`);
    for (const dependency of batch.externalDependencies ?? []) if (state.taskStatus?.[dependency] !== 'COMPLETED') fail('BATCH_AUTHORITY_MISMATCH', `dependency ${dependency}`);
  }
  validateBaseline(baseline, baselineRole);
  const canonical = remediation ? normalizedCommands(remediation.commands) : mode === 'RELEASE_REMEDIATION' ? normalizedCommands(handoff.operation.qualificationCommands) : mode === 'BATCH_CLOSURE' ? [] : normalizedCommands(batch.localValidation?.commands);
  if (mode !== 'BATCH_CLOSURE' && commands.length === 0) fail('DERIVED_COMMAND_SET_MISMATCH', 'empty command set');
  if (JSON.stringify(commands) !== JSON.stringify(canonical)) fail('DERIVED_COMMAND_SET_MISMATCH');
  return {
    mode, branch, operationMatched, operationKind: operationMatched ? handoff.operation.kind : null,
    remediationMatched: Boolean(remediation), remediationId: remediation?.id ?? null,
    remediationStage: remediation?.stage ?? null, remediationStatus: remediation?.status ?? null,
    allowedPaths,
    batchId, batchAuthoritySource, batchStatus: batch.status, baselineRole,
    baselineTag: baseline.tag, baselineCommitSha: baseline.commitSha, baselineZipName: baseline.zipName,
    baselineSidecarName: baseline.sidecarName, baselineZipSha256: baseline.zipSha256,
    baselineRoot: baseline.root, baselineSpecifyTreeSha256: baseline.specifyTreeSha256,
    convergenceAuthorized: state.phaseGate.convergenceAuthorized, commands,
  };
}

export async function loadAndResolveGitHubContext(projectRoot, branch) {
  const root = resolve(projectRoot);
  const [handoff, state] = await Promise.all([
    readFile(join(root, 'implementation-control/GITHUB_HANDOFF.json'), 'utf8').then(JSON.parse),
    readFile(join(root, 'implementation-control/IMPLEMENTATION_STATE.json'), 'utf8').then(JSON.parse),
  ]);
  const ids = new Set([state.activeBatchId, handoff.operation?.activeBatchId].filter(Boolean));
  const batches = {};
  for (const id of ids) batches[id] = JSON.parse(await readFile(join(root, `implementation-control/batches/${id}.json`), 'utf8'));
  return resolveGitHubContext({ branch, handoff, state, batches });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const branch = process.argv[2] ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME;
  if (process.argv.includes('--closure')) {
    const handoff = JSON.parse(await readFile(join(resolve(process.cwd()), 'implementation-control/GITHUB_HANDOFF.json'), 'utf8'));
    const context = resolveGitHubClosureContext({ branch, handoff });
    console.log(JSON.stringify(context, null, 2));
    process.exit(0);
  }
  if (process.argv.includes('--release-publication-dispatch')) {
    const handoff = JSON.parse(await readFile(join(resolve(process.cwd()), 'implementation-control/GITHUB_HANDOFF.json'), 'utf8'));
    const context = resolveGitHubReleasePublicationDispatchContext({
      handoff,
      eventName: process.env.GITHUB_EVENT_NAME,
      refName: process.env.GITHUB_REF_NAME,
      githubSha: process.env.GITHUB_SHA,
      checkedOutSha: process.env.CHECKED_OUT_SHA,
      expectedMainSha: process.env.EXPECTED_MAIN_SHA,
      authorizationText: process.env.AUTHORIZATION_TEXT,
      tagExists: process.env.TAG_EXISTS === 'false' ? false : process.env.TAG_EXISTS === 'true' ? true : undefined,
    });
    console.log(JSON.stringify(context, null, 2));
    process.exit(0);
  }
  if (process.argv.includes('--release-publication')) {
    const handoff = JSON.parse(await readFile(join(resolve(process.cwd()), 'implementation-control/GITHUB_HANDOFF.json'), 'utf8'));
    const context = resolveGitHubReleasePublicationContext({ handoff });
    console.log(JSON.stringify(context, null, 2));
    process.exit(0);
  }
  const context = await loadAndResolveGitHubContext(process.cwd(), branch);
  console.log(JSON.stringify({ ...context, derivedRequiredCommandCount: context.commands.filter(({ required }) => required).length, commandsExecuted: false }, null, 2));
}
