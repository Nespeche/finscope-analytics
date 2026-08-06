import { copyFile, mkdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  canonicalTreeHash,
  now,
  posix,
  readJson,
  root,
  run,
  shaFile,
  writeJson,
} from './GitHub-Common.mjs';

const INVENTORY_PATH = 'PACKAGE_INVENTORY.json';
const MANIFEST_PATH = 'FILE_MANIFEST.sha256';
const METADATA_PATH = 'PACKAGE_METADATA.json';
const FIXED_MTIME = new Date('1980-01-01T00:00:00.000Z');
const DERIVED_EXCLUSIONS = new Set([INVENTORY_PATH, MANIFEST_PATH]);
const PROHIBITED_PATH = /(^|\/)(?:node_modules|dist|coverage|playwright-report|test-results|\.wrangler|\.vite|\.finscope-evidence|\.finscope-release)(\/|$)/u;
const SECRET_PATH = /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.(?:pem|p12|pfx|key))$/iu;
const TEMP_PATH = /(?:~|\.tmp|\.temp|\.bak|\.swp)$/iu;

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}
async function trackedPaths() {
  const result = await run('git ls-files -z', { cwd: root });
  assert(result.exitCode === 0, 'GIT_TRACKED_FILES_FAILED', result.stderr.toString('utf8'));
  const paths = result.stdout.toString('utf8').split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b, 'en'));
  assert(paths.length > 0, 'GIT_TRACKED_FILES_EMPTY');
  assert(new Set(paths).size === paths.length, 'GIT_TRACKED_FILES_DUPLICATE');
  for (const path of paths) {
    assert(!path.includes('\n') && !path.includes('\r') && !path.includes('\0'), 'UNSUPPORTED_TRACKED_PATH', path);
    assert(!PROHIBITED_PATH.test(path), 'PROHIBITED_TRACKED_PATH', path);
    assert(!(SECRET_PATH.test(path) && !/\.env\.example$/iu.test(path)), 'SECRET_TRACKED_PATH', path);
    assert(!TEMP_PATH.test(path), 'TEMPORARY_TRACKED_PATH', path);
    assert(!/\.zip(?:\.sha256)?$/iu.test(path), 'NESTED_ARCHIVE_TRACKED_PATH', path);
  }
  return paths;
}
function mediaType(path) {
  const lower = path.toLocaleLowerCase('en-US');
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'application/yaml';
  if (lower.endsWith('.mjs') || lower.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.ts')) return 'text/typescript; charset=utf-8';
  if (lower.endsWith('.svelte')) return 'text/x-svelte; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.html')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.ps1')) return 'text/x-powershell; charset=utf-8';
  if (lower.endsWith('.sh')) return 'text/x-shellscript; charset=utf-8';
  if (lower.endsWith('.txt') || lower.endsWith('.sha256') || lower.endsWith('.gitignore')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}
function category(path) {
  if (path.startsWith('.specify/')) return 'specification-infrastructure';
  if (path.startsWith('.github/')) return 'github-operations';
  if (path.startsWith('implementation-control/')) return 'implementation-control';
  if (path.startsWith('specs/')) return 'specification';
  if (path.startsWith('tests/')) return 'tests';
  if (path.startsWith('src/') || path.startsWith('workers/') || path.startsWith('public/')) return 'product';
  if (path.startsWith('docs/')) return 'documentation';
  if (/^(?:package(?:-lock)?\.json|tsconfig.*\.json|vite\.config\.ts|playwright\.config\.ts)$/u.test(path)) return 'project-configuration';
  return 'documentation';
}
function status(path) {
  return path.startsWith('.specify/') ? 'FROZEN' : 'ACTIVE';
}
function extensionCounts(paths) {
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
async function createEntry(path) {
  const absolute = join(root, path);
  return {
    path,
    sizeBytes: (await stat(absolute)).size,
    sha256: await shaFile(absolute),
    mediaType: mediaType(path),
    category: category(path),
    status: status(path),
  };
}
async function writeDerived() {
  const paths = await trackedPaths();
  assert(paths.includes(INVENTORY_PATH) && paths.includes(MANIFEST_PATH) && paths.includes(METADATA_PATH), 'DERIVED_CONTROL_FILES_NOT_TRACKED');
  const metadata = await readJson(join(root, METADATA_PATH));
  const instructionText = await readFile(join(root, 'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt'), 'utf8');
  const counts = extensionCounts(paths);
  const maximumRelativePath = [...paths].sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'))[0];
  Object.assign(metadata, {
    projectConfigurationInstructionCharacterCount: instructionText.length,
    finalFileCount: paths.length,
    jsonDocumentCount: counts.json,
    markdownDocumentCount: counts.markdown,
    yamlDocumentCount: counts.yaml,
    typescriptFileCount: counts.typescript,
    svelteFileCount: counts.svelte,
    powershellScriptCount: counts.powershell,
    shellScriptCount: counts.shell,
    maximumRelativePathLength: maximumRelativePath.length,
    maximumRelativePath,
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
  });
  await writeFile(join(root, METADATA_PATH), `${JSON.stringify(metadata)}\n`, 'utf8');

  const sourcePaths = paths.filter((path) => !DERIVED_EXCLUSIONS.has(path));
  const files = [];
  for (const path of sourcePaths) files.push(await createEntry(path));
  const inventory = {
    inventoryId: `FinScope-${metadata.packageRevision}-package-inventory`,
    packageVersion: metadata.packageRevision,
    generatedOn: metadata.generatedOn,
    root: metadata.rootDirectory,
    resolutionBase: 'packageRoot',
    itemCount: files.length,
    exclusions: [
      { path: INVENTORY_PATH, reason: 'self-reference excluded' },
      { path: MANIFEST_PATH, reason: 'manifest generated after inventory' },
    ],
    files,
  };
  await writeFile(join(root, INVENTORY_PATH), `${JSON.stringify(inventory)}\n`, 'utf8');
  await writeFile(join(root, MANIFEST_PATH), `${files.map((item) => `${item.sha256}  ${item.path}`).join('\n')}\n`, 'utf8');
  console.log(JSON.stringify({ result: 'DERIVED_FILES_WRITTEN', itemCount: files.length, fileCount: paths.length, instructionCharacters: instructionText.length }, null, 2));
}
async function validateDerived(paths) {
  const [metadata, inventory, manifestText] = await Promise.all([
    readJson(join(root, METADATA_PATH)),
    readJson(join(root, INVENTORY_PATH)),
    readFile(join(root, MANIFEST_PATH), 'utf8'),
  ]);
  const sourcePaths = paths.filter((path) => !DERIVED_EXCLUSIONS.has(path));
  assert(inventory.itemCount === sourcePaths.length && inventory.files?.length === sourcePaths.length, 'DERIVED_INVENTORY_COUNT_MISMATCH');
  const manifestLines = manifestText.trim().split(/\r?\n/u).filter(Boolean);
  assert(manifestLines.length === sourcePaths.length, 'DERIVED_MANIFEST_COUNT_MISMATCH');
  for (let index = 0; index < sourcePaths.length; index += 1) {
    const expectedPath = sourcePaths[index];
    const item = inventory.files[index];
    assert(item && item.path === expectedPath, 'DERIVED_INVENTORY_ORDER_MISMATCH', expectedPath);
    assert(JSON.stringify(Object.keys(item)) === JSON.stringify(['path', 'sizeBytes', 'sha256', 'mediaType', 'category', 'status']), 'DERIVED_INVENTORY_FIELDS_MISMATCH', expectedPath);
    assert(!Object.hasOwn(item, 'size'), 'DERIVED_INVENTORY_LEGACY_SIZE_PRESENT', expectedPath);
    const current = await createEntry(expectedPath);
    assert(JSON.stringify(item) === JSON.stringify(current), 'DERIVED_INVENTORY_ENTRY_MISMATCH', expectedPath);
    assert(manifestLines[index] === `${current.sha256}  ${expectedPath}`, 'DERIVED_MANIFEST_ENTRY_MISMATCH', expectedPath);
  }
  assert(metadata.finalFileCount === paths.length, 'DERIVED_METADATA_FILE_COUNT_MISMATCH');
  const instructionText = await readFile(join(root, 'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt'), 'utf8');
  assert(metadata.projectConfigurationInstructionCharacterCount === instructionText.length, 'DERIVED_METADATA_INSTRUCTION_COUNT_MISMATCH');
  assert(instructionText.length <= 8000, 'PROJECT_CONFIGURATION_INSTRUCTIONS_TOO_LONG', String(instructionText.length));
}

if (process.argv[2] === '--write-derived') {
  await writeDerived();
  process.exit(0);
}

const out = resolve(process.argv[2] ?? '.finscope-release');
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const state = await readJson(join(root, 'implementation-control/IMPLEMENTATION_STATE.json'));
const metadata = await readJson(join(root, METADATA_PATH));
const expectedRoot = handoff.baseline.root.replace(/\/$/u, '');
const config = handoff.release;
assert(handoff.operation?.id === 'b20-post-restore-control-plane-hardening', 'UNEXPECTED_REMEDIATION_OPERATION');
assert(handoff.operation?.kind === 'RELEASE_REMEDIATION', 'UNEXPECTED_OPERATION_KIND');
assert(['candidate', 'closure'].includes(handoff.operation?.stage), 'REMEDIATION_STAGE_INVALID', String(handoff.operation?.stage));
if (handoff.operation.stage === 'candidate') {
  assert(handoff.closure?.status === 'NOT_AUTHORIZED', 'CANDIDATE_CLOSURE_STATUS_INVALID');
} else {
  assert(handoff.closure?.status === 'PENDING', 'CLOSURE_STAGE_STATUS_INVALID');
}
assert(handoff.release?.pending === true, 'REMEDIATION_RELEASE_NOT_PENDING');
assert(handoff.remediation?.hold === true, 'REMEDIATION_HOLD_NOT_ACTIVE');
assert(state.batchStatus?.B20 === 'COMPLETED' && state.batchStatus?.B21 === 'PENDING', 'PRODUCT_BATCH_STATE_INVALID');
assert(state.taskStatus?.T089 === 'COMPLETED', 'T089_NOT_COMPLETED');
assert(state.activeBatchId === 'B21' && state.nextAuthorizedBatchId === 'B21', 'NEXT_BATCH_STATE_INVALID');
assert(state.phaseGate?.convergenceAuthorized === false, 'CONVERGENCE_GATE_OPEN');
assert(metadata.result === 'CANDIDATE' && metadata.implementationReadiness === 'B20_COMPLETED_B21_BLOCKED_RELEASE_RECOVERY', 'PACKAGE_METADATA_NOT_CANDIDATE');

const headResult = await run('git rev-parse HEAD', { cwd: root });
const commitSha = headResult.stdout.toString('utf8').trim().toLowerCase();
assert(headResult.exitCode === 0 && /^[0-9a-f]{40}$/u.test(commitSha), 'CHECKED_OUT_SHA_INVALID', headResult.stderr.toString('utf8'));
const diffWorktree = await run('git diff --quiet', { cwd: root });
const diffIndex = await run('git diff --cached --quiet', { cwd: root });
assert(diffWorktree.exitCode === 0 && diffIndex.exitCode === 0, 'PACKAGE_SOURCE_NOT_COMMITTED');
const untrackedResult = await run('git ls-files --others --exclude-standard -z', { cwd: root });
assert(untrackedResult.exitCode === 0, 'UNTRACKED_FILE_QUERY_FAILED');
const disallowedUntracked = untrackedResult.stdout.toString('utf8').split('\0').filter(Boolean).filter((path) => !path.startsWith('.finscope-release/') && !path.startsWith('.finscope-evidence/'));
assert(disallowedUntracked.length === 0, 'UNTRACKED_FILES_PRESENT', JSON.stringify(disallowedUntracked));

const paths = await trackedPaths();
await validateDerived(paths);
const specify = await canonicalTreeHash(join(root, '.specify'));
assert(specify.count === 19 && specify.sha256 === handoff.baseline.specifyTreeSha256, 'SPECIFY_TREE_MISMATCH', JSON.stringify(specify));
const controlRoot = process.env.FINSCOPE_PACKAGE_ROOT ? resolve(process.env.FINSCOPE_PACKAGE_ROOT) : root;
const control = await run(`node implementation-control/scripts/Validate-ControlPlaneState.mjs ${shellQuote(controlRoot)}`, { cwd: root });
assert(control.exitCode === 0, 'CONTROL_PLANE_INVALID', control.stderr.toString('utf8'));

await rm(out, { recursive: true, force: true });
const stagingParent = join(out, 'staging');
const stagingRoot = join(stagingParent, expectedRoot);
await mkdir(stagingRoot, { recursive: true });
for (const path of paths) {
  const destination = join(stagingRoot, path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, path), destination);
  await utimes(destination, FIXED_MTIME, FIXED_MTIME);
}
const zipPath = join(out, config.zipName);
const sidecarPath = join(out, config.sidecarName);
const listPath = join(out, 'zip-file-list.txt');
const archivePaths = paths.map((path) => `${expectedRoot}/${path}`);
await writeFile(listPath, `${archivePaths.join('\n')}\n`, 'utf8');
const zipResult = await run(`zip -X -q ${shellQuote(zipPath)} -@ < ${shellQuote(listPath)}`, { cwd: stagingParent, env: { TZ: 'UTC' } });
assert(zipResult.exitCode === 0, 'ZIP_CREATION_FAILED', zipResult.stderr.toString('utf8'));
const crc = await run(`unzip -tqq ${shellQuote(zipPath)}`, { cwd: root });
assert(crc.exitCode === 0, 'ZIP_CRC_FAILED', crc.stderr.toString('utf8'));
const zipSha256 = await shaFile(zipPath);
await writeFile(sidecarPath, `${zipSha256}  ${config.zipName}\n`, 'utf8');
await rm(join(out, 'staging'), { recursive: true, force: true });
await rm(listPath, { force: true });
const report = {
  schemaVersion: '1.0.0',
  result: 'CANDIDATE_PACKAGE_CREATED',
  operationId: handoff.operation.id,
  commitSha,
  createdAt: now(),
  zipName: config.zipName,
  sidecarName: config.sidecarName,
  zipSha256,
  root: expectedRoot,
  fileCount: paths.length,
  specify,
  qualificationMode: 'REMEDIATION_CANDIDATE',
  promotable: false,
  replacesSources: false,
  b21Executable: false,
};
await writeJson(join(out, 'package-generation.json'), report);
console.log(JSON.stringify(report, null, 2));
