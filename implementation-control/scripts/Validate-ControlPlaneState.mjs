import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const checks = [];
const issues = [];
const posix = (value) => value.split(sep).join('/');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readBytes = (path) => readFile(join(root, path));
const readText = async (path) => (await readBytes(path)).toString('utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const isCommit = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v) => b.includes(v));

function check(id, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ id, status, detail });
  if (!condition) issues.push({ id, detail });
}
async function exists(path) { try { await stat(join(root, path)); return true; } catch { return false; } }
async function listFiles(directory) {
  const absoluteRoot = join(root, directory);
  const out = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) out.push(absolute);
    }
  }
  await visit(absoluteRoot);
  return out.sort((a, b) => posix(relative(absoluteRoot, a)).localeCompare(posix(relative(absoluteRoot, b)), 'en'));
}
async function canonicalTreeHash(directory) {
  const absoluteRoot = join(root, directory);
  const chunks = [];
  const files = await listFiles(directory);
  for (const file of files) {
    const rel = posix(relative(absoluteRoot, file));
    const digest = createHash('sha256').update(await readFile(file)).digest();
    chunks.push(Buffer.from(rel, 'utf8'), Buffer.from([0]), digest, Buffer.from([10]));
  }
  return { count: files.length, sha256: sha(Buffer.concat(chunks)) };
}
function parseGates(text) {
  const names = ['specificationAuthorized','clarificationAuthorized','planAuthorized','checklistAuthorized','tasksAuthorized','analysisAuthorized','implementationAuthorized','convergenceAuthorized'];
  return Object.fromEntries(names.map((name) => {
    const match = text.match(new RegExp(`^${name}=(true|false)$`, 'mu'));
    return [name, match?.[1] === 'true'];
  }));
}

try {
  const [lock, state, operation, baseline, matrix, phase, instructions, batchMap, releaseWorkflow, prWorkflow, packageScript] = await Promise.all([
    readJson('implementation-control/TASK_SOURCE_LOCK.json'),
    readJson('implementation-control/IMPLEMENTATION_STATE.json'),
    readJson('implementation-control/OPERATION.json'),
    readJson('implementation-control/BASELINE_LOCK.json'),
    readJson('implementation-control/AUTHORITY_MATRIX.json'),
    readText('V0.21_PHASE_STATUS.md'),
    readText('implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt'),
    readJson('implementation-control/IMPLEMENTATION_BATCH_MAP.json'),
    readText('.github/workflows/sdd-release.yml'),
    readText('.github/workflows/sdd-pr-validation.yml'),
    readText('implementation-control/scripts/package_release.py'),
  ]);

  for (const path of [
    '.specify/memory/constitution.md',
    'specs/001-fundamental-analysis-platform/spec.md',
    'specs/001-fundamental-analysis-platform/tasks.md',
    'specs/001-fundamental-analysis-platform/governance/authority-crosswalk.json',
    'implementation-control/TASK_SOURCE_LOCK.json',
    'implementation-control/IMPLEMENTATION_STATE.json',
    'implementation-control/OPERATION.json',
    'implementation-control/BASELINE_LOCK.json',
    'implementation-control/AUTHORITY_MATRIX.json',
    'V0.21_PHASE_STATUS.md',
  ]) check(`REQUIRED_${path.replace(/[^A-Za-z0-9]+/gu, '_').toUpperCase()}`, await exists(path), path);

  check('LEGACY_HANDOFF_REMOVED', !(await exists('implementation-control/GITHUB_HANDOFF.json')), 'GITHUB_HANDOFF.json');
  for (const name of [
    'finscope-closure-validation.yml','finscope-completed-release.yml','finscope-pr-validation.yml',
    'finscope-release-qualification.yml','finscope-remediation-closure-request.yml','finscope-remediation-materialize-derived.yml',
  ]) check(`LEGACY_WORKFLOW_${name.replace(/[^A-Za-z0-9]+/gu, '_').toUpperCase()}`, !(await exists(`.github/workflows/${name}`)), name);
  check('SDD_PR_WORKFLOW_PRESENT', await exists('.github/workflows/sdd-pr-validation.yml'), 'sdd-pr-validation.yml');
  check('SDD_RELEASE_WORKFLOW_PRESENT', await exists('.github/workflows/sdd-release.yml'), 'sdd-release.yml');
  for (const name of ['PACKAGE_METADATA.json','PACKAGE_INVENTORY.json','FILE_MANIFEST.sha256']) {
    check(`DERIVED_NOT_VERSIONED_${name.replace(/[^A-Za-z0-9]+/gu, '_')}`, !(await exists(name)), name);
  }

  const gates = parseGates(phase);
  for (const name of ['specificationAuthorized','clarificationAuthorized','planAuthorized','checklistAuthorized','tasksAuthorized','analysisAuthorized','implementationAuthorized']) {
    check(`GATE_${name}`, gates[name] === true, `${name}=${gates[name]}`);
  }
  check('GATE_convergenceAuthorized', gates.convergenceAuthorized === false, `convergenceAuthorized=${gates.convergenceAuthorized}`);
  check('GATE_ANCHOR', phase.includes('<a id="gate"></a>'), 'explicit #gate anchor');
  check('STATE_HAS_NO_GATE_MIRROR', !Object.hasOwn(state, 'phaseGate'), 'phaseGate must not be mirrored in state');

  const instructionChars = [...instructions].length;
  check('INSTRUCTIONS_LIMIT', instructionChars <= 8000, `characters=${instructionChars}`);
  check('INSTRUCTIONS_SAFETY_MARGIN', instructionChars <= 7600, `characters=${instructionChars}; margin=${8000 - instructionChars}`);
  check('INSTRUCTIONS_UTF8', !instructions.includes('\uFFFD'), `bytes=${Buffer.byteLength(instructions, 'utf8')}`);
  check('NO_PR_BODY_AUTHORITY', /PR bodies.*no son autoridad|PR body.*no es autoridad/iu.test(instructions), 'PR body excluded');
  check('NO_CLOSURE_COMMIT_POLICY', /No crear un commit separado de cierre/iu.test(instructions), 'closure commit prohibited');
  check('OPERATION_DECLARATION_POLICY', /declaración inmutable|declaración de operación/iu.test(instructions), 'operation is declaration');

  const tasksPath = 'specs/001-fundamental-analysis-platform/tasks.md';
  const tasksHash = sha(await readBytes(tasksPath));
  check('TASKS_HASH_LOCK', tasksHash === lock.tasksFileSha256, `${tasksHash}/${lock.tasksFileSha256}`);
  check('TASKS_HASH_STATE', tasksHash === state.sourceTasksSha256, `${tasksHash}/${state.sourceTasksSha256}`);
  check('TASKS_HASH_INPUT', tasksHash === baseline.operationInput.tasksSha256, `${tasksHash}/${baseline.operationInput.tasksSha256}`);
  check('TASK_COUNT_LOCK', lock.taskCount === 109 && lock.tasks.length === 109, `${lock.taskCount}/${lock.tasks.length}`);
  check('BATCH_COUNT_LOCK', lock.batchCount === 25 && lock.batches.length === 25, `${lock.batchCount}/${lock.batches.length}`);
  check('BATCH_MAP_COUNT', batchMap.taskCount === 109 && batchMap.batchCount === 25, `${batchMap.taskCount}/${batchMap.batchCount}`);

  const seenTasks = [];
  const batchIds = [];
  const batchDocuments = new Map();
  for (const file of (await readdir(join(root, 'implementation-control/batches'))).filter((name) => /^B\d{2}\.json$/u.test(name)).sort()) {
    const path = `implementation-control/batches/${file}`;
    const batch = await readJson(path);
    const expectedId = file.slice(0, -5);
    batchDocuments.set(expectedId, { batch, path, sha256: sha(await readBytes(path)) });
    batchIds.push(batch.batchId);
    check(`BATCH_ID_${expectedId}`, batch.batchId === expectedId, `${batch.batchId}/${expectedId}`);
    check(`BATCH_TASK_COUNT_${expectedId}`, batch.taskCount === batch.tasks.length && batch.taskCount === batch.executionOrder.length, `${batch.taskCount}/${batch.tasks.length}/${batch.executionOrder.length}`);
    check(`BATCH_ORDER_${expectedId}`, JSON.stringify(batch.executionOrder) === JSON.stringify(batch.tasks.map(({ id }) => id)), batch.executionOrder.join(','));
    check(`BATCH_SOURCE_HASH_${expectedId}`, batch.sourceTasksSha256 === tasksHash, batch.sourceTasksSha256);
    check(`BATCH_STATUS_${expectedId}`, state.batchStatus[expectedId] === batch.status, `${state.batchStatus[expectedId]}/${batch.status}`);
    for (const task of batch.tasks) {
      seenTasks.push(task.id);
      const lockTask = lock.tasks.find(({ taskId }) => taskId === task.id);
      check(`TASK_LOCK_${task.id}`, Boolean(lockTask) && lockTask.sourceTaskSha256 === task.sourceTaskSha256, `${task.sourceTaskSha256}/${lockTask?.sourceTaskSha256}`);
      check(`TASK_STATE_${task.id}`, typeof state.taskStatus[task.id] === 'string', `${task.id}=${state.taskStatus[task.id]}`);
      for (const dependency of task.dependencies ?? []) check(`TASK_DEPENDENCY_${task.id}_${dependency}`, lock.tasks.some(({ taskId }) => taskId === dependency), `${task.id}->${dependency}`);
    }
  }

  const stateTaskIds = Object.keys(state.taskStatus).sort();
  const stateBatchIds = Object.keys(state.batchStatus).sort();
  const completedTasksFromMap = stateTaskIds.filter((id) => state.taskStatus[id] === 'COMPLETED');
  const completedBatchesFromMap = stateBatchIds.filter((id) => state.batchStatus[id] === 'COMPLETED');
  check('BATCH_FILE_COUNT', batchIds.length === 25 && new Set(batchIds).size === 25, `count=${batchIds.length}`);
  check('TASK_MIRROR_MISMATCH', seenTasks.length === 109 && new Set(seenTasks).size === 109 && sameSet(seenTasks, lock.tasks.map(({ taskId }) => taskId)), `count=${seenTasks.length}`);
  check('STATE_TASK_KEYS', sameSet(stateTaskIds, lock.tasks.map(({ taskId }) => taskId)), `count=${stateTaskIds.length}`);
  check('STATE_BATCH_KEYS', sameSet(stateBatchIds, batchIds), `count=${stateBatchIds.length}`);
  check('COMPLETED_TASK_SET', sameSet(state.completedTaskIds, completedTasksFromMap), `${state.completedTaskIds.length}/${completedTasksFromMap.length}`);
  check('COMPLETED_BATCH_SET', sameSet(state.completedBatchIds, completedBatchesFromMap), `${state.completedBatchIds.length}/${completedBatchesFromMap.length}`);
  check('BLOCKED_TASK_SET', state.blockedTaskIds.every((id) => ['PENDING','BLOCKED'].includes(state.taskStatus[id])), state.blockedTaskIds.join(','));
  check('BLOCKED_BATCH_SET', state.blockedBatchIds.every((id) => ['PENDING','BLOCKED'].includes(state.batchStatus[id])), state.blockedBatchIds.join(','));
  check('LAST_COMPLETED_BATCH', state.lastCompletedBatchId === null || state.completedBatchIds.includes(state.lastCompletedBatchId), String(state.lastCompletedBatchId));
  check('ACTIVE_BATCH_EXISTS', state.activeBatchId === null || stateBatchIds.includes(state.activeBatchId), String(state.activeBatchId));
  check('NEXT_AUTHORIZED_MATCHES_ACTIVE', state.nextAuthorizedBatchId === state.activeBatchId, `${state.nextAuthorizedBatchId}/${state.activeBatchId}`);

  check('OPERATION_NO_REPO_LIFECYCLE_STATE', !Object.hasOwn(operation, 'status'), 'status must live in GitHub');
  check('OPERATION_LIFECYCLE_AUTHORITY', operation.lifecycleAuthority === 'GITHUB_COMMITS_CHECKS_ARTIFACTS_MERGE_RELEASE', operation.lifecycleAuthority);
  check('OPERATION_REPOSITORY', operation.repository === baseline.repository, `${operation.repository}/${baseline.repository}`);
  check('OPERATION_BASE_SHA', isCommit(operation.base.expectedSha) && operation.base.expectedSha === baseline.expectedGitHubBase.mainSha, `${operation.base.expectedSha}/${baseline.expectedGitHubBase.mainSha}`);
  check('OPERATION_BASE_BRANCH', operation.base.branch === baseline.expectedGitHubBase.branch, `${operation.base.branch}/${baseline.expectedGitHubBase.branch}`);
  check('OPERATION_SCOPE', operation.scope.mode === 'CLOSED_ALLOWLIST' && operation.scope.allowedPaths.length > 0, `${operation.scope.allowedPaths.length}`);
  check('OPERATION_FORBIDS_SPECIFY', operation.scope.forbiddenPaths.includes('.specify/**'), operation.scope.forbiddenPaths.join(','));
  check('OPERATION_COMMANDS_REQUIRED', operation.commands.length >= 1 && operation.commands.every(({ required }) => required === true), `${operation.commands.length}`);
  check('OPERATION_COMMAND_IDS_UNIQUE', new Set(operation.commands.map(({ id }) => id)).size === operation.commands.length, operation.commands.map(({ id }) => id).join(','));
  check('EVIDENCE_EXTERNAL', operation.evidencePolicy.repositoryStoresRunIds === false && operation.evidencePolicy.repositoryStoresArtifactIds === false, JSON.stringify(operation.evidencePolicy));
  check('SAME_SHA_RERUN_POLICY', operation.evidencePolicy.rerunSameShaAllowedOnlyFor === 'ENVIRONMENT_BLOCKED' && operation.evidencePolicy.deterministicFailureRequiresNewCommit === true, JSON.stringify(operation.evidencePolicy));

  if (operation.type === 'GOVERNANCE_MIGRATION') {
    check('MIGRATION_OPERATION_ID', operation.operationId === 'sdd2-governance-migration', operation.operationId);
    check('MIGRATION_BRANCH', operation.branch === 'governance/sdd2-professionalization', operation.branch);
    check('MIGRATION_HOLD', state.implementationStatus === 'BLOCKED' && state.blockedBatchIds.includes(state.activeBatchId), `${state.implementationStatus}/${state.blockedBatchIds.join(',')}`);
    check('MIGRATION_FINDING', state.openFindings.some(({ id, status }) => id === 'SDD2-MIGRATION-REQUIRED' && status === 'OPEN'), JSON.stringify(state.openFindings));
    check('MIGRATION_NO_BATCH_BINDING', !Object.hasOwn(operation, 'batch'), 'governance operation has no batch binding');
  } else if (operation.type === 'BATCH_IMPLEMENTATION') {
    const binding = operation.batch;
    const batchRecord = binding ? batchDocuments.get(binding.batchId) : null;
    check('BATCH_OPERATION_BINDING_PRESENT', Boolean(binding), JSON.stringify(binding));
    check('BATCH_OPERATION_ACTIVE', Boolean(binding) && binding.batchId === state.activeBatchId && binding.batchId === state.nextAuthorizedBatchId, `${binding?.batchId}/${state.activeBatchId}/${state.nextAuthorizedBatchId}`);
    check('BATCH_OPERATION_NOT_BLOCKED', Boolean(binding) && !state.blockedBatchIds.includes(binding.batchId), state.blockedBatchIds.join(','));
    check('BATCH_OPERATION_STATE', ['READY','IN_PROGRESS','LOCAL_VALIDATION_REQUIRED'].includes(state.implementationStatus), state.implementationStatus);
    check('BATCH_OPERATION_DOCUMENT', Boolean(batchRecord), binding?.batchId ?? 'missing');
    check('BATCH_OPERATION_TASKS', Boolean(batchRecord) && JSON.stringify(binding.taskIds) === JSON.stringify(batchRecord.batch.executionOrder), JSON.stringify(binding?.taskIds));
    check('BATCH_OPERATION_HASH', Boolean(batchRecord) && binding.batchFileSha256 === batchRecord.sha256, `${binding?.batchFileSha256}/${batchRecord?.sha256}`);
  }

  check('INPUT_BASELINE_HASH', isSha256(baseline.operationInput.zipSha256), baseline.operationInput.zipSha256);
  check('INPUT_BASELINE_COMMIT', isCommit(baseline.operationInput.commitSha), baseline.operationInput.commitSha);
  check('EXPECTED_MAIN_COMMIT', isCommit(baseline.expectedGitHubBase.mainSha), baseline.expectedGitHubBase.mainSha);
  check('TRANSPORT_ALIAS_POLICY', baseline.transportIdentity.physicalSuffixesIgnored === true && baseline.transportIdentity.physicalFilenameEqualityRequired === false, JSON.stringify(baseline.transportIdentity));
  check('BASELINE_SEMANTICS', /input to the current operation|entrada de la operación/iu.test(baseline.semantics), baseline.semantics);

  const specify = await canonicalTreeHash('.specify');
  check('SPECIFY_FILE_COUNT', specify.count === 19, `count=${specify.count}`);
  check('SPECIFY_STATE_HASH', specify.sha256 === state.specifyTreeSha256, `${specify.sha256}/${state.specifyTreeSha256}`);
  check('SPECIFY_INPUT_HASH', specify.sha256 === baseline.operationInput.specifyTreeSha256, `${specify.sha256}/${baseline.operationInput.specifyTreeSha256}`);

  const authorityIds = matrix.fieldAuthorities.map(({ fieldId }) => fieldId);
  check('AUTHORITY_UNIQUE', new Set(authorityIds).size === authorityIds.length, authorityIds.join(','));
  for (const required of ['constitutional_rules','phase_gate_flags','product_requirements','product_behavior','task_definition','implementation_state','active_operation','operation_input_baseline','package_identity','github_evidence']) {
    check(`AUTHORITY_${required.toUpperCase()}`, authorityIds.includes(required), required);
  }
  check('AUTHORITY_FIELD_SCOPED', matrix.conflictProcedure.mode === 'FIELD_SCOPED_FAIL_CLOSED', matrix.conflictProcedure.mode);

  check('PR_WORKFLOW_SCOPE_BINDING', prWorkflow.includes('Check-OperationScope.mjs . --mode pr'), 'PR scope mode');
  check('RELEASE_WORKFLOW_SCOPE_BINDING', releaseWorkflow.includes('Check-OperationScope.mjs . --mode release'), 'Release scope mode');
  check('RELEASE_MANUAL_ONLY', /workflow_dispatch:/u.test(releaseWorkflow) && !/^\s+push:/mu.test(releaseWorkflow), 'manual dispatch only');
  check('RELEASE_CLEAN_TREE', releaseWorkflow.includes('git diff --exit-code') && releaseWorkflow.includes('git diff --cached --exit-code'), 'tracked tree clean before package');
  check('PACKAGE_SCRIPT_DYNAMIC_STATE', !/completedBoundary[^\n]*B20|FS_v0\.21\.25_B20_completed/u.test(packageScript), 'no hardcoded B20 package state');

  const result = {
    schemaVersion: '2.0.0', generatedAt: new Date().toISOString(),
    status: issues.length === 0 ? 'PASS' : 'FAIL', checkCount: checks.length,
    passCount: checks.filter(({ status }) => status === 'PASS').length,
    failCount: issues.length, taskCount: seenTasks.length, batchCount: batchIds.length,
    specifyTreeSha256: specify.sha256, sourceTasksSha256: tasksHash,
    activeOperationId: operation.operationId, checks, issues,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (issues.length === 0) process.stderr.write(`CONTROL_PLANE_STATE_VALID ${checks.length}/${checks.length}\n`);
  else { process.stderr.write(`CONTROL_PLANE_STATE_INVALID ${issues.length}/${checks.length}\n`); process.exitCode = 1; }
} catch (error) {
  const result = {
    schemaVersion: '2.0.0', generatedAt: new Date().toISOString(), status: 'FAIL',
    checkCount: checks.length, passCount: checks.filter(({ status }) => status === 'PASS').length,
    failCount: issues.length + 1, taskCount: 0, batchCount: 0, checks,
    issues: [...issues, { id: 'UNHANDLED', detail: error instanceof Error ? error.stack ?? error.message : String(error) }],
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.stderr.write('CONTROL_PLANE_STATE_INVALID UNHANDLED\n');
  process.exitCode = 1;
}
