import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { get } from 'node:https';
import {
  root, exists, listFiles, now, readJson, run, setOutput, shaFile, verifyManifest, writeJson, writeManifest,
} from './GitHub-Common.mjs';
import { canonicalJson, canonicalPathOrder, CLOSURE_PATHS, OPERATION_ID } from './Apply-B20PostRestoreClosure.mjs';

const out = join(root, '.finscope-evidence', 'closure');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local';
const headResult = await run('git rev-parse HEAD', { cwd: root });
const sha = headResult.exitCode === 0 ? headResult.stdout.toString('utf8').trim().toLowerCase() : '0'.repeat(40);
let primaryFailure = null;
const details = [];
const fail = (code, detail = '') => { if (!primaryFailure) primaryFailure = { code, detail }; details.push({ code, detail }); };
const equal = (a, b, code) => { if (a !== b) fail(code, JSON.stringify({ actual: a, expected: b })); };
const digest = (value) => createHash('sha256').update(value).digest('hex');
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\"'\"'")}'`;

async function command(text, code) {
  const result = await run(text, { cwd: root });
  if (result.exitCode !== 0) { fail(code, result.stderr.toString('utf8')); return ''; }
  return result.stdout.toString('utf8').trim();
}
async function api(path, code) {
  const text = await command(`gh api ${shellQuote(`repos/${handoff.repository}/${path}`)}`, code);
  if (!text) return null;
  try { return JSON.parse(text); } catch (error) { fail(`${code}_JSON`, String(error)); return null; }
}
async function downloadArtifact(reference, key, { manifestRequired = true } = {}) {
  const info = await api(`actions/artifacts/${reference.artifactId}`, `${key}_ARTIFACT_LOOKUP_FAILED`);
  if (!info) return null;
  equal(info.name, reference.artifactName, `${key}_ARTIFACT_NAME_MISMATCH`);
  equal(info.digest, reference.artifactDigest, `${key}_ARTIFACT_DIGEST_METADATA_MISMATCH`);
  equal(info.expired, false, `${key}_ARTIFACT_EXPIRED`);
  equal(String(info.workflow_run?.id), String(reference.runId), `${key}_ARTIFACT_RUN_MISMATCH`);
  equal(info.workflow_run?.head_sha, handoff.closure.candidateSha, `${key}_ARTIFACT_HEAD_MISMATCH`);
  const zip = join(out, `${key.toLowerCase()}.zip`);
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  try {
    await new Promise((resolvePromise, reject) => {
      const request = (url, authorized) => get(url, { headers: {
        ...(authorized ? { Authorization: `Bearer ${token}` } : {}),
        'User-Agent': 'FinScope-GitHub', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      } }, (response) => {
        if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) { response.resume(); request(response.headers.location, false); return; }
        if (response.statusCode !== 200) { reject(new Error(`HTTP_${response.statusCode}`)); return; }
        const stream = createWriteStream(zip); response.pipe(stream);
        stream.on('finish', () => stream.close(resolvePromise)); stream.on('error', reject);
      }).on('error', reject);
      request(`https://api.github.com/repos/${handoff.repository}/actions/artifacts/${reference.artifactId}/zip`, true);
    });
    equal(`sha256:${await shaFile(zip)}`, reference.artifactDigest, `${key}_ARTIFACT_BYTES_MISMATCH`);
    const crc = await run(`unzip -tqq ${shellQuote(zip)}`, { cwd: root });
    if (crc.exitCode !== 0) fail(`${key}_ARTIFACT_CRC_FAILED`, crc.stderr.toString('utf8'));
    const names = await run(`unzip -Z1 ${shellQuote(zip)}`, { cwd: root });
    if (names.exitCode !== 0) fail(`${key}_ARTIFACT_LIST_FAILED`, names.stderr.toString('utf8'));
    const exact = new Set();
    const folded = new Set();
    for (const raw of names.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean)) {
      const path = raw.replaceAll('\\', '/');
      if (raw !== path || path.startsWith('/') || /^[A-Za-z]:\//u.test(path) || path.split('/').includes('..') || path.includes('\0')) fail(`${key}_ARTIFACT_UNSAFE_PATH`, raw);
      if (exact.has(path)) fail(`${key}_ARTIFACT_DUPLICATE_PATH`, path);
      exact.add(path);
      const foldedPath = path.normalize('NFC').toLocaleLowerCase('en-US');
      if (folded.has(foldedPath)) fail(`${key}_ARTIFACT_CASE_UNICODE_COLLISION`, path);
      folded.add(foldedPath);
    }
    const modes = await run(`zipinfo -l ${shellQuote(zip)}`, { cwd: root });
    if (modes.exitCode !== 0) fail(`${key}_ARTIFACT_MODE_LIST_FAILED`, modes.stderr.toString('utf8'));
    if (modes.stdout.toString('utf8').split(/\r?\n/u).some((line) => /^l/u.test(line))) fail(`${key}_ARTIFACT_SYMLINK_PRESENT`);
    const directory = join(out, `${key.toLowerCase()}-artifact`);
    await mkdir(directory, { recursive: true });
    const unzip = await run(`unzip -q ${shellQuote(zip)} -d ${shellQuote(directory)}`, { cwd: root });
    if (unzip.exitCode !== 0) fail(`${key}_ARTIFACT_UNZIP_FAILED`, unzip.stderr.toString('utf8'));
    else if (manifestRequired) {
      try {
        const manifestCount = await verifyManifest(directory);
        const fileCount = (await listFiles(directory)).length;
        if (fileCount !== manifestCount + 1) fail(`${key}_ARTIFACT_UNMANIFESTED_FILE`, JSON.stringify({ fileCount, manifestCount }));
      } catch (error) { fail(`${key}_MANIFEST_INVALID`, String(error)); }
    } else if (await exists(join(directory, 'EVIDENCE_MANIFEST.sha256'))) {
      fail(`${key}_UNEXPECTED_MANIFEST_CONTRACT`);
    }
    return directory;
  } catch (error) { fail(`${key}_ARTIFACT_DOWNLOAD_FAILED`, String(error)); return null; }
}
function findFile(base, name) {
  return command(`find ${shellQuote(base)} -type f -name ${shellQuote(name)} -print -quit`, `FIND_${name}_FAILED`);
}

if (headResult.exitCode !== 0 || !/^[0-9a-f]{40}$/u.test(sha)) fail('CHECKED_OUT_SHA_INVALID', headResult.stderr.toString('utf8'));
const candidateNotRequested = handoff.operation?.id === OPERATION_ID
  && branch === handoff.operation?.branch
  && handoff.operation?.stage === 'candidate'
  && handoff.closure?.status === 'NOT_AUTHORIZED'
  && handoff.remediation?.closurePolicy?.status === 'NOT_AUTHORIZED';
if (candidateNotRequested) {
  const evidence = {
    schemaVersion: '2.0.0', result: 'NOT_APPLICABLE', mode: 'B20_POST_RESTORE_CLOSURE',
    repository: process.env.GITHUB_REPOSITORY || handoff.repository, operationId: handoff.operation?.id,
    branch, commitSha: sha, checkedAt: now(), primaryFailure: null,
    changedPaths: [], policySha256: digest(Buffer.from(canonicalJson(CLOSURE_PATHS))), bindingSha256: null,
    details: [{ code: 'CLOSURE_NOT_REQUESTED', detail: 'operation.stage remains candidate and no closure commit exists.' }],
  };
  await writeJson(join(out, 'github-closure-evidence.json'), evidence);
  await writeManifest(out);
  await setOutput('artifact_name', `finscope-closure-${sha.slice(0, 12)}-NOT_APPLICABLE`);
  await setOutput('evidence_dir', relative(root, out).replaceAll('\\', '/'));
  await setOutput('result', 'NOT_APPLICABLE');
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(0);
}
if (handoff.operation?.id !== OPERATION_ID) fail('UNEXPECTED_OPERATION', String(handoff.operation?.id));
if (branch !== handoff.operation?.branch) fail('UNEXPECTED_BRANCH', JSON.stringify({ branch, expected: handoff.operation?.branch }));
if (handoff.operation?.stage !== 'closure') fail('UNEXPECTED_OPERATION_STAGE', String(handoff.operation?.stage));

const closure = handoff.closure ?? {};
const binding = closure.authorizationBinding;
if (closure.status !== 'PENDING' || handoff.remediation?.closurePolicy?.status !== 'PENDING') fail('CLOSURE_REQUEST_STATE_INVALID', JSON.stringify(closure));
if (!binding || closure.candidateSha !== binding.candidateHead) fail('CLOSURE_BINDING_MISSING_OR_MISMATCH', JSON.stringify({ candidateSha: closure.candidateSha }));
const policyHash = digest(Buffer.from(canonicalJson(CLOSURE_PATHS), 'utf8'));
const bindingHash = binding ? digest(Buffer.from(canonicalJson(binding), 'utf8')) : null;
equal(closure.closurePolicySha256, policyHash, 'CLOSURE_POLICY_HASH_MISMATCH');
equal(closure.authorizationBindingSha256, bindingHash, 'CLOSURE_BINDING_HASH_MISMATCH');
const policyPaths = handoff.remediation?.closurePolicy?.allowedPaths ?? [];
equal(JSON.stringify(policyPaths), JSON.stringify(CLOSURE_PATHS), 'CLOSURE_POLICY_PATHS_MISMATCH');
const remediation = new Set(handoff.remediation?.allowedPaths ?? []);
for (const path of CLOSURE_PATHS) if (!remediation.has(path)) fail('CLOSURE_PATH_OUTSIDE_REMEDIATION', path);

const parents = (await command('git show -s --format=%P HEAD', 'CLOSURE_PARENT_LOOKUP_FAILED')).split(/\s+/u).filter(Boolean);
equal(parents.length, 1, 'CLOSURE_PARENT_COUNT_MISMATCH');
equal(parents[0], binding?.candidateHead, 'CLOSURE_PARENT_CANDIDATE_MISMATCH');
const changed = canonicalPathOrder((await command(`git diff --name-only ${shellQuote(binding?.candidateHead ?? '')} HEAD`, 'CLOSURE_DIFF_FAILED')).split(/\r?\n/u).filter(Boolean));
const expectedChanged = canonicalPathOrder(CLOSURE_PATHS);
equal(JSON.stringify(changed), JSON.stringify(expectedChanged), 'CLOSURE_EXACT_ALLOWLIST_MISMATCH');
if (changed.some((path) => /^(?:src|tests|workers|public|specs|\.specify|package(?:-lock)?\.json)(?:\/|$)/u.test(path))) fail('CLOSURE_EXECUTABLE_CHANGE_PRESENT', JSON.stringify(changed));

for (const [key, ref] of Object.entries({
  PR_VALIDATION: binding?.prValidation, RELEASE_QUALIFICATION: binding?.releaseQualification, CLOSURE_PRECHECK: binding?.closurePrecheck,
})) {
  if (!ref) { fail(`${key}_REFERENCE_MISSING`); continue; }
  const runInfo = await api(`actions/runs/${ref.runId}`, `${key}_RUN_LOOKUP_FAILED`);
  if (runInfo) {
    equal(runInfo.head_sha, binding.candidateHead, `${key}_RUN_HEAD_MISMATCH`);
    equal(runInfo.conclusion, 'success', `${key}_RUN_CONCLUSION_MISMATCH`);
    equal(runInfo.event, 'pull_request', `${key}_RUN_EVENT_MISMATCH`);
  }
}

const prDir = binding ? await downloadArtifact(binding.prValidation, 'PR_VALIDATION') : null;
const releaseDir = binding ? await downloadArtifact(binding.releaseQualification, 'RELEASE_QUALIFICATION', { manifestRequired: false }) : null;
const precheckDir = binding ? await downloadArtifact(binding.closurePrecheck, 'CLOSURE_PRECHECK') : null;
if (prDir) {
  const path = await findFile(prDir, 'github-validation-evidence.json');
  if (!path) fail('PR_VALIDATION_EVIDENCE_MISSING'); else {
    const doc = await readJson(path);
    equal(doc.result, 'PASS', 'PR_VALIDATION_RESULT_MISMATCH');
    equal(doc.commitSha, binding.candidateHead, 'PR_VALIDATION_COMMIT_MISMATCH');
    equal(doc.primaryFailure, null, 'PR_VALIDATION_PRIMARY_FAILURE_PRESENT');
    equal(doc.specify?.sha256, binding.authorityHashes.specifyTreeSha256, 'PR_VALIDATION_SPECIFY_HASH_MISMATCH');
  }
}
if (precheckDir) {
  const path = await findFile(precheckDir, 'github-closure-evidence.json');
  if (!path) fail('CLOSURE_PRECHECK_EVIDENCE_MISSING'); else {
    const doc = await readJson(path);
    equal(doc.result, 'NOT_APPLICABLE', 'CLOSURE_PRECHECK_RESULT_MISMATCH');
    equal(doc.commitSha, binding.candidateHead, 'CLOSURE_PRECHECK_COMMIT_MISMATCH');
    equal(doc.primaryFailure, null, 'CLOSURE_PRECHECK_PRIMARY_FAILURE_PRESENT');
    if (!(doc.details ?? []).some((item) => item.code === 'CLOSURE_NOT_REQUESTED')) fail('CLOSURE_PRECHECK_REASON_MISMATCH');
  }
}
if (releaseDir) {
  const zipPath = await findFile(releaseDir, binding.candidatePackage.zipName);
  const sidecarPath = await findFile(releaseDir, binding.candidatePackage.sidecarName);
  const verifierPath = await findFile(releaseDir, 'verifier.stdout.log');
  if (!zipPath || !sidecarPath || !verifierPath) fail('RELEASE_QUALIFICATION_CONTENT_MISSING');
  else {
    equal(await shaFile(zipPath), binding.candidatePackage.zipSha256, 'CANDIDATE_ZIP_HASH_MISMATCH');
    const sidecar = (await readFile(sidecarPath, 'utf8')).trim();
    equal(sidecar, `${binding.candidatePackage.zipSha256}  ${binding.candidatePackage.zipName}`, 'CANDIDATE_SIDECAR_MISMATCH');
    const verifier = JSON.parse(await readFile(verifierPath, 'utf8'));
    equal(verifier.result, 'PASS', 'RELEASE_VERIFIER_RESULT_MISMATCH');
    equal(verifier.commitSha, binding.candidateHead, 'RELEASE_VERIFIER_HEAD_MISMATCH');
    equal(verifier.zipSha256, binding.candidatePackage.zipSha256, 'RELEASE_VERIFIER_ZIP_MISMATCH');
    equal(verifier.tasksSha256, binding.authorityHashes.tasksSha256, 'RELEASE_VERIFIER_TASKS_HASH_MISMATCH');
    equal(verifier.batchHashes?.B20, binding.authorityHashes.b20Sha256, 'RELEASE_VERIFIER_B20_HASH_MISMATCH');
    equal(verifier.batchHashes?.B21, binding.authorityHashes.b21Sha256, 'RELEASE_VERIFIER_B21_HASH_MISMATCH');
  }
}

const result = primaryFailure ? 'FAIL' : 'PASS';
const evidence = {
  schemaVersion: '2.0.0', result, mode: 'B20_POST_RESTORE_CLOSURE', repository: handoff.repository,
  operationId: handoff.operation.id, branch, commitSha: sha, parentCandidateSha: binding?.candidateHead ?? null,
  checkedAt: now(), changedPaths: changed, policySha256: policyHash, bindingSha256: bindingHash,
  candidateArtifacts: binding ? { prValidation: binding.prValidation, releaseQualification: binding.releaseQualification, closurePrecheck: binding.closurePrecheck } : null,
  primaryFailure, details,
};
await writeJson(join(out, 'github-closure-evidence.json'), evidence);
await writeManifest(out);
await setOutput('artifact_name', `finscope-closure-${sha.slice(0, 12)}-${result === 'PASS' ? 'PASS' : '_FAILED'}`);
await setOutput('evidence_dir', relative(root, out).replaceAll('\\', '/'));
await setOutput('result', result);
console.log(JSON.stringify(evidence, null, 2));
