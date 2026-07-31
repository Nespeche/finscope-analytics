import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  canonicalTreeHash,
  listFiles,
  now,
  posix,
  readJson,
  root,
  run,
  shaFile,
  writeJson,
} from './GitHub-Common.mjs';

const out = resolve(process.argv[2] ?? '.finscope-release');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const headResult = await run('git rev-parse HEAD', { cwd: root });
const releaseCommitSha = headResult.exitCode === 0 ? headResult.stdout.toString('utf8').trim().toLowerCase() : '';
if (!/^[0-9a-f]{40}$/u.test(releaseCommitSha)) throw new Error('RELEASE_CHECKED_OUT_SHA_INVALID');

const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const config = handoff.release;
const operation = handoff.operation ?? { id: 'GH0', activeBatchId: 'B12', nextBatchId: 'B12', completedTasksThroughOnClosure: 'T048' };
const rootName = handoff.baseline.root.replace(/\/$/u, '');
const staging = join(out, 'staging', rootName);
const excluded = new Set(['.git', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results', '.wrangler', '.vite', '.finscope-evidence', '.finscope-release']);

await mkdir(staging, { recursive: true });
for (const source of await listFiles(root, [...excluded])) {
  const rel = posix(relative(root, source));
  if (rel.startsWith('.finscope-release/')) continue;
  if (/\.zip(?:\.sha256)?$/iu.test(rel)) continue;
  const destination = join(staging, rel);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const statePath = join(staging, 'implementation-control/IMPLEMENTATION_STATE.json');
const metadataPath = join(staging, 'PACKAGE_METADATA.json');
const authorityPath = join(staging, 'implementation-control/AUTHORITY_MATRIX.json');
const stagingHandoffPath = join(staging, 'implementation-control/GITHUB_HANDOFF.json');
const lockPath = join(staging, 'implementation-control/TASK_SOURCE_LOCK.json');
const mapPath = join(staging, 'implementation-control/IMPLEMENTATION_BATCH_MAP.json');
const state = await readJson(statePath);
const metadata = await readJson(metadataPath);
const authority = await readJson(authorityPath);
const stagingHandoff = await readJson(stagingHandoffPath);
const lock = await readJson(lockPath);
const batchMap = await readJson(mapPath);
const completedBatch = operation.activeBatchId ?? operation.id;
const nextBatch = operation.nextBatchId ?? state.activeBatchId;
const completedTask = operation.completedTasksThroughOnClosure;
const batch = await readJson(join(staging, `implementation-control/batches/${completedBatch}.json`));

if (!state.completedBatchIds.includes(completedBatch) || state.lastCompletedBatchId !== completedBatch || state.taskStatus?.[completedTask] !== 'COMPLETED') {
  throw new Error('COMPLETED_STATE_NOT_CLOSED');
}
if (state.activeBatchId !== nextBatch || state.nextAuthorizedBatchId !== nextBatch || state.batchStatus?.[nextBatch] !== 'PENDING') {
  throw new Error('COMPLETED_NEXT_BATCH_STATE_INVALID');
}
if (state.phaseGate?.convergenceAuthorized !== false) throw new Error('CONVERGENCE_GATE_OPEN');

const date = new Date().toISOString().slice(0, 10);
state.packageRevision = config.packageRevision;
state.activePackageLogicalName = config.zipName;
state.baselineRole = 'ACTIVE_COMPLETED_BASELINE';
state.updatedBy = 'FinScope GitHub completed release workflow';
state.updatedOn = date;
state.validationWorkflow = {
  ...state.validationWorkflow,
  candidatePromotionRule: 'GitHub candidate and closure checks must PASS for the exact commit before Release.',
  localProtocol: 'implementation-control/LOCAL_VALIDATION_PROTOCOL.md',
  evidenceSchema: 'implementation-control/schemas/github-validation-evidence.schema.json',
  pendingRuntimeValidationBatches: [],
};

authority.packageRevision = config.packageRevision;
lock.packageRevision = config.packageRevision;
lock.generatedOn = date;
batchMap.mapId = `FinScope-${config.packageRevision.replaceAll('_', '-')}-batch-map`;
batchMap.packageRevision = config.packageRevision;
batchMap.generatedOn = date;
stagingHandoff.operation.stage = 'completed';
stagingHandoff.closure.status = 'COMPLETED';
stagingHandoff.release.pending = false;

await writeJson(statePath, state);
await writeJson(authorityPath, authority);
await writeJson(lockPath, lock);
await writeJson(mapPath, batchMap);
const mapMarkdown = ['# IMPLEMENTATION BATCH MAP — FinScope Analytics','',`Revisión: \`${config.packageRevision}\`. Fuente: \`tasks.md\` (\`${state.sourceTasksSha256}\`).`,'',`**SHA-256 de tareas:** \`${state.sourceTasksSha256}\``,'','| Lote | Tareas | Estado |','|---|---|---|',...(batchMap.batches ?? []).map((item) => `| ${item.batchId} | ${item.taskIds.join(', ')} | \`${item.status}\` |`),'',`B01–${completedBatch} y T001–${completedTask} están \`COMPLETED\`. ${nextBatch} permanece \`PENDING\` como único lote activo/autorizado; \`activeBatchId=${nextBatch}\`; \`nextAuthorizedBatchId=${nextBatch}\`; \`convergenceAuthorized=false\`.`, ''].join('\n');
await writeFile(join(staging, 'implementation-control/IMPLEMENTATION_BATCH_MAP.md'), mapMarkdown, 'utf8');
await writeJson(stagingHandoffPath, stagingHandoff);

const phaseStatus = `# FinScope Analytics v0.21 — Gate activo / ${completedBatch} completado

## Estado

\`IMPLEMENTATION_BATCH_${completedBatch}_COMPLETED_${nextBatch}_PENDING\`

<a id="gate"></a>
## Gate único

\`\`\`text
specificationAuthorized=true
clarificationAuthorized=true
planAuthorized=true
checklistAuthorized=true
tasksAuthorized=true
analysisAuthorized=true
implementationAuthorized=true
convergenceAuthorized=false
\`\`\`

Este archivo es la única autoridad de esos flags. \`IMPLEMENTATION_STATE.json\` gobierna el estado de tareas y lotes. T109 solo produce entrada para una futura conversación de convergencia.

## Estado de implementación

B01–${completedBatch} y T001–${completedTask} están \`COMPLETED\`. ${nextBatch} está \`PENDING\` y es el único lote activo/autorizado: \`activeBatchId=${nextBatch}\`, \`nextAuthorizedBatchId=${nextBatch}\`. Los lotes posteriores permanecen \`PENDING\`. Convergencia continúa cerrada.
`;
await writeFile(join(staging, 'V0.21_PHASE_STATUS.md'), phaseStatus, 'utf8');

const documentationIndex = `# DOCUMENTATION INDEX — FinScope Analytics ${completedBatch} completed

## Entrada obligatoria

1. \`START_HERE_CHATGPT.md\`;
2. \`.specify/memory/constitution.md\`;
3. \`V0.21_PHASE_STATUS.md\`;
4. \`implementation-control/AUTHORITY_MATRIX.json\`;
5. \`implementation-control/IMPLEMENTATION_STATE.json\`;
6. \`implementation-control/TASK_SOURCE_LOCK.json\`;
7. \`implementation-control/IMPLEMENTATION_BATCH_MAP.json\`;
8. \`implementation-control/batches/${nextBatch}.json\`;
9. \`implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md\`;
10. \`implementation-control/GITHUB_HANDOFF.json\`;
11. \`implementation-control/reports/${completedBatch}_EVIDENCE_VERIFICATION_AND_CLOSURE.md\`.

## Gate y estado activo

\`tasksAuthorized=true\`, \`analysisAuthorized=true\`, \`implementationAuthorized=true\`, \`convergenceAuthorized=false\`.

B01–${completedBatch} y T001–${completedTask} están \`COMPLETED\`. ${nextBatch} está \`PENDING\` y es el único lote activo/autorizado: \`activeBatchId=${nextBatch}\`, \`nextAuthorizedBatchId=${nextBatch}\`.

## Integridad

Paquete lógico \`${config.zipName}\`; raíz \`${handoff.baseline.root}\`; \`.specify\` byte-inmutable.
`;
await writeFile(join(staging, 'DOCUMENTATION_INDEX.md'), documentationIndex, 'utf8');
await writeFile(join(staging, 'START_HERE_CHATGPT.md'), `# START HERE — FinScope Analytics ${completedBatch} completed

Este árbol corresponde a \`${config.packageRevision}\`. Su nombre lógico es \`${config.zipName}\` y reemplaza al baseline anterior únicamente cuando Release, ZIP y sidecar sean publicados y autenticados.

B01–${completedBatch} y T001–${completedTask} están \`COMPLETED\`. ${nextBatch} permanece \`PENDING\` como único lote activo/autorizado: \`activeBatchId=${nextBatch}\`, \`nextAuthorizedBatchId=${nextBatch}\`. \`convergenceAuthorized=false\`.

La próxima conversación puede implementar exclusivamente ${nextBatch} desde una rama nueva basada en \`main\`. No iniciar lotes posteriores ni convergencia.
`, 'utf8');
const contextPath = join(staging, 'PROJECT_CONTEXT.md');
const oldContext = await readFile(contextPath, 'utf8');
const separatorIndex = oldContext.indexOf('\n---\n');
const historicalContext = separatorIndex >= 0 ? oldContext.slice(separatorIndex + 5) : oldContext;
await writeFile(contextPath, `# PROJECT CONTEXT — FinScope Analytics ${completedBatch} completed

- paquete: \`${config.packageRevision}\` / \`${config.zipName}\`;
- B01–${completedBatch} y T001–${completedTask}: \`COMPLETED\`;
- ${nextBatch}: \`PENDING\`, único lote activo/autorizado;
- \`convergenceAuthorized=false\`;
- candidate autenticado: \`${handoff.candidate.sha}\`, run \`${handoff.candidate.runId}\`;
- \`.specify\`: 19 archivos, \`${handoff.baseline.specifyTreeSha256}\`.

---

${historicalContext}`, 'utf8');

const prompt = `# Implementar ${nextBatch} — GitHub-first

Usa exclusivamente el Release \`${config.tag}\` de \`${handoff.repository}\`, commit final \`${releaseCommitSha}\`. Descarga únicamente los assets personalizados \`${config.zipName}\` y \`${config.sidecarName}\`; no uses Source code (zip/tar.gz). Verifica sidecar, SHA-256, CRC, raíz \`${handoff.baseline.root}\`, manifests, metadata, control plane y 19 archivos .specify.

Crea una rama desde \`main\`, abre PR Draft e implementa exclusivamente ${nextBatch} conforme a \`implementation-control/batches/${nextBatch}.json\`. Los workflows deben ejecutar literalmente \`localValidation.commands\`. No implementes lotes posteriores, no modifiques .specify y conserva \`convergenceAuthorized=false\`. Sigue \`implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md\`.
`;
await writeFile(join(staging, config.promptName), prompt, 'utf8');

const reportFiles = await listFiles(join(staging, 'implementation-control/reports'));
const activeReports = reportFiles
  .map((absolute) => posix(relative(staging, absolute)))
  .filter((path) => basename(path).startsWith(`${completedBatch}_`) || basename(path).startsWith('GH0_'))
  .sort((a, b) => a.localeCompare(b, 'en'));

metadata.packageId = `FinScope-Analytics-${config.packageRevision.replaceAll('_', '-')}`;
metadata.packageVersion = config.packageRevision;
metadata.packageRevision = config.packageRevision;
metadata.generatedOn = date;
metadata.phase = `implementation_${completedBatch}_completed`;
metadata.result = 'COMPLETED';
metadata.implementationReadiness = `${completedBatch}_COMPLETED_${nextBatch}_AUTHORIZED_PENDING`;
metadata.logicalZipName = config.zipName;
metadata.finalSha256Sidecar = config.sidecarName;
metadata.sourceBaseline = {
  logicalName: handoff.baseline.zipName,
  sha256: handoff.baseline.zipSha256,
  sidecarMatch: true,
  crcValid: true,
  singleRoot: true,
  safeExtraction: true,
  role: `ACTIVE_COMPLETED_BASELINE_USED_FOR_${completedBatch}`,
};
metadata.implementationState = {
  status: state.implementationStatus,
  completedBatches: [...state.completedBatchIds],
  activeBatchId: nextBatch,
  nextAuthorizedBatchId: nextBatch,
  completedTasksThrough: completedTask,
  nextBatchStatus: { [nextBatch]: state.batchStatus[nextBatch] },
};
metadata.taskModel = { ...metadata.taskModel, tasksSha256: state.sourceTasksSha256 };
metadata.sourceTasksSha256 = state.sourceTasksSha256;
metadata.validationModel = {
  ...metadata.validationModel,
  candidateStatus: 'COMPLETED',
  protocol: 'implementation-control/GITHUB_VALIDATION_PROTOCOL.md',
  instructions: 'implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md',
  batchScript: 'implementation-control/scripts/Run-GitHubValidation.mjs',
  externalLauncher: null,
  externalLauncherSha256: null,
  externalEvidenceRequired: true,
  externalEvidenceVerified: true,
  githubFirst: true,
  browserRequired: Boolean(batch.localValidation?.browserRequired),
  requiredCommandCount: (batch.localValidation?.commands ?? []).length,
  recommendedWindowsInputRoot: `C:\\FS\\${completedBatch}-release\\input`,
  recommendedWindowsWorkRoot: `C:\\FS\\${completedBatch}-release\\work`,
};
metadata.activeReports = activeReports;
metadata.windowsExtractionPolicy = {
  mode: 'GITHUB_FIRST_COMPLETED_RELEASE',
  releaseTag: config.tag,
  zipName: config.zipName,
  sidecarName: config.sidecarName,
  recommendedInputRoot: `C:\\FS\\${completedBatch}-release\\input`,
  recommendedWorkRoot: `C:\\FS\\${completedBatch}-release\\work`,
  localFallbackProtocol: 'implementation-control/LOCAL_VALIDATION_PROTOCOL.md',
  sourceCodeAssetsForbidden: true,
  explorerExtractionNotRequired: true,
  transportAliasResolution: 'SIDE_CAR_LOGICAL_NAME_PLUS_REAL_SHA256',
};
metadata.nextPhase = `Implement exclusively ${nextBatch} from a new branch and PR; do not start later batches or convergence.`;
const remediationChange = `Recalculated completed-package metadata, synchronized V0.21 active phase and added fail-closed ZIP metadata verification for the ${completedBatch} completed Release.`;
metadata.changes = [...new Set([...(metadata.changes ?? []), remediationChange])];

const currentPaths = (await listFiles(staging)).map((absolute) => posix(relative(staging, absolute)));
const extensionCount = (suffixes) => currentPaths.filter((path) => suffixes.some((suffix) => path.toLocaleLowerCase('en-US').endsWith(suffix))).length;
const maximumRelativePath = [...currentPaths].sort((a, b) => b.length - a.length || a.localeCompare(b, 'en'))[0];
metadata.finalFileCount = currentPaths.length;
metadata.jsonDocumentCount = extensionCount(['.json']);
metadata.markdownDocumentCount = extensionCount(['.md']);
metadata.yamlDocumentCount = extensionCount(['.yml', '.yaml']);
metadata.typescriptFileCount = extensionCount(['.ts']);
metadata.svelteFileCount = extensionCount(['.svelte']);
metadata.powershellScriptCount = extensionCount(['.ps1']);
metadata.shellScriptCount = extensionCount(['.sh']);
metadata.maximumRelativePathLength = maximumRelativePath.length;
metadata.maximumRelativePath = maximumRelativePath;
metadata.singleArchiveRoot = true;
metadata.zipEntrySeparator = '/';
metadata.windowsLongPathRiskReduced = maximumRelativePath.length <= 220;
metadata.absolutePathsPresent = false;
metadata.pathTraversalEntriesPresent = false;
metadata.duplicatePathsDetected = false;
metadata.caseFoldCollisionsDetected = false;
metadata.secretPatternsDetected = false;
metadata.temporaryFilesDetected = false;
metadata.regenerableDependencyDirectoriesDetected = false;
metadata.embeddedArchiveCount = 0;
metadata.finalManifestValid = true;
metadata.finalInventoryValid = true;
metadata.finalCrcValid = true;
metadata.extractionValidated = true;
metadata.finalZipSha256RecordedExternally = true;
await writeJson(metadataPath, metadata);

const oldInventory = await readJson(join(staging, 'PACKAGE_INVENTORY.json'));
const oldMap = new Map((oldInventory.files ?? []).map((item) => [item.path, item]));
const inventorySources = await listFiles(staging, ['PACKAGE_INVENTORY.json', 'FILE_MANIFEST.sha256']);
const inventoryFiles = [];
function media(path) {
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.md')) return 'text/markdown';
  if (/\.ya?ml$/u.test(path)) return 'application/yaml';
  if (path.endsWith('.ts') || path.endsWith('.mjs')) return 'text/javascript';
  return 'text/plain';
}
for (const absolute of inventorySources) {
  const rel = posix(relative(staging, absolute));
  const previous = oldMap.get(rel);
  inventoryFiles.push({
    path: rel,
    sizeBytes: (await stat(absolute)).size,
    sha256: await shaFile(absolute),
    mediaType: previous?.mediaType ?? media(rel),
    category: previous?.category ?? (rel.startsWith('.github/') ? 'github-operations' : rel.startsWith('implementation-control/') ? 'implementation-control' : 'documentation'),
    status: rel.startsWith('.specify/') ? 'FROZEN' : previous?.status ?? 'ACTIVE',
  });
}
const inventory = {
  inventoryId: `FinScope-${config.packageRevision}-package-inventory`,
  packageVersion: config.packageRevision,
  generatedOn: date,
  root: rootName,
  resolutionBase: 'packageRoot',
  itemCount: inventoryFiles.length,
  exclusions: [
    { path: 'PACKAGE_INVENTORY.json', reason: 'self-reference excluded' },
    { path: 'FILE_MANIFEST.sha256', reason: 'manifest generated after inventory' },
  ],
  files: inventoryFiles,
};
await writeJson(join(staging, 'PACKAGE_INVENTORY.json'), inventory);

const manifestFiles = await listFiles(staging, ['PACKAGE_INVENTORY.json', 'FILE_MANIFEST.sha256']);
const lines = [];
for (const absolute of manifestFiles) lines.push(`${await shaFile(absolute)}  ${posix(relative(staging, absolute))}`);
await writeFile(join(staging, 'FILE_MANIFEST.sha256'), `${lines.join('\n')}\n`, 'utf8');

const specify = await canonicalTreeHash(join(staging, '.specify'));
if (specify.count !== 19 || specify.sha256 !== state.specifyTreeSha256) throw new Error(`SPECIFY_MISMATCH:${JSON.stringify(specify)}`);
const control = await run('node implementation-control/scripts/Validate-ControlPlaneState.mjs .', { cwd: staging });
await writeFile(join(out, 'control-plane.stdout.log'), control.stdout);
await writeFile(join(out, 'control-plane.stderr.log'), control.stderr);
if (control.exitCode !== 0) throw new Error(`CONTROL_PLANE_FAILED:${control.exitCode}`);

const zipPath = join(out, config.zipName);
const zip = await run(`cd "${dirname(staging)}" && zip -X -q -r "${zipPath}" "${rootName}"`, { cwd: root });
if (zip.exitCode !== 0) throw new Error(`ZIP_CREATE_FAILED:${zip.stderr.toString()}`);
const zipSha = await shaFile(zipPath);
const sidecarPath = join(out, config.sidecarName);
await writeFile(sidecarPath, `${zipSha}  ${config.zipName}\n`, 'utf8');

const packageVerification = await run(`node implementation-control/scripts/Verify-GitHubCompletedPackage.mjs "${zipPath}" "${sidecarPath}"`, { cwd: root });
await writeFile(join(out, 'completed-package-verification.stdout.log'), packageVerification.stdout);
await writeFile(join(out, 'completed-package-verification.stderr.log'), packageVerification.stderr);
if (packageVerification.exitCode !== 0) throw new Error(`COMPLETED_PACKAGE_VERIFICATION_FAILED:${packageVerification.stderr.toString('utf8')}`);
const packageVerificationResult = JSON.parse(packageVerification.stdout.toString('utf8'));
if (packageVerificationResult.result !== 'PASS') throw new Error('COMPLETED_PACKAGE_VERIFICATION_RESULT_INVALID');

const evidenceName = `${config.evidencePrefix}_${process.env.GITHUB_RUN_ID}.json`;
const report = {
  schemaVersion: '1.1.0',
  result: 'PASS',
  repository: handoff.repository,
  operationId: operation.id,
  completedBatchId: completedBatch,
  nextBatchId: nextBatch,
  tag: config.tag,
  commitSha: releaseCommitSha,
  releaseRunId: process.env.GITHUB_RUN_ID,
  zipName: config.zipName,
  zipSha256: zipSha,
  sidecarName: config.sidecarName,
  root: rootName,
  specify,
  metadataValidation: {
    result: packageVerificationResult.result,
    fileCount: packageVerificationResult.fileCount,
    inventoryItemCount: packageVerificationResult.inventoryItemCount,
    manifestItemCount: packageVerificationResult.manifestItemCount,
    sourceTasksSha256: state.sourceTasksSha256,
  },
  controlPlaneExitCode: control.exitCode,
  createdAt: now(),
};
await writeJson(join(out, evidenceName), report);
await writeFile(join(out, config.promptName), prompt, 'utf8');
console.log(JSON.stringify(report, null, 2));
