import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalTreeHash,
  listFiles,
  now,
  readJson,
  root,
  run,
  setOutput,
  shaFile,
  validateJsonFile,
  verifyManifest,
  writeJson,
} from './GitHub-Common.mjs';
import { resolveGitHubClosureContext } from './Resolve-GitHubContext.mjs';

export class RemediationClosureError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `:${detail}` : ''}`); this.code = code; this.detail = detail; }
}

const fail = (code, detail = '') => { throw new RemediationClosureError(code, detail); };
const shaPattern = /^[0-9a-f]{40}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const normalizePaths = (paths) => paths.map((path) => String(path).replaceAll('\\', '/')).filter(Boolean);

export function assertCompleteRemediationCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') fail('REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE', 'candidate missing');
  for (const field of ['sha', 'runId', 'artifactId', 'artifactName', 'artifactDigest']) if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') fail('REMEDIATION_CANDIDATE_REFERENCE_INCOMPLETE', field);
  if (!shaPattern.test(candidate.sha)) fail('REMEDIATION_CANDIDATE_SHA_INVALID', String(candidate.sha));
  if (!Number.isInteger(candidate.runId) || candidate.runId < 1) fail('REMEDIATION_CANDIDATE_RUN_INVALID', String(candidate.runId));
  if (!Number.isInteger(candidate.artifactId) || candidate.artifactId < 1) fail('REMEDIATION_CANDIDATE_ARTIFACT_INVALID', String(candidate.artifactId));
  if (typeof candidate.artifactName !== 'string' || !candidate.artifactName) fail('REMEDIATION_CANDIDATE_ARTIFACT_INVALID', 'name');
  if (!digestPattern.test(candidate.artifactDigest)) fail('REMEDIATION_CANDIDATE_DIGEST_INVALID', String(candidate.artifactDigest));
  return candidate;
}

export function assertExactAllowedPaths(changedPaths, allowedPaths, code = 'REMEDIATION_CLOSURE_ALLOWLIST_VIOLATION') {
  const changed = normalizePaths(changedPaths); const allowed = new Set(normalizePaths(allowedPaths));
  const denied = changed.filter((path) => !allowed.has(path));
  if (denied.length > 0) fail(code, denied.join(','));
  return changed;
}

export function validateRemediationArtifactMetadata({ candidate, runInfo, artifactInfo, branch }) {
  assertCompleteRemediationCandidate(candidate);
  if (String(runInfo?.id) !== String(candidate.runId) || runInfo?.head_sha !== candidate.sha || runInfo?.conclusion !== 'success' || runInfo?.event !== 'pull_request' || runInfo?.head_branch !== branch) fail('REMEDIATION_CANDIDATE_RUN_IDENTITY_MISMATCH', JSON.stringify({ id: runInfo?.id, head_sha: runInfo?.head_sha, conclusion: runInfo?.conclusion, event: runInfo?.event, head_branch: runInfo?.head_branch }));
  if (String(artifactInfo?.id) !== String(candidate.artifactId)) fail('REMEDIATION_CANDIDATE_ARTIFACT_ID_MISMATCH', String(artifactInfo?.id));
  if (artifactInfo?.name !== candidate.artifactName) fail('REMEDIATION_CANDIDATE_ARTIFACT_NAME_MISMATCH', String(artifactInfo?.name));
  if (artifactInfo?.expired !== false) fail('REMEDIATION_CANDIDATE_ARTIFACT_EXPIRED');
  if (artifactInfo?.workflow_run?.head_sha !== candidate.sha || String(artifactInfo?.workflow_run?.id) !== String(candidate.runId)) fail('REMEDIATION_CANDIDATE_ARTIFACT_RUN_MISMATCH');
  if (artifactInfo?.digest !== candidate.artifactDigest) fail('REMEDIATION_CANDIDATE_ARTIFACT_DIGEST_METADATA_MISMATCH', String(artifactInfo?.digest));
  return true;
}

export function validateRemediationCandidateEvidence({ evidence, remediation, candidate, handoff }) {
  assertCompleteRemediationCandidate(candidate);
  const baseline = handoff.completedBaseline;
  if (evidence?.result !== 'PASS' || evidence?.primaryFailure !== null) fail('REMEDIATION_CANDIDATE_EVIDENCE_RESULT_INVALID');
  if (evidence.commitSha !== candidate.sha || String(evidence.runId) !== String(candidate.runId)) fail('REMEDIATION_CANDIDATE_EVIDENCE_IDENTITY_MISMATCH');
  if (evidence.branch !== remediation.branch || evidence.mode !== remediation.mode || evidence.remediationScope?.id !== remediation.id || evidence.remediationScope?.valid !== true) fail('REMEDIATION_CANDIDATE_EVIDENCE_SCOPE_MISMATCH');
  if (evidence.releaseBaseline?.tag !== baseline.tag || evidence.releaseBaseline?.zipSha256 !== baseline.zipSha256 || evidence.releaseBaseline?.result !== 'PASS') fail('REMEDIATION_BASELINE_B20_MISMATCH');
  if (evidence.specify?.byteIdentical !== true || evidence.specify?.sha256 !== baseline.specifyTreeSha256) fail('REMEDIATION_SPECIFY_EVIDENCE_MISMATCH');
  if (JSON.stringify(evidence.derivedBatchCommands) !== JSON.stringify(remediation.commands)) fail('REMEDIATION_COMMAND_SET_MISMATCH');
  const executed = new Map((evidence.executedCommands ?? []).map((entry) => [entry.id, entry]));
  for (const command of remediation.commands.filter(({ required }) => required)) {
    const observed = executed.get(command.id);
    if (!observed || observed.command !== command.command || observed.required !== true || observed.status !== 'PASS' || observed.exitCode !== 0) fail('REMEDIATION_REQUIRED_COMMAND_NOT_PASS', command.id);
  }
  if ((evidence.executedCommands ?? []).some((entry) => entry.required && (entry.status === 'NOT_RUN' || entry.status === 'FAIL'))) fail('REMEDIATION_REQUIRED_COMMAND_NOT_PASS', 'required FAIL or NOT_RUN');
  return true;
}

export function validateRemediationProductState(state) {
  if (state?.batchStatus?.B21 !== 'COMPLETED' || !state?.completedBatchIds?.includes('B21')) fail('REMEDIATION_B21_NOT_COMPLETED');
  if (state?.batchStatus?.B22 !== 'PENDING' || state?.activeBatchId !== 'B22' || state?.nextAuthorizedBatchId !== 'B22' || state?.completedBatchIds?.includes('B22')) fail('REMEDIATION_B22_NOT_PENDING');
  if (state?.phaseGate?.convergenceAuthorized !== false) fail('REMEDIATION_CONVERGENCE_AUTHORIZED');
  return { b21Status: 'COMPLETED', b22Status: 'PENDING', convergenceAuthorized: false };
}

export function assertClosureWorkflowOutcomes({ applyOutcome, controlPlaneOutcome }) {
  if (applyOutcome !== 'success') fail('REMEDIATION_CLOSURE_APPLY_FAILED', String(applyOutcome ?? 'missing'));
  if (controlPlaneOutcome !== 'success') fail('REMEDIATION_CONTROL_PLANE_FAILED', String(controlPlaneOutcome ?? 'missing'));
  return { localValidation: 'PASS', controlPlaneValidation: 'PASS' };
}

export function remediationClosureArtifactName(closureSha, result) {
  const suffix = result === 'PASS' ? 'PASS' : result === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : '_FAILED';
  return `finscope-closure-${String(closureSha).slice(0, 12)}-${suffix}`;
}

export function buildCompletedRemediationPolicy(policy, { requestSha, runId, completedAt }) {
  assertCompleteRemediationCandidate(policy.candidate);
  if (policy.kind !== 'REMEDIATION_CLOSURE' || policy.stage !== 'closure' || policy.status !== 'PENDING') fail('REMEDIATION_CLOSURE_REQUEST_INVALID', `${policy.kind}/${policy.stage}/${policy.status}`);
  if (!shaPattern.test(requestSha)) fail('REMEDIATION_CLOSURE_REQUEST_SHA_INVALID', String(requestSha));
  return {
    ...policy,
    stage: 'completed',
    status: 'COMPLETED',
    closure: {
      candidateSha: policy.candidate.sha,
      requestSha,
      runId: Number(runId),
      completedAt,
    },
  };
}

export function resolveRemediationClosureRequest({ branch, handoff, state, requestSha }) {
  const route = resolveGitHubClosureContext({ branch, handoff });
  if (route.closureType !== 'REMEDIATION_CLOSURE') fail('REMEDIATION_CLOSURE_NOT_REQUESTED', route.closureType);
  const remediation = handoff.remediations.find((entry) => entry.id === route.remediationId && entry.branch === branch);
  if (!remediation) fail('REMEDIATION_NOT_FOUND', route.remediationId ?? branch);
  if (remediation.closurePolicy.kind !== 'REMEDIATION_CLOSURE') fail('REMEDIATION_CLOSURE_KIND_INVALID');
  assertCompleteRemediationCandidate(remediation.closurePolicy.candidate);
  if (!shaPattern.test(requestSha)) fail('REMEDIATION_CLOSURE_REQUEST_SHA_INVALID', String(requestSha));
  validateRemediationProductState(state);
  return { route, remediation, candidate: remediation.closurePolicy.candidate };
}

async function command(commandText, code, options = {}) {
  const result = await run(commandText, { cwd: root, ...options });
  if (result.exitCode !== 0) fail(code, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').trim();
}

async function api(repository, path) {
  return JSON.parse(await command(`gh api "repos/${repository}/${path}"`, 'REMEDIATION_GITHUB_API_FAILED'));
}

async function downloadArtifact(repository, artifactId, destination) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) fail('REMEDIATION_GITHUB_TOKEN_MISSING');
  await command(
    `curl --fail-with-body --silent --show-error --location --header "Authorization: Bearer $GH_TOKEN" --header "Accept: application/vnd.github+json" --header "X-GitHub-Api-Version: 2022-11-28" --output "${destination}" "https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip"`,
    'REMEDIATION_CANDIDATE_ARTIFACT_DOWNLOAD_FAILED',
    { env: { GH_TOKEN: token } },
  );
}

async function extractArtifact(zipPath, extractPath) {
  await command(`unzip -tqq "${zipPath}"`, 'REMEDIATION_CANDIDATE_ARTIFACT_CRC_FAILED');
  const names = (await command(`unzip -Z1 "${zipPath}"`, 'REMEDIATION_CANDIDATE_ARTIFACT_LIST_FAILED')).split(/\r?\n/u).filter(Boolean);
  if (names.length === 0) fail('REMEDIATION_CANDIDATE_ARTIFACT_EMPTY');
  const exact = new Set(); const folded = new Set();
  for (const raw of names) {
    const path = raw.replaceAll('\\', '/'); const key = path.toLocaleLowerCase('en-US');
    if (raw !== path || path.startsWith('/') || /^[A-Za-z]:\//u.test(path) || path.split('/').includes('..') || path.includes('\0')) fail('REMEDIATION_CANDIDATE_ARTIFACT_UNSAFE_PATH', raw);
    if (exact.has(path) || folded.has(key)) fail('REMEDIATION_CANDIDATE_ARTIFACT_DUPLICATE_PATH', raw);
    exact.add(path); folded.add(key);
  }
  const zipInfo = await command(`zipinfo -l "${zipPath}"`, 'REMEDIATION_CANDIDATE_ARTIFACT_ZIPINFO_FAILED');
  if (zipInfo.split(/\r?\n/u).some((line) => /^l/u.test(line))) fail('REMEDIATION_CANDIDATE_ARTIFACT_SYMLINK');
  await mkdir(extractPath, { recursive: true });
  await command(`unzip -q "${zipPath}" -d "${extractPath}"`, 'REMEDIATION_CANDIDATE_ARTIFACT_EXTRACTION_FAILED');
}

async function validateCandidateArtifact(extractPath, remediation, candidate, handoff) {
  const manifestCount = await verifyManifest(extractPath);
  if ((await listFiles(extractPath)).length !== manifestCount + 1) fail('REMEDIATION_CANDIDATE_MANIFEST_UNTRACKED_FILE');
  const schemaPath = join(root, 'implementation-control/schemas/github-validation-evidence.schema.json');
  const evidencePath = join(extractPath, 'github-validation-evidence.json');
  await validateJsonFile(schemaPath, evidencePath);
  const [{ default: Ajv2020 }, schema, evidence] = await Promise.all([
    import('ajv/dist/2020.js'),
    readJson(schemaPath),
    readJson(evidencePath),
  ]);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(evidence)) fail('REMEDIATION_CANDIDATE_SCHEMA_AJV_INVALID', JSON.stringify(validate.errors));
  validateRemediationCandidateEvidence({ evidence, remediation, candidate, handoff });
  return evidence;
}

async function currentChangedFiles() {
  const status = await command('git status --porcelain=v1', 'REMEDIATION_GIT_STATUS_FAILED');
  return status.split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3).replaceAll('\\', '/'));
}

export async function applyGitHubRemediationClosure() {
  const handoffPath = join(root, 'implementation-control/GITHUB_HANDOFF.json');
  const statePath = join(root, 'implementation-control/IMPLEMENTATION_STATE.json');
  const [handoff, state] = await Promise.all([readJson(handoffPath), readJson(statePath)]);
  const branch = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? '';
  const requestSha = (await command('git rev-parse HEAD', 'REMEDIATION_CLOSURE_REQUEST_SHA_INVALID')).toLowerCase();
  const existing = handoff.remediations?.find((entry) => entry.branch === branch);
  if (existing?.closurePolicy?.stage === 'completed' && existing.closurePolicy.status === 'COMPLETED') {
    await Promise.all([setOutput('applied', 'false'), setOutput('detail', 'REMEDIATION_CLOSURE_ALREADY_APPLIED')]);
    return { result: 'PASS', applied: false, detail: 'REMEDIATION_CLOSURE_ALREADY_APPLIED' };
  }
  const { route, remediation, candidate } = resolveRemediationClosureRequest({ branch, handoff, state, requestSha });
  await command(`git merge-base --is-ancestor "${candidate.sha}" "${requestSha}"`, 'REMEDIATION_CANDIDATE_NOT_ANCESTOR');
  const requestFiles = (await command(`git diff --name-only "${candidate.sha}" "${requestSha}"`, 'REMEDIATION_CLOSURE_REQUEST_DIFF_FAILED')).split(/\r?\n/u).filter(Boolean);
  assertExactAllowedPaths(requestFiles, route.requestAllowedPaths, 'REMEDIATION_CLOSURE_REQUEST_ALLOWLIST_VIOLATION');
  const [runInfo, artifactInfo] = await Promise.all([
    api(handoff.repository, `actions/runs/${candidate.runId}`),
    api(handoff.repository, `actions/artifacts/${candidate.artifactId}`),
  ]);
  validateRemediationArtifactMetadata({ candidate, runInfo, artifactInfo, branch });
  const contextDirectory = resolve(process.env.FINSCOPE_CLOSURE_CONTEXT_DIR ?? join(process.env.RUNNER_TEMP ?? root, 'finscope-context'));
  const workDirectory = join(contextDirectory, 'remediation-candidate'); const zipPath = join(workDirectory, 'candidate-artifact.zip'); const extractPath = join(workDirectory, 'candidate-artifact');
  await rm(workDirectory, { recursive: true, force: true }); await mkdir(workDirectory, { recursive: true });
  await downloadArtifact(handoff.repository, candidate.artifactId, zipPath);
  if (`sha256:${await shaFile(zipPath)}` !== candidate.artifactDigest) fail('REMEDIATION_CANDIDATE_ARTIFACT_DIGEST_BYTES_MISMATCH');
  await extractArtifact(zipPath, extractPath);
  await validateCandidateArtifact(extractPath, remediation, candidate, handoff);
  const specify = await canonicalTreeHash(join(root, '.specify'));
  if (specify.sha256 !== handoff.completedBaseline.specifyTreeSha256) fail('REMEDIATION_SPECIFY_NOT_BYTE_IDENTICAL', specify.sha256);
  const completedAt = now(); const runId = Number(process.env.GITHUB_RUN_ID);
  if (!Number.isInteger(runId) || runId < 1) fail('REMEDIATION_CLOSURE_RUN_ID_INVALID');
  remediation.closurePolicy = buildCompletedRemediationPolicy(remediation.closurePolicy, { requestSha, runId, completedAt });
  const reportBase = join(root, 'implementation-control/reports/B21_CLEAN_PACKAGE_REMEDIATION_CLOSURE');
  const report = {
    schemaVersion: '1.0.0', remediationId: remediation.id, remediationMode: remediation.mode, status: 'COMPLETED', branch,
    candidate: { ...candidate }, closureRequestSha: requestSha, closureRunId: runId, completedAt,
    productStateUnchanged: true, tasksUnchanged: true, batchesUnchanged: true, specifyByteIdentical: true,
    b21Status: 'COMPLETED', b22Status: 'PENDING', convergenceAuthorized: false,
  };
  await writeJson(`${reportBase}.json`, report);
  await writeFile(`${reportBase}.md`, `# B21 clean-package remediation — authenticated closure\n\nResult: \`COMPLETED\`. Remediation \`${remediation.id}\`, candidate \`${candidate.sha}\`, request \`${requestSha}\`, run \`${runId}\`.\n\nThe closure did not promote tasks or batches. B21 remains \`COMPLETED\`, B22 remains \`PENDING\`, \`convergenceAuthorized=false\`, product state is unchanged, and \`.specify\` remains byte-identical.\n`, 'utf8');
  const ledgerPath = join(root, 'implementation-control/CHANGE_LEDGER.md'); const ledger = await readFile(ledgerPath, 'utf8');
  await writeFile(ledgerPath, `${ledger}\n\n## ${completedAt.slice(0, 10)} — Authenticated remediation closure\n\n- remediation: \`${remediation.id}\`;\n- candidate: \`${candidate.sha}\`, run \`${candidate.runId}\`, artifact \`${candidate.artifactId}\`;\n- closure request: \`${requestSha}\`, run \`${runId}\`;\n- B21 remains \`COMPLETED\`; B22 remains \`PENDING\`; no tasks, batches, product, or \`.specify\` bytes changed.\n`, 'utf8');
  await writeJson(handoffPath, handoff);
  const changed = await currentChangedFiles();
  assertExactAllowedPaths(changed, route.allowedPaths);
  for (const forbidden of ['specs/001-fundamental-analysis-platform/tasks.md', 'implementation-control/IMPLEMENTATION_STATE.json', 'implementation-control/TASK_SOURCE_LOCK.json', 'implementation-control/IMPLEMENTATION_BATCH_MAP.json']) if (changed.includes(forbidden)) fail('REMEDIATION_FORBIDDEN_STATE_MUTATION', forbidden);
  for (const commandText of [
    'git config user.name "FinScope GitHub Remediation Closure"',
    'git config user.email "actions@users.noreply.github.com"',
    `git add -- "${route.allowedPaths.join('" "')}"`,
    `git commit -m "chore: close ${remediation.id} from authenticated evidence"`,
  ]) await command(commandText, 'REMEDIATION_CLOSURE_GIT_COMMAND_FAILED');
  const closureSha = (await command('git rev-parse HEAD', 'REMEDIATION_CLOSURE_COMMIT_INVALID')).toLowerCase();
  const applyContext = {
    result: 'PASS', closureType: 'REMEDIATION_CLOSURE', repository: handoff.repository,
    remediationId: remediation.id, remediationMode: remediation.mode, branch, candidate,
    requestSha, closureSha, candidateSha: candidate.sha, runId, artifactExtractPath: extractPath,
    changedFiles: changed, allowedPaths: route.allowedPaths, remoteExpectedHead: requestSha,
    prepared: true, pushed: false,
    productStateUnchanged: true, tasksUnchanged: true, batchesUnchanged: true,
    specifyByteIdentical: true, b21Status: 'COMPLETED', b22Status: 'PENDING', convergenceAuthorized: false,
  };
  await writeJson(join(contextDirectory, 'remediation-closure-apply.json'), applyContext);
  await Promise.all([setOutput('applied', 'true'), setOutput('detail', `REMEDIATION_CLOSURE_PREPARED:${closureSha}`), setOutput('closure_sha', closureSha)]);
  console.log(JSON.stringify(applyContext, null, 2));
  return applyContext;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await applyGitHubRemediationClosure();
