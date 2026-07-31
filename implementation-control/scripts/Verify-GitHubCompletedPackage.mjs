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
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const expected = handoff.release;
const expectedRoot = handoff.baseline.root.replace(/\/$/u, '');

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
function equal(actual, expectedValue, code) {
  assert(actual === expectedValue, code, JSON.stringify({ actual, expected: expectedValue }));
}
async function command(commandText, code, options = {}) {
  const result = await run(commandText, { cwd: root, ...options });
  assert(result.exitCode === 0, code, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').trim();
}
function countExtensions(paths) {
  const counts = {
    json: 0,
    markdown: 0,
    yaml: 0,
    typescript: 0,
    svelte: 0,
    powershell: 0,
    shell: 0,
  };
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

assert(zipPath && sidecarPath, 'USAGE', 'Verify-GitHubCompletedPackage.mjs <zip> <sidecar>');
equal(basename(zipPath), expected.zipName, 'COMPLETED_ZIP_NAME_MISMATCH');
equal(basename(sidecarPath), expected.sidecarName, 'COMPLETED_SIDECAR_NAME_MISMATCH');
const sidecar = (await readFile(sidecarPath, 'utf8')).trim();
const sidecarMatch = /^([0-9a-f]{64})  (.+)$/u.exec(sidecar);
assert(sidecarMatch, 'COMPLETED_SIDECAR_FORMAT_INVALID', sidecar);
equal(sidecarMatch[2], expected.zipName, 'COMPLETED_SIDECAR_BINDING_MISMATCH');
const zipSha256 = await shaFile(zipPath);
equal(zipSha256, sidecarMatch[1], 'COMPLETED_ZIP_SHA256_MISMATCH');

await command(`unzip -tqq "${zipPath}"`, 'COMPLETED_ZIP_CRC_FAILED');
const rawNames = (await command(`unzip -Z1 "${zipPath}"`, 'COMPLETED_ZIP_LIST_FAILED'))
  .split(/\r?\n/u)
  .filter(Boolean);
assert(rawNames.length > 0, 'COMPLETED_ZIP_EMPTY');
const exact = new Set();
for (const name of rawNames) {
  assert(!name.includes('\\'), 'COMPLETED_ZIP_BACKSLASH_PATH', name);
  assert(!exact.has(name), 'COMPLETED_ZIP_DUPLICATE_PATH', name);
  exact.add(name);
}
assertSafeArchivePaths(rawNames, expectedRoot);
const zipInfo = await command(`zipinfo -l "${zipPath}"`, 'COMPLETED_ZIP_INFO_FAILED');
assert(!zipInfo.split(/\r?\n/u).some((line) => /^l/u.test(line)), 'COMPLETED_ZIP_SYMLINK_PRESENT');

const work = await mkdtemp(join(tmpdir(), 'finscope-completed-package-'));
try {
  await command(`unzip -q "${zipPath}" -d "${work}"`, 'COMPLETED_ZIP_EXTRACTION_FAILED');
  const packageRoot = join(work, expectedRoot);
  const files = await listFiles(packageRoot);
  const paths = files.map((absolute) => posix(relative(packageRoot, absolute)));
  const pathSet = new Set(paths);
  assert(files.length > 0, 'COMPLETED_PACKAGE_EMPTY');
  assert(!paths.some((path) => /(^|\/)(?:node_modules|dist|coverage|playwright-report|test-results|\.wrangler|\.vite|\.finscope-evidence|\.finscope-release)(\/|$)/u.test(path)), 'COMPLETED_PACKAGE_REGENERABLE_DIRECTORY');
  assert(!paths.some((path) => /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|p12|pfx|key))$/iu.test(path) && !/\.env\.example$/iu.test(path)), 'COMPLETED_PACKAGE_SECRET_PATH');
  assert(!paths.some((path) => /(?:~|\.tmp|\.temp|\.bak|\.swp)$/iu.test(path) || /(?:^|\/)(?:\.DS_Store|Thumbs\.db)$/u.test(path)), 'COMPLETED_PACKAGE_TEMPORARY_FILE');
  equal(paths.filter((path) => path.toLocaleLowerCase('en-US').endsWith('.zip')).length, 0, 'COMPLETED_PACKAGE_NESTED_ZIP_COUNT');

  const manifestPath = join(packageRoot, 'FILE_MANIFEST.sha256');
  const inventoryPath = join(packageRoot, 'PACKAGE_INVENTORY.json');
  const metadataPath = join(packageRoot, 'PACKAGE_METADATA.json');
  const statePath = join(packageRoot, 'implementation-control/IMPLEMENTATION_STATE.json');
  const packageHandoffPath = join(packageRoot, 'implementation-control/GITHUB_HANDOFF.json');
  const phasePath = join(packageRoot, 'V0.21_PHASE_STATUS.md');
  const documentationIndexPath = join(packageRoot, 'DOCUMENTATION_INDEX.md');
  const lockPath = join(packageRoot, 'implementation-control/TASK_SOURCE_LOCK.json');
  const mapPath = join(packageRoot, 'implementation-control/IMPLEMENTATION_BATCH_MAP.json');
  const mapMarkdownPath = join(packageRoot, 'implementation-control/IMPLEMENTATION_BATCH_MAP.md');
  const authorityPath = join(packageRoot, 'implementation-control/AUTHORITY_MATRIX.json');
  const [metadata, state, packageHandoff, inventory, phaseStatus, documentationIndex, lock, batchMap, mapMarkdown, authority] = await Promise.all([
    readJson(metadataPath),
    readJson(statePath),
    readJson(packageHandoffPath),
    readJson(inventoryPath),
    readFile(phasePath, 'utf8'),
    readFile(documentationIndexPath, 'utf8'),
    readJson(lockPath),
    readJson(mapPath),
    readFile(mapMarkdownPath, 'utf8'),
    readJson(authorityPath),
  ]);

  const manifestLines = (await readFile(manifestPath, 'utf8')).trim().split(/\r?\n/u).filter(Boolean);
  const manifestPaths = new Set();
  for (const line of manifestLines) {
    const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
    assert(match, 'COMPLETED_MANIFEST_LINE_INVALID', line);
    assert(!manifestPaths.has(match[2]), 'COMPLETED_MANIFEST_DUPLICATE_PATH', match[2]);
    manifestPaths.add(match[2]);
    equal(await shaFile(join(packageRoot, match[2])), match[1], 'COMPLETED_MANIFEST_HASH_MISMATCH');
  }
  const expectedManifestPaths = paths.filter((path) => path !== 'PACKAGE_INVENTORY.json' && path !== 'FILE_MANIFEST.sha256');
  equal(manifestPaths.size, expectedManifestPaths.length, 'COMPLETED_MANIFEST_COUNT_MISMATCH');
  for (const path of expectedManifestPaths) assert(manifestPaths.has(path), 'COMPLETED_MANIFEST_PATH_MISSING', path);

  equal(inventory.packageVersion, expected.packageRevision, 'COMPLETED_INVENTORY_VERSION_MISMATCH');
  equal(inventory.root, expectedRoot, 'COMPLETED_INVENTORY_ROOT_MISMATCH');
  equal(inventory.itemCount, inventory.files?.length, 'COMPLETED_INVENTORY_ITEM_COUNT_MISMATCH');
  equal(inventory.files?.length, expectedManifestPaths.length, 'COMPLETED_INVENTORY_FILE_COUNT_MISMATCH');
  const inventoryPaths = new Set();
  for (const item of inventory.files ?? []) {
    assert(!inventoryPaths.has(item.path), 'COMPLETED_INVENTORY_DUPLICATE_PATH', item.path);
    inventoryPaths.add(item.path);
    assert(pathSet.has(item.path), 'COMPLETED_INVENTORY_UNKNOWN_PATH', item.path);
    equal((await stat(join(packageRoot, item.path))).size, item.sizeBytes, 'COMPLETED_INVENTORY_SIZE_MISMATCH');
    equal(await shaFile(join(packageRoot, item.path)), item.sha256, 'COMPLETED_INVENTORY_HASH_MISMATCH');
  }
  for (const path of expectedManifestPaths) assert(inventoryPaths.has(path), 'COMPLETED_INVENTORY_PATH_MISSING', path);

  const completedBatchId = handoff.operation.activeBatchId;
  const nextBatchId = handoff.operation.nextBatchId;
  const completedTask = handoff.operation.completedTasksThroughOnClosure;
  equal(metadata.packageVersion, expected.packageRevision, 'COMPLETED_METADATA_VERSION_MISMATCH');
  equal(metadata.packageRevision, expected.packageRevision, 'COMPLETED_METADATA_REVISION_MISMATCH');
  equal(metadata.logicalZipName, expected.zipName, 'COMPLETED_METADATA_ZIP_MISMATCH');
  equal(metadata.finalSha256Sidecar, expected.sidecarName, 'COMPLETED_METADATA_SIDECAR_MISMATCH');
  equal(metadata.rootDirectory, expectedRoot, 'COMPLETED_METADATA_ROOT_MISMATCH');
  equal(metadata.phase, `implementation_${completedBatchId}_completed`, 'COMPLETED_METADATA_PHASE_MISMATCH');
  equal(metadata.result, 'COMPLETED', 'COMPLETED_METADATA_RESULT_MISMATCH');
  equal(metadata.implementationReadiness, `${completedBatchId}_COMPLETED_${nextBatchId}_AUTHORIZED_PENDING`, 'COMPLETED_METADATA_READINESS_MISMATCH');
  equal(metadata.implementationState?.activeBatchId, nextBatchId, 'COMPLETED_METADATA_ACTIVE_BATCH_MISMATCH');
  equal(metadata.implementationState?.nextAuthorizedBatchId, nextBatchId, 'COMPLETED_METADATA_NEXT_BATCH_MISMATCH');
  equal(metadata.implementationState?.completedTasksThrough, completedTask, 'COMPLETED_METADATA_TASK_RANGE_MISMATCH');
  equal(metadata.sourceTasksSha256, state.sourceTasksSha256, 'COMPLETED_METADATA_SOURCE_TASKS_MISMATCH');
  equal(metadata.taskModel?.tasksSha256, state.sourceTasksSha256, 'COMPLETED_METADATA_TASK_MODEL_HASH_MISMATCH');
  equal(await shaFile(join(packageRoot, 'specs/001-fundamental-analysis-platform/tasks.md')), state.sourceTasksSha256, 'COMPLETED_TASKS_FILE_HASH_MISMATCH');

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
    singleArchiveRoot: true,
    zipEntrySeparator: '/',
    windowsLongPathRiskReduced: maximumRelativePath.length <= 220,
    absolutePathsPresent: false,
    pathTraversalEntriesPresent: false,
    duplicatePathsDetected: false,
    caseFoldCollisionsDetected: false,
    secretPatternsDetected: false,
    temporaryFilesDetected: false,
    regenerableDependencyDirectoriesDetected: false,
    embeddedArchiveCount: 0,
    finalManifestValid: true,
    finalInventoryValid: true,
    finalCrcValid: true,
    extractionValidated: true,
    finalZipSha256RecordedExternally: true,
  })) equal(metadata[field], value, `COMPLETED_METADATA_${field.toUpperCase()}_MISMATCH`);

  assert(Array.isArray(metadata.activeReports) && metadata.activeReports.length > 0, 'COMPLETED_METADATA_ACTIVE_REPORTS_EMPTY');
  for (const reportPath of metadata.activeReports) assert(pathSet.has(reportPath), 'COMPLETED_METADATA_ACTIVE_REPORT_MISSING', reportPath);
  for (const suffix of ['md', 'json']) assert(metadata.activeReports.includes(`implementation-control/reports/${completedBatchId}_EVIDENCE_VERIFICATION_AND_CLOSURE.${suffix}`), 'COMPLETED_METADATA_BATCH_REPORT_NOT_ACTIVE', suffix);
  equal(metadata.windowsExtractionPolicy?.mode, 'GITHUB_FIRST_COMPLETED_RELEASE', 'COMPLETED_METADATA_WINDOWS_MODE_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.releaseTag, expected.tag, 'COMPLETED_METADATA_WINDOWS_TAG_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.zipName, expected.zipName, 'COMPLETED_METADATA_WINDOWS_ZIP_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.sidecarName, expected.sidecarName, 'COMPLETED_METADATA_WINDOWS_SIDECAR_MISMATCH');
  equal(metadata.windowsExtractionPolicy?.sourceCodeAssetsForbidden, true, 'COMPLETED_METADATA_SOURCE_CODE_ASSET_POLICY_MISMATCH');

  equal(packageHandoff.operation?.stage, 'completed', 'COMPLETED_HANDOFF_STAGE_MISMATCH');
  equal(packageHandoff.release?.pending, false, 'COMPLETED_HANDOFF_RELEASE_PENDING_MISMATCH');
  equal(packageHandoff.release?.tag, expected.tag, 'COMPLETED_HANDOFF_TAG_MISMATCH');
  equal(packageHandoff.release?.packageRevision, expected.packageRevision, 'COMPLETED_HANDOFF_REVISION_MISMATCH');
  equal(lock.packageRevision, expected.packageRevision, 'COMPLETED_LOCK_REVISION_MISMATCH');
  equal(batchMap.packageRevision, expected.packageRevision, 'COMPLETED_MAP_REVISION_MISMATCH');
  equal(batchMap.mapId, `FinScope-${expected.packageRevision.replaceAll('_', '-')}-batch-map`, 'COMPLETED_MAP_ID_MISMATCH');
  assert(mapMarkdown.includes(`Revisión: \`${expected.packageRevision}\``), 'COMPLETED_MAP_MARKDOWN_REVISION_MISMATCH');
  equal(authority.packageRevision, expected.packageRevision, 'COMPLETED_AUTHORITY_REVISION_MISMATCH');
  equal(state.packageRevision, expected.packageRevision, 'COMPLETED_STATE_REVISION_MISMATCH');
  equal(state.activePackageLogicalName, expected.zipName, 'COMPLETED_STATE_ZIP_MISMATCH');
  equal(state.lastCompletedBatchId, completedBatchId, 'COMPLETED_STATE_LAST_BATCH_MISMATCH');
  equal(state.activeBatchId, nextBatchId, 'COMPLETED_STATE_ACTIVE_BATCH_MISMATCH');
  equal(state.nextAuthorizedBatchId, nextBatchId, 'COMPLETED_STATE_NEXT_BATCH_MISMATCH');
  equal(state.batchStatus?.[completedBatchId], 'COMPLETED', 'COMPLETED_STATE_BATCH_STATUS_MISMATCH');
  equal(state.taskStatus?.[completedTask], 'COMPLETED', 'COMPLETED_STATE_TASK_STATUS_MISMATCH');
  equal(state.phaseGate?.convergenceAuthorized, false, 'COMPLETED_STATE_CONVERGENCE_GATE_MISMATCH');

  assert(phaseStatus.includes(`Gate activo / ${completedBatchId} completado`), 'COMPLETED_PHASE_TITLE_MISMATCH');
  assert(phaseStatus.includes(`IMPLEMENTATION_BATCH_${completedBatchId}_COMPLETED_${nextBatchId}_PENDING`), 'COMPLETED_PHASE_STATUS_TOKEN_MISMATCH');
  for (const flag of ['tasksAuthorized=true', 'analysisAuthorized=true', 'implementationAuthorized=true', 'convergenceAuthorized=false']) assert(phaseStatus.includes(flag), 'COMPLETED_PHASE_GATE_MISMATCH', flag);
  assert(phaseStatus.includes(`B01–${completedBatchId}`) && phaseStatus.includes(`T001–${completedTask}`), 'COMPLETED_PHASE_RANGE_MISMATCH');
  assert(phaseStatus.includes(`activeBatchId=${nextBatchId}`) && phaseStatus.includes(`nextAuthorizedBatchId=${nextBatchId}`), 'COMPLETED_PHASE_ACTIVE_BATCH_MISMATCH');
  assert(documentationIndex.includes(expected.zipName), 'COMPLETED_DOCUMENTATION_ZIP_MISMATCH');
  assert(documentationIndex.includes(`B01–${completedBatchId}`) && documentationIndex.includes(`T001–${completedTask}`), 'COMPLETED_DOCUMENTATION_RANGE_MISMATCH');

  const specify = await canonicalTreeHash(join(packageRoot, '.specify'));
  equal(specify.count, 19, 'COMPLETED_SPECIFY_COUNT_MISMATCH');
  equal(specify.sha256, handoff.baseline.specifyTreeSha256, 'COMPLETED_SPECIFY_TREE_MISMATCH');
  const control = await run(`node implementation-control/scripts/Validate-ControlPlaneState.mjs "${packageRoot}"`, { cwd: root });
  await writeFile(join(work, 'control-plane.stdout.log'), control.stdout);
  await writeFile(join(work, 'control-plane.stderr.log'), control.stderr);
  assert(control.exitCode === 0, 'COMPLETED_CONTROL_PLANE_FAILED', control.stderr.toString('utf8'));
  const controlResult = JSON.parse(control.stdout.toString('utf8'));
  equal(controlResult.status, 'PASS', 'COMPLETED_CONTROL_PLANE_STATUS_MISMATCH');
  equal(controlResult.failCount, 0, 'COMPLETED_CONTROL_PLANE_FAILURES');

  console.log(JSON.stringify({
    schemaVersion: '1.0.0',
    result: 'PASS',
    tag: expected.tag,
    packageRevision: expected.packageRevision,
    zipName: expected.zipName,
    zipSha256,
    root: expectedRoot,
    fileCount: paths.length,
    inventoryItemCount: inventory.itemCount,
    manifestItemCount: manifestLines.length,
    extensionCounts,
    specify,
    activeBatchId: state.activeBatchId,
    nextAuthorizedBatchId: state.nextAuthorizedBatchId,
    convergenceAuthorized: false,
    controlPlaneChecks: controlResult.checkCount,
  }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
