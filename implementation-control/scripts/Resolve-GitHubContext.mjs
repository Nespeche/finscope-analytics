import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class ContextResolutionError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `:${detail}` : ''}`); this.code = code; }
}

const fail = (code, detail) => { throw new ContextResolutionError(code, detail); };
const requiredGates = ['tasksAuthorized', 'analysisAuthorized', 'implementationAuthorized'];
const operationStages = { BOOTSTRAP: ['candidate', 'closure'], RELEASE_REMEDIATION: ['candidate', 'closure', 'completed'] };

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
  const remediationMatched = branch === handoff.controlPlaneRemediation?.branch;
  if (remediationMatched && operationMatched) fail('OPERATION_BRANCH_MISMATCH', 'ambiguous special branches');

  let mode; let batchId; let batchAuthoritySource; let baseline; let baselineRole; let commands;
  if (remediationMatched) {
    if (handoff.controlPlaneRemediation?.mode !== 'CONTROL_PLANE_REMEDIATION') fail('OPERATION_KIND_INVALID', 'invalid remediation mode');
    mode = 'CONTROL_PLANE_REMEDIATION';
    batchId = state.activeBatchId;
    batchAuthoritySource = 'IMPLEMENTATION_STATE';
    baselineRole = 'CURRENT_COMPLETED_BASELINE';
    baseline = handoff.completedBaseline;
    commands = normalizedCommands(handoff.controlPlaneRemediation.commands);
    if (!commands.length) fail('DERIVED_COMMAND_SET_MISMATCH', 'empty remediation commands');
  } else if (operationMatched) {
    mode = handoff.operation.kind === 'RELEASE_REMEDIATION' ? 'RELEASE_REMEDIATION' : handoff.operation.stage === 'closure' ? 'BATCH_CLOSURE' : 'GH0_BOOTSTRAP';
    batchId = handoff.operation.activeBatchId;
    batchAuthoritySource = 'MATCHED_OPERATION';
    baselineRole = handoff.operation.baselineRole;
    baseline = handoff.baseline;
    commands = mode === 'BATCH_CLOSURE' ? [] : normalizedCommands(handoff.operation.qualificationCommands ?? batches[batchId]?.localValidation?.commands);
  } else {
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
  const canonical = mode === 'CONTROL_PLANE_REMEDIATION' ? normalizedCommands(handoff.controlPlaneRemediation.commands) : mode === 'RELEASE_REMEDIATION' ? normalizedCommands(handoff.operation.qualificationCommands) : mode === 'BATCH_CLOSURE' ? [] : normalizedCommands(batch.localValidation?.commands);
  if (mode !== 'BATCH_CLOSURE' && commands.length === 0) fail('DERIVED_COMMAND_SET_MISMATCH', 'empty command set');
  if (JSON.stringify(commands) !== JSON.stringify(canonical)) fail('DERIVED_COMMAND_SET_MISMATCH');
  return {
    mode, branch, operationMatched, operationKind: operationMatched ? handoff.operation.kind : null,
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
  const context = await loadAndResolveGitHubContext(process.cwd(), branch);
  console.log(JSON.stringify({ ...context, derivedRequiredCommandCount: context.commands.filter(({ required }) => required).length, commandsExecuted: false }, null, 2));
}
