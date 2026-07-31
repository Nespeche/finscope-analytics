import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  listFiles,
  readJson,
  root,
  run,
  setOutput,
  shaFile,
  verifyManifest,
} from './GitHub-Common.mjs';

const handoffPath = join(root, 'implementation-control/GITHUB_HANDOFF.json');
const handoff = await readJson(handoffPath);
const expectedCandidate = handoff.candidate;
const expectedBatch = handoff.operation?.activeBatchId;
const closure = handoff.closure ?? {};
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
function equal(actual, expected, code) {
  assert(actual === expected, code, JSON.stringify({ actual, expected }));
}
async function command(commandText, code, options = {}) {
  const result = await run(commandText, { cwd: root, ...options });
  assert(result.exitCode === 0, code, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').trim();
}
async function api(path) {
  return JSON.parse(await command(`gh api "repos/${handoff.repository}/${path}"`, 'GITHUB_API_FAILED'));
}
async function download(url, destination) {
  assert(token, 'GITHUB_TOKEN_MISSING');
  await command(
    `curl --fail-with-body --silent --show-error --location --header "Authorization: Bearer $GH_TOKEN" --header "Accept: application/octet-stream" --header "X-GitHub-Api-Version: 2022-11-28" --output "${destination}" "${url}"`,
    'ARTIFACT_DOWNLOAD_FAILED',
    { env: { GH_TOKEN: token } },
  );
}

assert(handoff.operation?.id, 'OPERATION_ID_MISSING');
assert(expectedBatch, 'ACTIVE_BATCH_ID_MISSING');
assert(closure.status === 'COMPLETED', 'CLOSURE_NOT_COMPLETED');
assert(/^[0-9a-f]{40}$/u.test(closure.commitSha ?? ''), 'CLOSURE_COMMIT_INVALID');
assert(closure.runId && closure.artifactId && closure.artifactName && closure.artifactDigest, 'CLOSURE_REFERENCE_INCOMPLETE');
assert(expectedCandidate?.sha && expectedCandidate?.runId && expectedCandidate?.artifactId, 'CANDIDATE_REFERENCE_INCOMPLETE');
assert(closure.candidateSha === expectedCandidate.sha, 'CLOSURE_CANDIDATE_MISMATCH');

const runInfo = await api(`actions/runs/${closure.runId}`);
assert(runInfo.conclusion === 'success' && runInfo.event === 'pull_request', 'CLOSURE_RUN_INVALID', JSON.stringify({ conclusion: runInfo.conclusion, event: runInfo.event }));
assert(/^[0-9a-f]{40}$/u.test(runInfo.head_sha ?? ''), 'CLOSURE_REQUEST_SHA_INVALID');
await command(`git cat-file -e "${runInfo.head_sha}^{commit}"`, 'CLOSURE_REQUEST_COMMIT_MISSING');
await command(`git cat-file -e "${closure.commitSha}^{commit}"`, 'CLOSURE_COMMIT_MISSING');
await command(`git merge-base --is-ancestor "${runInfo.head_sha}" "${closure.commitSha}"`, 'CLOSURE_COMMIT_NOT_DESCENDANT_OF_REQUEST');

const artifactInfo = await api(`actions/artifacts/${closure.artifactId}`);
equal(artifactInfo.name, closure.artifactName, 'CLOSURE_ARTIFACT_NAME_MISMATCH');
equal(artifactInfo.digest, closure.artifactDigest, 'CLOSURE_ARTIFACT_DIGEST_METADATA_MISMATCH');
equal(artifactInfo.expired, false, 'CLOSURE_ARTIFACT_EXPIRED');
equal(String(artifactInfo.workflow_run?.id), String(closure.runId), 'CLOSURE_ARTIFACT_RUN_MISMATCH');
equal(artifactInfo.workflow_run?.head_sha, runInfo.head_sha, 'CLOSURE_ARTIFACT_REQUEST_SHA_MISMATCH');

const evidenceRoot = join(root, '.finscope-release', 'closure-authentication');
const zipPath = join(evidenceRoot, 'closure-artifact.zip');
const extractPath = join(evidenceRoot, 'closure-artifact');
await rm(evidenceRoot, { recursive: true, force: true });
await mkdir(evidenceRoot, { recursive: true });
await download(`https://api.github.com/repos/${handoff.repository}/actions/artifacts/${closure.artifactId}/zip`, zipPath);
equal(`sha256:${await shaFile(zipPath)}`, closure.artifactDigest, 'CLOSURE_ARTIFACT_BYTES_MISMATCH');
await command(`unzip -tqq "${zipPath}"`, 'CLOSURE_ARTIFACT_CRC_FAILED');
const names = (await command(`unzip -Z1 "${zipPath}"`, 'CLOSURE_ARTIFACT_LIST_FAILED')).split(/\r?\n/u).filter(Boolean);
assert(names.length > 0, 'CLOSURE_ARTIFACT_EMPTY');
const exact = new Set();
const folded = new Set();
for (const raw of names) {
  const normalized = raw.replaceAll('\\', '/');
  assert(raw === normalized, 'CLOSURE_ARTIFACT_BACKSLASH_PATH', raw);
  assert(!normalized.startsWith('/') && !/^[A-Za-z]:\//u.test(normalized), 'CLOSURE_ARTIFACT_ABSOLUTE_PATH', raw);
  assert(!normalized.split('/').includes('..') && !normalized.includes('\0'), 'CLOSURE_ARTIFACT_TRAVERSAL', raw);
  assert(!exact.has(normalized), 'CLOSURE_ARTIFACT_DUPLICATE_PATH', raw);
  exact.add(normalized);
  const key = normalized.toLocaleLowerCase('en-US');
  assert(!folded.has(key), 'CLOSURE_ARTIFACT_CASE_FOLD_COLLISION', raw);
  folded.add(key);
}
const zipInfo = await command(`zipinfo -l "${zipPath}"`, 'CLOSURE_ARTIFACT_ZIPINFO_FAILED');
assert(!zipInfo.split(/\r?\n/u).some((line) => /^l/u.test(line)), 'CLOSURE_ARTIFACT_SYMLINK');
await mkdir(extractPath, { recursive: true });
await command(`unzip -q "${zipPath}" -d "${extractPath}"`, 'CLOSURE_ARTIFACT_EXTRACTION_FAILED');
const manifestCount = await verifyManifest(extractPath);
const extractedFiles = await listFiles(extractPath);
equal(extractedFiles.length, manifestCount + 1, 'CLOSURE_ARTIFACT_UNMANIFESTED_FILE');

const closureEvidence = await readJson(join(extractPath, 'github-closure-evidence.json'));
const candidateEvidence = await readJson(join(extractPath, 'candidate-artifact/github-validation-evidence.json'));
const batch = await readJson(join(root, `implementation-control/batches/${expectedBatch}.json`));

equal(closureEvidence.schemaVersion, '1.0.0', 'CLOSURE_SCHEMA_VERSION_MISMATCH');
equal(closureEvidence.result, 'PASS', 'CLOSURE_RESULT_MISMATCH');
equal(closureEvidence.mode, 'BATCH_CLOSURE', 'CLOSURE_MODE_MISMATCH');
equal(closureEvidence.repository, handoff.repository, 'CLOSURE_REPOSITORY_MISMATCH');
equal(closureEvidence.operationId, handoff.operation.id, 'CLOSURE_OPERATION_MISMATCH');
equal(closureEvidence.activeBatchId, expectedBatch, 'CLOSURE_BATCH_MISMATCH');
equal(closureEvidence.commitSha, closure.commitSha, 'CLOSURE_EVIDENCE_COMMIT_MISMATCH');
equal(closureEvidence.primaryFailure, null, 'CLOSURE_PRIMARY_FAILURE_PRESENT');
for (const field of ['sha', 'runId', 'artifactId', 'artifactName', 'artifactDigest']) {
  equal(closureEvidence.candidate?.[field], expectedCandidate[field], `CLOSURE_CANDIDATE_${field.toUpperCase()}_MISMATCH`);
}

equal(candidateEvidence.schemaVersion, '1.0.0', 'CANDIDATE_SCHEMA_VERSION_MISMATCH');
equal(candidateEvidence.result, 'PASS', 'CANDIDATE_RESULT_MISMATCH');
equal(candidateEvidence.repository, handoff.repository, 'CANDIDATE_REPOSITORY_MISMATCH');
equal(candidateEvidence.commitSha, expectedCandidate.sha, 'CANDIDATE_COMMIT_MISMATCH');
equal(String(candidateEvidence.runId), String(expectedCandidate.runId), 'CANDIDATE_RUN_MISMATCH');
equal(candidateEvidence.activeBatchId, expectedBatch, 'CANDIDATE_BATCH_MISMATCH');
equal(candidateEvidence.releaseBaseline?.tag, handoff.baseline.tag, 'BASELINE_TAG_MISMATCH');
equal(candidateEvidence.releaseBaseline?.zipSha256, handoff.baseline.zipSha256, 'BASELINE_SHA_MISMATCH');
equal(candidateEvidence.specify?.count, 19, 'SPECIFY_COUNT_MISMATCH');
equal(candidateEvidence.specify?.sha256, handoff.baseline.specifyTreeSha256, 'SPECIFY_TREE_MISMATCH');
equal(candidateEvidence.specify?.byteIdentical, true, 'SPECIFY_IMMUTABILITY_MISMATCH');
equal(JSON.stringify(candidateEvidence.derivedBatchCommands), JSON.stringify(batch.localValidation.commands), 'LITERAL_COMMAND_SET_MISMATCH');
const executed = new Map((candidateEvidence.executedCommands ?? []).map((entry) => [entry.id, entry]));
for (const expected of batch.localValidation.commands.filter((entry) => entry.required)) {
  const observed = executed.get(expected.id);
  assert(observed, 'REQUIRED_COMMAND_MISSING', expected.id);
  equal(observed.command, expected.command, `COMMAND_TEXT_MISMATCH_${expected.id}`);
  equal(observed.status, 'PASS', `COMMAND_RESULT_MISMATCH_${expected.id}`);
  equal(observed.exitCode, 0, `COMMAND_EXIT_CODE_MISMATCH_${expected.id}`);
}

await setOutput('closure_sha', closure.commitSha);
await setOutput('run_id', closure.runId);
await setOutput('artifact_id', closure.artifactId);
console.log(JSON.stringify({
  result: 'PASS',
  closureSha: closure.commitSha,
  requestSha: runInfo.head_sha,
  artifactId: closure.artifactId,
  artifactSha256: closure.artifactDigest,
}, null, 2));
