import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { listFiles, readJson, root, run, shaFile, verifyManifest } from './GitHub-Common.mjs';

const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const closureCommitSha = process.env.CLOSURE_COMMIT_SHA;
const runId = Number(process.env.CLOSURE_RUN_ID);
const artifactId = Number(process.env.CLOSURE_ARTIFACT_ID);
const artifactName = process.env.CLOSURE_ARTIFACT_NAME;
const artifactDigest = process.env.CLOSURE_ARTIFACT_DIGEST;
const expectedMainSha = process.env.EXPECTED_MAIN_SHA;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
function assert(value, code, detail = '') { if (!value) throw new Error(`${code}${detail ? `:${detail}` : ''}`); }
function equal(a, b, code) { assert(a === b, code, JSON.stringify({ actual: a, expected: b })); }
function quote(value) { return `'${String(value).replaceAll("'", "'\"'\"'")}'`; }
async function command(text, code) { const result = await run(text, { cwd: root }); assert(result.exitCode === 0, code, result.stderr.toString('utf8')); return result.stdout.toString('utf8').trim(); }
async function api(path) { return JSON.parse(await command(`gh api ${quote(`repos/${handoff.repository}/${path}`)}`, 'GITHUB_API_FAILED')); }

assert(handoff.operation?.id === 'b20-post-restore-control-plane-hardening', 'UNEXPECTED_OPERATION');
assert(handoff.operation?.stage === 'closure', 'CLOSURE_STAGE_REQUIRED');
assert(handoff.closure?.status === 'PENDING', 'CLOSURE_PENDING_REQUIRED');
assert(/^[0-9a-f]{40}$/u.test(closureCommitSha ?? ''), 'CLOSURE_COMMIT_SHA_INVALID');
assert(Number.isSafeInteger(runId) && runId > 0, 'CLOSURE_RUN_ID_INVALID');
assert(Number.isSafeInteger(artifactId) && artifactId > 0, 'CLOSURE_ARTIFACT_ID_INVALID');
assert(artifactName, 'CLOSURE_ARTIFACT_NAME_MISSING');
assert(/^sha256:[0-9a-f]{64}$/u.test(artifactDigest ?? ''), 'CLOSURE_ARTIFACT_DIGEST_INVALID');
assert(/^[0-9a-f]{40}$/u.test(expectedMainSha ?? ''), 'EXPECTED_MAIN_SHA_INVALID');

const runInfo = await api(`actions/runs/${runId}`);
equal(runInfo.head_sha, closureCommitSha, 'CLOSURE_RUN_HEAD_MISMATCH');
equal(runInfo.conclusion, 'success', 'CLOSURE_RUN_CONCLUSION_MISMATCH');
equal(runInfo.event, 'pull_request', 'CLOSURE_RUN_EVENT_MISMATCH');
equal(runInfo.name, 'FinScope Closure Validation', 'CLOSURE_RUN_WORKFLOW_MISMATCH');
const artifactInfo = await api(`actions/artifacts/${artifactId}`);
equal(artifactInfo.name, artifactName, 'CLOSURE_ARTIFACT_NAME_MISMATCH');
equal(artifactInfo.digest, artifactDigest, 'CLOSURE_ARTIFACT_DIGEST_METADATA_MISMATCH');
equal(artifactInfo.expired, false, 'CLOSURE_ARTIFACT_EXPIRED');
equal(String(artifactInfo.workflow_run?.id), String(runId), 'CLOSURE_ARTIFACT_RUN_MISMATCH');
equal(artifactInfo.workflow_run?.head_sha, closureCommitSha, 'CLOSURE_ARTIFACT_HEAD_MISMATCH');
await command(`git cat-file -e ${quote(`${closureCommitSha}^{commit}`)}`, 'CLOSURE_COMMIT_MISSING');
await command(`git merge-base --is-ancestor ${quote(closureCommitSha)} ${quote(expectedMainSha)}`, 'CLOSURE_NOT_ANCESTOR_OF_MAIN');

const evidenceRoot = join(root, '.finscope-release', 'closure-authentication');
await rm(evidenceRoot, { recursive: true, force: true });
await mkdir(evidenceRoot, { recursive: true });
const zipPath = join(evidenceRoot, 'closure-artifact.zip');
await command(`curl --fail-with-body --silent --show-error --location --header ${quote(`Authorization: Bearer ${token}`)} --header 'Accept: application/vnd.github+json' --header 'X-GitHub-Api-Version: 2022-11-28' --output ${quote(zipPath)} ${quote(`https://api.github.com/repos/${handoff.repository}/actions/artifacts/${artifactId}/zip`)}`, 'CLOSURE_ARTIFACT_DOWNLOAD_FAILED');
equal(`sha256:${await shaFile(zipPath)}`, artifactDigest, 'CLOSURE_ARTIFACT_BYTES_MISMATCH');
await command(`unzip -tqq ${quote(zipPath)}`, 'CLOSURE_ARTIFACT_CRC_FAILED');
const extract = join(evidenceRoot, 'artifact');
await mkdir(extract, { recursive: true });
await command(`unzip -q ${quote(zipPath)} -d ${quote(extract)}`, 'CLOSURE_ARTIFACT_EXTRACTION_FAILED');
const manifestCount = await verifyManifest(extract);
equal((await listFiles(extract)).length, manifestCount + 1, 'CLOSURE_ARTIFACT_UNMANIFESTED_FILE');
const evidence = await readJson(join(extract, 'github-closure-evidence.json'));
equal(evidence.schemaVersion, '2.0.0', 'CLOSURE_EVIDENCE_SCHEMA_MISMATCH');
equal(evidence.result, 'PASS', 'CLOSURE_EVIDENCE_RESULT_MISMATCH');
equal(evidence.mode, 'B20_POST_RESTORE_CLOSURE', 'CLOSURE_EVIDENCE_MODE_MISMATCH');
equal(evidence.repository, handoff.repository, 'CLOSURE_EVIDENCE_REPOSITORY_MISMATCH');
equal(evidence.operationId, handoff.operation.id, 'CLOSURE_EVIDENCE_OPERATION_MISMATCH');
equal(evidence.commitSha, closureCommitSha, 'CLOSURE_EVIDENCE_COMMIT_MISMATCH');
equal(evidence.parentCandidateSha, handoff.closure.candidateSha, 'CLOSURE_EVIDENCE_PARENT_MISMATCH');
equal(evidence.primaryFailure, null, 'CLOSURE_EVIDENCE_PRIMARY_FAILURE_PRESENT');
const evidencePaths = [...(evidence.changedPaths ?? [])].sort((a, b) => a.localeCompare(b, 'en'));
const policyPaths = [...(handoff.remediation.closurePolicy.allowedPaths ?? [])].sort((a, b) => a.localeCompare(b, 'en'));
equal(JSON.stringify(evidencePaths), JSON.stringify(policyPaths), 'CLOSURE_EVIDENCE_PATHS_MISMATCH');
equal(evidence.policySha256, handoff.closure.closurePolicySha256, 'CLOSURE_EVIDENCE_POLICY_HASH_MISMATCH');
equal(evidence.bindingSha256, handoff.closure.authorizationBindingSha256, 'CLOSURE_EVIDENCE_BINDING_HASH_MISMATCH');
console.log(JSON.stringify({ result: 'PASS', closureCommitSha, runId, artifactId, artifactName, artifactDigest, expectedMainSha }, null, 2));
