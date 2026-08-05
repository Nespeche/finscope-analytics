import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertSafeArchivePaths,
  canonicalTreeHash,
  listFiles,
  posix,
  readJson,
  root,
  run,
  shaFile,
} from './GitHub-Common.mjs';

const zipPath = resolve(process.argv[2] ?? '');
const sidecarPath = resolve(process.argv[3] ?? '');
const sourceHandoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const expected = sourceHandoff.release;
const expectedRoot = sourceHandoff.baseline.root.replace(/\/$/u, '');
const INVENTORY_FIELDS = ['path', 'sizeBytes', 'sha256', 'mediaType', 'category', 'status'];
const PROHIBITED_PATH = /(^|\/)(?:node_modules|dist|coverage|playwright-report|test-results|\.wrangler|\.vite|\.finscope-evidence|\.finscope-release)(\/|$)/u;
const SECRET_PATH = /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|p12|pfx|key))$/iu;
const TEMP_PATH = /(?:~|\.tmp|\.temp|\.bak|\.swp)$/iu;

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
function equal(actual, expectedValue, code) {
  assert(actual === expectedValue, code, JSON.stringify({ actual, expected: expectedValue }));
}
function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}
async function command(commandText, code, options = {}) {
  const result = await run(commandText, { cwd: root, ...options });
  assert(result.exitCode === 0, code, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').trim();
}
async function trackedPaths() {
  const text = await command('git ls-files -z', 'COMPLETED_GIT_TRACKED_FILES_FAILED');
  const paths = text.split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b, 'en'));
  assert(paths.length > 0, 'COMPLETED_GIT_TRACKED_FILES_EMPTY');
  return paths;
}
function countExtensions(paths) {
  const counts = { json: 0, markdown: 0, yaml: 0, typescript: 0, svelte: 0, powershell: 0, shell: 0 };
  for (const path of paths) {
    const lower = path.toLocaleLowerCase('en-US');
    if (lower.endsWith('.json')) counts.json += 1;
    if (lower.endsWith('.md')) counts.markdown += 1;
    if (lower.endsWith('.yml') || lower.endsWith('.yaml')) counts.yaml += 1;
    if (lower.endsWith('.ts')) counts.typescript += 1;
    if (lower.endsWith('.svelte')) counts.svelte += 1;
    if (lower.endsWith('.ps1')) counts.powershell += 1;
    if (lower.endsWith('.sh')) counts.shell += 1;
  }
  return counts;
}
function expectedStatus(path) {
  return path.startsWith('.specify/') ? 'FROZEN' : 'ACTIVE';
}
function assertSorted(values, code) {
  const sorted = [...values].sort((a, b) => a.localeCompare(b, 'en'));
  assert(values.length === sorted.length && values.every((value, index) => value === sorted[index]), code);
}

assert(zipPath && sidecarPath, 'USAGE', 'Verify-GitHubCompletedPackage.mjs <zip> <sidecar>');
equal(basename(zipPath), expected.zipName, 'COMPLETED_ZIP_NAME_MISMATCH');
equal(basename(sidecarPath), expected.sidecarName, 'COMPLETED_SIDECAR_NAME_MISMATCH');
const sidecar = (await readFile(sidecarPath, 'utf8')).trim();
const sidecarMatch = /^([0-9a-f]{64})  (.+)$/u.exec(sidecar);
assert(sidecarMatch, 'COMPLETED_SIDECAR_FORMAT_INVALID', sidecar);
equal(sidecarMatch[2], expected.zipName, 'COMPLETED_SIDECAR_BINDING_MISMATCH');
const zipSha256 = await shaFile(zipPath);
equal(zipSha256, sidecarMatch[1], 'COMPLETED_ZIP_SHA256_MISMATCH');

await command(`unzip -tqq ${shellQuote(zipPath)}`, 'COMPLETED_ZIP_CRC_FAILED');
const rawNames = (await command(`unzip -Z1 ${shellQuote(zipPath)}`, 'COMPLETED_ZIP_LIST_FAILED')).split(/\r?\n/u).filter(Boolean);
assert(rawNames.length > 0, 'COMPLETED_ZIP_EMPTY');
const exact = new Set();
const folded = new Set();
const normalized = new Set();
for (const name of rawNames) {
  assert(!name.includes('\\'), 'COMPLETED_ZIP_BACKSLASH_PATH', name);
  assert(!exact.has(name), 'COMPLETED_ZIP_DUPLICATE_PATH', name);
  exact.add(name);
  const caseKey = name.toLocaleLowerCase('en-US');
  assert(!folded.has(caseKey), 'COMPLETED_ZIP_CASE_FOLD_COLLISION', name);
  folded.add(caseKey);
  const unicodeKey = name.normalize('NFC').toLocaleLowerCase('en-US');
  assert(!normalized.has(unicodeKey), 'COMPLETED_ZIP_UNICODE_COLLISION', name);
  normalized.add(unicodeKey);
}
assertSafeArchivePaths(rawNames, expectedRoot);
const zipInfo = await command(`zipinfo -l ${shellQuote(zipPath)}`, 'COMPLETED_ZIP_INFO_FAILED');
assert(!zipInfo.split(/\r?\n/u).some((line) => /^l[-rwx]{9}\s/u.test(line)), 'COMPLETED_ZIP_SYMLINK_PRESENT');

const work = await mkdtemp(join(tmpdir(), 'finscope-completed-package-'));
try {
  await command(`unzip -q ${shellQuote(zipPath)} -d ${shellQuote(work)}`, 'COMPLETED_ZIP_EXTRACTION_FAILED');
  const packageRoot = join(work, expectedRoot);
  const files = await listFiles(packageRoot);
  const paths = files.map((absolute) => posix(relative(packageRoot, absolute)));
  const pathSet = new Set(paths);
  assert(files.length > 0, 'COMPLETED_PACKAGE_EMPTY');
  assertSorted(paths, 'COMPLETED_PACKAGE_PATH_ORDER_MISMATCH');
  assert(!paths.some((path) => PROHIBITED_PATH.test(path)), 'COMPLETED_PACKAGE_REGENERABLE_DIRECTORY');
  assert(!paths.some((path) => SECRET_PATH.test(path) && !/\.env\.example$/iu.test(path)), 'COMPLETED_PACKAGE_SECRET_PATH');
  assert(!paths.some((path) => TEMP_PATH.test(path) || /(?:^|\/)(?:\.DS_Store|Thumbs\.db)$/u.test(path)), 'COMPLETED_PACKAGE_TEMPORARY_FILE');
  equal(paths.filter((path) => path.toLocaleLowerCase('en-US').endsWith('.zip')).length, 0, 'COMPLETED_PACKAGE_NESTED_ZIP_COUNT');

  const sourcePaths = await trackedPaths();
  equal(paths.length, sourcePaths.length, 'COMPLETED_GIT_TREE_FILE_COUNT_MISMATCH');
  for (let index = 0; index < sourcePaths.length; index += 1) equal(paths[index], sourcePaths[index], 'COMPLETED_GIT_TREE_PATH_MISMATCH');
  for (const path of sourcePaths) equal(await shaFile(join(packageRoot, path)), await shaFile(join(root, path)), 'COMPLETED_GIT_TREE_HASH_MISMATCH');
  const commitSha = await command('git rev-parse HEAD', 'COMPLETED_GIT_HEAD_LOOKUP_FAILED');
  assert(/^[0-9a-f]{40}$/u.test(commitSha), 'COMPLETED_GIT_HEAD_INVALID', commitSha);

  for (const path of paths.filter((path) => path.endsWith('.json'))) {
    try { JSON.parse(await readFile(join(packageRoot, path), 'utf8')); } catch (error) { throw new Error(`COMPLETED_JSON_INVALID:${path}:${String(error)}`); }
  }
  const yamlPaths = paths.filter((path) => /\.ya?ml$/iu.test(path));
  if (yamlPaths.length > 0) {
    const yamlList = join(work, 'yaml-paths.txt');
    await writeFile(yamlList, `${yamlPaths.map((path) => join(packageRoot, path)).join('\n')}\n`, 'utf8');
    await command(`ruby -e "require 'yaml'; ARGF.each_line { |p| YAML.safe_load_file(p.strip, permitted_classes: [], aliases: false) }" ${shellQuote(yamlList)}`, 'COMPLETED_YAML_INVALID');
  }

  const manifestPath = join(packageRoot, 'FILE_MANIFEST.sha256');
  const inventoryPath = join(packageRoot, 'PACKAGE_INVENTORY.json');
  const metadataPath = join(packageRoot, 'PACKAGE_METADATA.json');
  const statePath = join(packageRoot, 'implementation-control/IMPLEMENTATION_STATE.json');
  const packageHandoffPath = join(packageRoot, 'implementation-control/GITHUB_HANDOFF.json');
  const phasePath = join(packageRoot, 'V0.21_PHASE_STATUS.md');
  const documentationIndexPath = join(packageRoot, 'DOCUMENTATION_INDEX.md');
  const promptPath = join(packageRoot, 'PROMPT_IMPLEMENTACION_B21.md');
  const instructionPath = join(packageRoot, 'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt');
  const [metadata, state, packageHandoff, inventory, phaseStatus, documentationIndex, prompt, instructionText] = await Promise.all([
    readJson(metadataPath), readJson(statePath), readJson(packageHandoffPath), readJson(inventoryPath),
    readFile(phasePath, 'utf8'), readFile(documentationIndexPath, 'utf8'), readFile(promptPath, 'utf8'), readFile(instructionPath, 'utf8'),
  ]);

  const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/u).filter(Boolean);
  const expectedManifestPaths = paths.filter((path) => path !== 'PACKAGE_INVENTORY.json' && path !== 'FILE_MANIFEST.sha256');
  equal(manifestLines.length, expectedManifestPaths.length, 'COMPLETED_MANIFEST_COUNT_MISMATCH');
  const manifestPaths = [];
  for (let index = 0; index < manifestLines.length; index += 1) {
    const line = manifestLines[index];
    const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
    assert(match, 'COMPLETED_MANIFEST_LINE_INVALID', line);
    equal(match[2], expectedManifestPaths[index], 'COMPLETED_MANIFEST_ORDER_MISMATCH');
    manifestPaths.push(match[2]);
    equal(await shaFile(join(packageRoot, match[2])), match[1], 'COMPLETED_MANIFEST_HASH_MISMATCH');
  }
  assertSorted(manifestPaths, 'COMPLETED_MANIFEST_NOT_DETERMINISTIC');

  equal(inventory.packageVersion, expected.packageRevision, 'COMPLETED_INVENTORY_VERSION_MISMATCH');
  equal(inventory.generatedOn, metadata.generatedOn, 'COMPLETED_INVENTORY_GENERATED_ON_MISMATCH');
  equal(inventory.root, expectedRoot, 'COMPLETED_INVENTORY_ROOT_MISMATCH');
  equal(inventory.itemCount, inventory.files?.length, 'COMPLETED_INVENTORY_ITEM_COUNT_MISMATCH');
  equal(inventory.files?.length, expectedManifestPaths.length, 'COMPLETED_INVENTORY_FILE_COUNT_MISMATCH');
  const inventoryPaths = [];
  for (let index = 0; index < (inventory.files ?? []).length; index += 1) {
    const item = inventory.files[index];
    const expectedPath = expectedManifestPaths[index];
    equal(item.path, expectedPath, 'COMPLETED_INVENTORY_ORDER_MISMATCH');
    equal(JSON.stringify(Object.keys(item)), JSON.stringify(INVENTORY_FIELDS), 'COMPLETED_INVENTORY_FIELDS_MISMATCH');
    assert(!Object.hasOwn(item, 'size'), 'COMPLETED_INVENTORY_LEGACY_SIZE_PRESENT', item.path);
    assert(Number.isInteger(item.sizeBytes) && item.sizeBytes >= 0, 'COMPLETED_INVENTORY_SIZE_BYTES_INVALID', item.path);
    assert(/^[0-9a-f]{64}$/u.test(item.sha256), 'COMPLETED_INVENTORY_SHA256_INVALID', item.path);
    assert(typeof item.mediaType === 'string' && item.mediaType.length > 0, 'COMPLETED_INVENTORY_MEDIA_TYPE_INVALID', item.path);
    assert(typeof item.category === 'string' && item.category.length > 0, 'COMPLETED_INVENTORY_CATEGORY_INVALID', item.path);
    equal(item.status, expectedStatus(item.path), 'COMPLETED_INVENTORY_STATUS_INVALID');
    assert(pathSet.has(item.path), 'COMPLETED_INVENTORY_UNKNOWN_PATH', item.path);
    equal((await stat(join(packageRoot, item.path))).size, item.sizeBytes, 'COMPLETED_INVENTORY_SIZE_MISMATCH');
    equal(await shaFile(join(packageRoot, item.path)), item.sha256, 'COMPLETED_INVENTORY_HASH_MISMATCH');
    inventoryPaths.push(item.path);
  }
  assertSorted(inventoryPaths, 'COMPLETED_INVENTORY_NOT_DETERMINISTIC');

  const completedBatchId = packageHandoff.operation.activeBatchId;
  const nextBatchId = packageHandoff.operation.nextBatchId;
  const completedTask = packageHandoff.operation.completedTasksThroughOnClosure;
  equal(completedBatchId, 'B20', 'COMPLETED_OPERATION_BATCH_MISMATCH');
  equal(nextBatchId, 'B21', 'COMPLETED_OPERATION_NEXT_BATCH_MISMATCH');
  equal(completedTask, 'T089', 'COMPLETED_OPERATION_TASK_BOUNDARY_MISMATCH');
  equal(metadata.packageVersion, expected.packageRevision, 'COMPLETED_METADATA_VERSION_MISMATCH');
  equal(metadata.packageRevision, expected.packageRevision, 'COMPLETED_METADATA_REVISION_MISMATCH');
  equal(metadata.logicalZipName, expected.zipName, 'COMPLETED_METADATA_ZIP_MISMATCH');
  equal(metadata.finalSha256Sidecar, expected.sidecarName, 'COMPLETED_METADATA_SIDECAR_MISMATCH');
  equal(metadata.rootDirectory, expectedRoot, 'COMPLETED_METADATA_ROOT_MISMATCH');
  equal(metadata.phase, 'implementation_B20_completed_release_recovery', 'COMPLETED_METADATA_PHASE_MISMATCH');
  equal(metadata.result, 'CANDIDATE', 'COMPLETED_METADATA_RESULT_MISMATCH');
  equal(metadata.implementationReadiness, 'B20_COMPLETED_B21_BLOCKED_RELEASE_RECOVERY', 'COMPLETED_METADATA_READINESS_MISMATCH');
  equal(metadata.implementationState?.activeBatchId, nextBatchId, 'COMPLETED_METADATA_ACTIVE_BATCH_MISMATCH');
  equal(metadata.implementationState?.nextAuthorizedBatchId, nextBatchId, 'COMPLETED_METADATA_NEXT_BATCH_MISMATCH');
  equal(metadata.implementationState?.completedTasksThrough, completedTask, 'COMPLETED_METADATA_TASK_RANGE_MISMATCH');
  equal(metadata.implementationState?.blockedByReleaseRecoveryHold, true, 'COMPLETED_METADATA_HOLD_MISMATCH');
  equal(metadata.sourceBaseline?.sha256, sourceHandoff.baseline.zipSha256, 'COMPLETED_METADATA_SOURCE_BASELINE_MISMATCH');
  equal(metadata.sourceTasksSha256, state.sourceTasksSha256, 'COMPLETED_METADATA_SOURCE_TASKS_MISMATCH');
  equal(metadata.taskModel?.tasksSha256, state.sourceTasksSha256, 'COMPLETED_METADATA_TASK_MODEL_HASH_MISMATCH');
  equal(await shaFile(join(packageRoot, 'specs/001-fundamental-analysis-platform/tasks.md')), state.sourceTasksSha256, 'COMPLETED_TASKS_FILE_HASH_MISMATCH');
  equal(instructionText.length, metadata.projectConfigurationInstructionCharacterCount, 'COMPLETED_METADATA_INSTRUCTION_COUNT_MISMATCH');
  assert(instructionText.length <= 8000, 'COMPLETED_PROJECT_CONFIGURATION_TOO_LONG', String(instructionText.length));
  assert(instructionText.includes('Codex actúa como operador local/GitHub-first'), 'COMPLETED_PROJECT_CONFIGURATION_CODEX_MODEL_MISSING');
  assert(instructionText.includes('Gate extraordinario de recuperación de Release'), 'COMPLETED_PROJECT_CONFIGURATION_RELEASE_GATE_MISSING');

  const extensionCounts = countExtensions(paths);
  equal(metadata.finalFileCount, paths.length, 'COMPLETED_METADATA_FILE_COUNT_MISMATCH');
  equal(metadata.jsonDocumentCount, extensionCounts.json, 'COMPLETED_METADATA_JSON_COUNT_MISMATCH');
  equal(metadata.markdownDocumentCount, extensionCounts.markdown, 'COMPLETED_METADATA_MARKDOWN_COUNT_MISMATCH');
  equal(metadata.yamlDocumentCount, extensionCounts.yaml, 'COMPLETED_METADATA_YAML_COUNT_MISMATCH');
  equal(metadata.typescriptFileCount, extensionCounts.typescript, 'COMPLETED_METADATA_TYPESCRIPT_COUNT_MISMATCH');
  equal(metadata.svelteFileCount, extensionCounts.svelte, 'COMPLETED_METADATA_SVELTE_COUNT_MISMATCH');
  equal(metadata.powershellScriptCount, extensionCounts.powershell, 'COMPLETED_METADATA_POWERSHELL_COUNT_MISMATCH');
  equal(metadata.shellScriptCount, extensionCounts.shell, 'COMPLETED_METADATA_SHELL_COUNT_MISMATCH');
  const maximumRelativePath = [...paths].sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'))[0];
  equal(metadata.maximumRelativePathLength, maximumRelativePath.length, 'COMPLETED_METADATA_MAX_PATH_LENGTH_MISMATCH');
  equal(metadata.maximumRelativePath, maximumRelativePath, 'COMPLETED_METADATA_MAX_PATH_MISMATCH');
  for (const [field, value] of Object.entries({
    singleArchiveRoot: true, zipEntrySeparator: '/', windowsLongPathRiskReduced: maximumRelativePath.length <= 220,
    absolutePathsPresent: false, pathTraversalEntriesPresent: false, duplicatePathsDetected: false,
    caseFoldCollisionsDetected: false, secretPatternsDetected: false, temporaryFilesDetected: false,
    regenerableDependencyDirectoriesDetected: false, embeddedArchiveCount: 0, finalManifestValid: true,
    finalInventoryValid: true, finalCrcValid: true, extractionValidated: true, finalZipSha256RecordedExternally: true,
  })) equal(metadata[field], value, `COMPLETED_METADATA_${field.toUpperCase()}_MISMATCH`);

  assert(Array.isArray(metadata.activeReports) && metadata.activeReports.length > 0, 'COMPLETED_METADATA_ACTIVE_REPORTS_EMPTY');
  for (const reportPath of metadata.activeReports) assert(pathSet.has(reportPath), 'COMPLETED_METADATA_ACTIVE_REPORT_MISSING', reportPath);
  for (const suffix of ['md', 'json']) assert(metadata.activeReports.includes(`implementation-control/reports/B20_EVIDENCE_VERIFICATION_AND_CLOSURE.${suffix}`), 'COMPLETED_METADATA_BATCH_REPORT_NOT_ACTIVE', suffix);
  equal(metadata.windowsExtractionPolicy?.mode, 'GITHUB_FIRST_RELEASE_RECOVERY_CANDIDATE', 'COMPLETED_METADATA_WINDOWS_MODE_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.releaseTag, expected.tag, 'COMPLETED_METADATA_WINDOWS_TAG_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.zipName, expected.zipName, 'COMPLETED_METADATA_WINDOWS_ZIP_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.sidecarName, expected.sidecarName, 'COMPLETED_METADATA_WINDOWS_SIDECAR_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.sourceCodeAssetsForbidden, true, 'COMPLETED_METADATA_SOURCE_CODE_ASSET_POLICY_MISMATCH');

  equal(await shaFile(packageHandoffPath), await shaFile(join(root, 'implementation-control/GITHUB_HANDOFF.json')), 'COMPLETED_HANDOFF_SOURCE_MISMATCH');
  equal(packageHandoff.operation?.id, 'b20-post-restore-control-plane-hardening', 'COMPLETED_HANDOFF_OPERATION_MISMATCH');
  equal(packageHandoff.operation?.stage, 'candidate', 'COMPLETED_HANDOFF_STAGE_MISMATCH');
  equal(packageHandoff.candidate?.status, 'NOT_REQUESTED', 'COMPLETED_HANDOFF_CANDIDATE_STATUS_MISMATCH');
  equal(packageHandoff.closure?.status, 'NOT_AUTHORIZED', 'COMPLETED_HANDOFF_CLOSURE_STATUS_MISMATCH');
  equal(packageHandoff.release?.pending, true, 'COMPLETED_HANDOFF_RELEASE_PENDING_MISMATCH');
  equal(packageHandoff.release?.authorizationStatus, 'NOT_AUTHORIZED', 'COMPLETED_HANDOFF_RELEASE_AUTH_MISMATCH');
  equal(packageHandoff.remediation?.hold, true, 'COMPLETED_HANDOFF_HOLD_MISMATCH');
  equal(packageHandoff.productState?.completedTasksThrough, 'T089', 'COMPLETED_HANDOFF_TASK_BOUNDARY_MISMATCH');
  equal(packageHandoff.productState?.b21Executable, false, 'COMPLETED_HANDOFF_B21_EXECUTABLE_MISMATCH');
  assert(packageHandoff.rejectedPackages?.some((item) => item.sha256 === 'a906ec783e78a235a2b30a09bd40b061cbbd826479893247e1a76759908db55f' && item.disposition === 'REJECTED_NOT_PROMOTABLE' && item.reusableAsPassEvidence === false), 'COMPLETED_REJECTED_PACKAGE_DISPOSITION_MISSING');
  const allowed = new Set(packageHandoff.remediation?.allowedPaths ?? []);
  for (const path of packageHandoff.remediation?.closurePolicy?.allowedPaths ?? []) assert(allowed.has(path), 'COMPLETED_CLOSURE_PATH_NOT_IN_REMEDIATION_ALLOWLIST', path);

  equal(state.packageRevision, expected.packageRevision, 'COMPLETED_STATE_REVISION_MISMATCH');
  equal(state.activePackageLogicalName, expected.zipName, 'COMPLETED_STATE_ZIP_MISMATCH');
  equal(state.lastCompletedBatchId, 'B20', 'COMPLETED_STATE_LAST_BATCH_MISMATCH');
  equal(state.activeBatchId, 'B21', 'COMPLETED_STATE_ACTIVE_BATCH_MISMATCH');
  equal(state.nextAuthorizedBatchId, 'B21', 'COMPLETED_STATE_NEXT_BATCH_MISMATCH');
  equal(state.batchStatus?.B20, 'COMPLETED', 'COMPLETED_STATE_B20_STATUS_MISMATCH');
  equal(state.batchStatus?.B21, 'PENDING', 'COMPLETED_STATE_B21_STATUS_MISMATCH');
  equal(state.taskStatus?.T089, 'COMPLETED', 'COMPLETED_STATE_T089_STATUS_MISMATCH');
  assert(state.completedTaskIds?.includes('T089'), 'COMPLETED_STATE_T089_LIST_MISSING');
  equal(state.phaseGate?.tasksAuthorized, true, 'COMPLETED_STATE_TASK_GATE_MISMATCH');
  equal(state.phaseGate?.analysisAuthorized, true, 'COMPLETED_STATE_ANALYSIS_GATE_MISMATCH');
  equal(state.phaseGate?.implementationAuthorized, true, 'COMPLETED_STATE_IMPLEMENTATION_GATE_MISMATCH');
  equal(state.phaseGate?.convergenceAuthorized, false, 'COMPLETED_STATE_CONVERGENCE_GATE_MISMATCH');
  equal(state.sourceBaseline?.sha256, sourceHandoff.baseline.zipSha256, 'COMPLETED_STATE_SOURCE_BASELINE_MISMATCH');

  assert(phaseStatus.includes('Gate activo / B20 completado / Release recovery hold'), 'COMPLETED_PHASE_TITLE_MISMATCH');
  assert(phaseStatus.includes('IMPLEMENTATION_BATCH_B20_COMPLETED_B21_PENDING_RELEASE_RECOVERY_HOLD'), 'COMPLETED_PHASE_STATUS_TOKEN_MISMATCH');
  for (const flag of ['tasksAuthorized=true', 'analysisAuthorized=true', 'implementationAuthorized=true', 'convergenceAuthorized=false']) assert(phaseStatus.includes(flag), 'COMPLETED_PHASE_GATE_MISMATCH', flag);
  assert(phaseStatus.includes('B01–B20') && phaseStatus.includes('T001–T089'), 'COMPLETED_PHASE_RANGE_MISMATCH');
  assert(phaseStatus.includes('activeBatchId=B21') && phaseStatus.includes('nextAuthorizedBatchId=B21'), 'COMPLETED_PHASE_ACTIVE_BATCH_MISMATCH');
  assert(documentationIndex.includes(expected.zipName) && documentationIndex.includes(sourceHandoff.baseline.zipSha256), 'COMPLETED_DOCUMENTATION_BASELINE_MISMATCH');
  assert(documentationIndex.includes('B01–B20') && documentationIndex.includes('T001–T089'), 'COMPLETED_DOCUMENTATION_RANGE_MISMATCH');
  assert(prompt.includes('__B20_REMEDIATION_COMPLETED_COMMIT_PENDING_CLOSURE__'), 'COMPLETED_PROMPT_PENDING_COMMIT_MARKER_MISSING');
  assert(!/commit (?:final|completed)[^\n]*`[0-9a-f]{40}`/iu.test(prompt), 'COMPLETED_PROMPT_PREMATURE_COMMIT_SHA');

  const specify = await canonicalTreeHash(join(packageRoot, '.specify'));
  equal(specify.count, 19, 'COMPLETED_SPECIFY_COUNT_MISMATCH');
  equal(specify.sha256, sourceHandoff.baseline.specifyTreeSha256, 'COMPLETED_SPECIFY_TREE_MISMATCH');
  const control = await run(`node implementation-control/scripts/Validate-ControlPlaneState.mjs ${shellQuote(packageRoot)}`, { cwd: root });
  await writeFile(join(work, 'control-plane.stdout.log'), control.stdout);
  await writeFile(join(work, 'control-plane.stderr.log'), control.stderr);
  assert(control.exitCode === 0, 'COMPLETED_CONTROL_PLANE_FAILED', control.stderr.toString('utf8'));
  const controlResult = JSON.parse(control.stdout.toString('utf8'));
  equal(controlResult.status, 'PASS', 'COMPLETED_CONTROL_PLANE_STATUS_MISMATCH');
  equal(controlResult.failCount, 0, 'COMPLETED_CONTROL_PLANE_FAILURES');

  console.log(JSON.stringify({
    schemaVersion: '1.1.0', result: 'PASS', qualificationMode: 'REMEDIATION_CANDIDATE', promotable: false,
    replacesSources: false, b21Executable: false, tag: expected.tag, packageRevision: expected.packageRevision,
    zipName: expected.zipName, zipSha256, root: expectedRoot, commitSha, fileCount: paths.length,
    inventoryItemCount: inventory.itemCount, manifestItemCount: manifestLines.length, extensionCounts, specify,
    tasksSha256: state.sourceTasksSha256,
    batchHashes: {
      B20: await shaFile(join(packageRoot, 'implementation-control/batches/B20.json')),
      B21: await shaFile(join(packageRoot, 'implementation-control/batches/B21.json')),
    },
    activeBatchId: state.activeBatchId, nextAuthorizedBatchId: state.nextAuthorizedBatchId,
    completedTasksThrough: 'T089', convergenceAuthorized: false, controlPlaneChecks: controlResult.checkCount,
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
