import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  root,
  listFiles,
  run,
  shaFile,
  verifyManifest,
} from './GitHub-Common.mjs';

export const OPERATION_ID = 'b20-post-restore-control-plane-hardening';
export const REPOSITORY = 'Nespeche/finscope-analytics';
export const PR_NUMBER = 46;
export const BASE_BRANCH = 'main';
export const HEAD_BRANCH = 'maintenance/b20-post-restore-control-plane-hardening';
export const AUTHORIZATION_LITERAL = 'AUTHORIZE_B20_POST_RESTORE_CLOSURE_COMMIT';
export const BINDING_BEGIN = 'B20_CLOSURE_BINDING_JSON_BEGIN';
export const BINDING_END = 'B20_CLOSURE_BINDING_JSON_END';
export const OLD_LITERALS = [
  'AUTHORIZE_B20_HARDENING_DERIVED_COMMIT',
  'AUTHORIZE_B20_POST_RESTORE_TAG_RELEASE',
];
export const CLOSURE_PATHS = [
  'README.md',
  'START_HERE_CHATGPT.md',
  'DOCUMENTATION_INDEX.md',
  'V0.21_PHASE_STATUS.md',
  'PACKAGE_METADATA.json',
  'PACKAGE_INVENTORY.json',
  'FILE_MANIFEST.sha256',
  'PROMPT_IMPLEMENTACION_B21.md',
  'implementation-control/GITHUB_HANDOFF.json',
  'implementation-control/IMPLEMENTATION_STATE.json',
];
export function canonicalPathOrder(paths) {
  return [...paths].sort((left, right) => Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8')));
}

export const CANDIDATE_ALLOWED_PATHS = [
  '.github/workflows/finscope-remediation-closure-request.yml',
  '.github/workflows/finscope-closure-validation.yml',
  '.github/workflows/finscope-release-qualification.yml',
  '.github/workflows/finscope-completed-release.yml',
  'implementation-control/scripts/Apply-B20PostRestoreClosure.mjs',
  'implementation-control/scripts/Verify-GitHubClosure.mjs',
  'implementation-control/scripts/Verify-GitHubClosureArtifact.mjs',
  'implementation-control/scripts/Validate-ControlPlaneState.mjs',
  'implementation-control/scripts/Package-GitHubCompletedRelease.mjs',
  'implementation-control/scripts/Verify-GitHubCompletedPackage.mjs',
  'implementation-control/GITHUB_HANDOFF.json',
  'implementation-control/IMPLEMENTATION_STATE.json',
  'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt',
  'README.md',
  'START_HERE_CHATGPT.md',
  'DOCUMENTATION_INDEX.md',
  'V0.21_PHASE_STATUS.md',
  'PROMPT_IMPLEMENTACION_B21.md',
  'PACKAGE_METADATA.json',
  'PACKAGE_INVENTORY.json',
  'FILE_MANIFEST.sha256',
];

const DOC_MARKER_BEGIN = '<!-- B20_CLOSURE_MECHANISM_STATE_BEGIN -->';
const DOC_MARKER_END = '<!-- B20_CLOSURE_MECHANISM_STATE_END -->';
const DERIVED_EXCLUSIONS = new Set(['PACKAGE_INVENTORY.json', 'FILE_MANIFEST.sha256']);

function assert(condition, code, detail = '') {
  if (!condition) throw new Error(`${code}${detail ? `:${detail}` : ''}`);
}
function equal(actual, expected, code) {
  assert(actual === expected, code, JSON.stringify({ actual, expected }));
}
function shaBytes(value) {
  return createHash('sha256').update(value).digest('hex');
}
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

class StrictJsonParser {
  constructor(text) { this.text = text; this.index = 0; }
  error(code) { throw new Error(`${code}:offset=${this.index}`); }
  skip() { while (/\s/u.test(this.text[this.index] ?? '')) this.index += 1; }
  parse() {
    this.skip();
    const value = this.value();
    this.skip();
    if (this.index !== this.text.length) this.error('BINDING_TRAILING_CONTENT');
    return value;
  }
  value() {
    this.skip();
    const char = this.text[this.index];
    if (char === '{') return this.object();
    if (char === '[') return this.array();
    if (char === '"') return this.string();
    if (char === '-' || /[0-9]/u.test(char ?? '')) return this.number();
    for (const [token, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.text.startsWith(token, this.index)) { this.index += token.length; return value; }
    }
    this.error('BINDING_INVALID_VALUE');
  }
  string() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (!escaped && char === '"') {
        this.index += 1;
        try { return JSON.parse(this.text.slice(start, this.index)); } catch { this.error('BINDING_INVALID_STRING'); }
      }
      if (!escaped && char === '\\') escaped = true;
      else escaped = false;
      this.index += 1;
    }
    this.error('BINDING_UNTERMINATED_STRING');
  }
  number() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(this.text.slice(this.index));
    if (!match) this.error('BINDING_INVALID_NUMBER');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) this.error('BINDING_NONFINITE_NUMBER');
    return value;
  }
  array() {
    this.index += 1;
    const output = [];
    this.skip();
    if (this.text[this.index] === ']') { this.index += 1; return output; }
    while (true) {
      output.push(this.value());
      this.skip();
      const char = this.text[this.index];
      if (char === ']') { this.index += 1; return output; }
      if (char !== ',') this.error('BINDING_ARRAY_DELIMITER');
      this.index += 1;
    }
  }
  object() {
    this.index += 1;
    const output = {};
    const keys = new Set();
    this.skip();
    if (this.text[this.index] === '}') { this.index += 1; return output; }
    while (true) {
      this.skip();
      if (this.text[this.index] !== '"') this.error('BINDING_OBJECT_KEY');
      const key = this.string();
      if (keys.has(key)) throw new Error(`BINDING_DUPLICATE_KEY:${key}`);
      keys.add(key);
      this.skip();
      if (this.text[this.index] !== ':') this.error('BINDING_OBJECT_COLON');
      this.index += 1;
      output[key] = this.value();
      this.skip();
      const char = this.text[this.index];
      if (char === '}') { this.index += 1; return output; }
      if (char !== ',') this.error('BINDING_OBJECT_DELIMITER');
      this.index += 1;
    }
  }
}

export function parseCanonicalBinding(text) {
  const raw = String(text).trim();
  const parsed = new StrictJsonParser(raw).parse();
  assert(canonicalJson(parsed) === raw, 'BINDING_NOT_CANONICAL');
  return parsed;
}

function exactKeys(value, expected, code) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${code}_NOT_OBJECT`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${code}_KEYS`, JSON.stringify({ actual, expected: wanted }));
}
function artifactShape(value, code, extra = []) {
  exactKeys(value, ['runId', 'artifactId', 'artifactName', 'artifactDigest', ...extra], code);
  assert(Number.isSafeInteger(value.runId) && value.runId > 0, `${code}_RUN_ID`);
  assert(Number.isSafeInteger(value.artifactId) && value.artifactId > 0, `${code}_ARTIFACT_ID`);
  assert(typeof value.artifactName === 'string' && value.artifactName.length > 0, `${code}_ARTIFACT_NAME`);
  assert(/^sha256:[0-9a-f]{64}$/u.test(value.artifactDigest), `${code}_ARTIFACT_DIGEST`);
}
export function validateBindingShape(binding) {
  exactKeys(binding, [
    'schemaVersion', 'repository', 'pullRequest', 'base', 'branch', 'candidateHead',
    'prValidation', 'releaseQualification', 'closurePrecheck', 'candidatePackage', 'authorityHashes',
  ], 'BINDING');
  equal(binding.schemaVersion, '1.0.0', 'BINDING_SCHEMA_VERSION');
  equal(binding.repository, REPOSITORY, 'BINDING_REPOSITORY');
  equal(binding.pullRequest, PR_NUMBER, 'BINDING_PULL_REQUEST');
  equal(binding.base, BASE_BRANCH, 'BINDING_BASE');
  equal(binding.branch, HEAD_BRANCH, 'BINDING_BRANCH');
  assert(/^[0-9a-f]{40}$/u.test(binding.candidateHead), 'BINDING_CANDIDATE_HEAD');
  artifactShape(binding.prValidation, 'BINDING_PR_VALIDATION');
  artifactShape(binding.releaseQualification, 'BINDING_RELEASE_QUALIFICATION');
  artifactShape(binding.closurePrecheck, 'BINDING_CLOSURE_PRECHECK', ['result', 'reason']);
  equal(binding.closurePrecheck.result, 'NOT_APPLICABLE', 'BINDING_CLOSURE_PRECHECK_RESULT');
  equal(binding.closurePrecheck.reason, 'CLOSURE_NOT_REQUESTED', 'BINDING_CLOSURE_PRECHECK_REASON');
  exactKeys(binding.candidatePackage, ['zipName', 'sidecarName', 'zipSha256', 'releaseRevision'], 'BINDING_CANDIDATE_PACKAGE');
  assert(/^sha256:[0-9a-f]{64}$/u.test(`sha256:${binding.candidatePackage.zipSha256}`), 'BINDING_PACKAGE_SHA');
  exactKeys(binding.authorityHashes, ['specifyTreeSha256', 'tasksSha256', 'b20Sha256', 'b21Sha256'], 'BINDING_AUTHORITY_HASHES');
  for (const [key, value] of Object.entries(binding.authorityHashes)) assert(/^[0-9a-f]{64}$/u.test(value), `BINDING_AUTHORITY_HASH_${key}`);
  return binding;
}

export function extractBindingFromPrBody(body) {
  const text = String(body ?? '');
  const literalLines = text.split(/\r?\n/u).filter((line) => line.trim() === AUTHORIZATION_LITERAL);
  equal(literalLines.length, 1, 'AUTHORIZATION_LITERAL_COUNT');
  for (const literal of OLD_LITERALS) assert(!text.includes(literal), 'OBSOLETE_AUTHORIZATION_LITERAL_PRESENT', literal);
  const beginCount = text.split(BINDING_BEGIN).length - 1;
  const endCount = text.split(BINDING_END).length - 1;
  equal(beginCount, 1, 'BINDING_BEGIN_COUNT');
  equal(endCount, 1, 'BINDING_END_COUNT');
  const begin = text.indexOf(BINDING_BEGIN);
  const end = text.indexOf(BINDING_END);
  assert(begin >= 0 && end > begin, 'BINDING_MARKER_ORDER');
  const raw = text.slice(begin + BINDING_BEGIN.length, end).trim();
  return validateBindingShape(parseCanonicalBinding(raw));
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function gitHead() {
  const result = await run('git rev-parse HEAD', { cwd: root });
  assert(result.exitCode === 0, 'GIT_HEAD_FAILED', result.stderr.toString('utf8'));
  const sha = result.stdout.toString('utf8').trim().toLowerCase();
  assert(/^[0-9a-f]{40}$/u.test(sha), 'GIT_HEAD_INVALID', sha);
  return sha;
}
async function fileSha(relativePath) { return shaFile(join(root, relativePath)); }

export async function validateLocalAuthorities(binding) {
  validateBindingShape(binding);
  const [handoff, state, metadata] = await Promise.all([
    readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json')),
    readJson(join(root, 'implementation-control/IMPLEMENTATION_STATE.json')),
    readJson(join(root, 'PACKAGE_METADATA.json')),
  ]);
  equal(handoff.repository, REPOSITORY, 'HANDOFF_REPOSITORY');
  equal(handoff.operation?.id, OPERATION_ID, 'HANDOFF_OPERATION');
  equal(handoff.operation?.stage, 'candidate', 'HANDOFF_STAGE');
  equal(handoff.operation?.branch, HEAD_BRANCH, 'HANDOFF_BRANCH');
  equal(handoff.closure?.status, 'NOT_AUTHORIZED', 'HANDOFF_CLOSURE_STATUS');
  equal(handoff.remediation?.closurePolicy?.status, 'NOT_AUTHORIZED', 'HANDOFF_CLOSURE_POLICY_STATUS');
  equal(handoff.remediation?.hold, true, 'HANDOFF_HOLD');
  equal(handoff.release?.pending, true, 'HANDOFF_RELEASE_PENDING');
  equal(handoff.release?.authorizationStatus, 'NOT_AUTHORIZED', 'HANDOFF_RELEASE_AUTHORIZATION');
  equal(handoff.productState?.b21Executable, false, 'HANDOFF_B21_EXECUTABLE');
  equal(handoff.productState?.convergenceAuthorized, false, 'HANDOFF_CONVERGENCE');
  equal(handoff.closureMechanism?.authorizationLiteral, AUTHORIZATION_LITERAL, 'HANDOFF_LITERAL');
  equal(handoff.closureMechanism?.workflow, '.github/workflows/finscope-remediation-closure-request.yml', 'HANDOFF_WORKFLOW');
  equal(handoff.closureMechanism?.script, 'implementation-control/scripts/Apply-B20PostRestoreClosure.mjs', 'HANDOFF_SCRIPT');
  equal(handoff.closureMechanism?.bindingBegin, BINDING_BEGIN, 'HANDOFF_BINDING_BEGIN');
  equal(handoff.closureMechanism?.bindingEnd, BINDING_END, 'HANDOFF_BINDING_END');
  assert(JSON.stringify(handoff.remediation?.scopeExpansion?.allowedPaths) === JSON.stringify(CANDIDATE_ALLOWED_PATHS), 'HANDOFF_CANDIDATE_SCOPE_ALLOWLIST');
  assert(JSON.stringify(handoff.remediation?.closurePolicy?.allowedPaths) === JSON.stringify(CLOSURE_PATHS), 'HANDOFF_CLOSURE_ALLOWLIST');
  const allowed = new Set(handoff.remediation.allowedPaths);
  assert(CANDIDATE_ALLOWED_PATHS.every((path) => allowed.has(path)), 'CANDIDATE_SCOPE_NOT_SUBSET');
  assert(CLOSURE_PATHS.every((path) => allowed.has(path)), 'CLOSURE_ALLOWLIST_NOT_SUBSET');

  equal(state.batchStatus?.B20, 'COMPLETED', 'STATE_B20');
  equal(state.taskStatus?.T089, 'COMPLETED', 'STATE_T089');
  equal(state.batchStatus?.B21, 'PENDING', 'STATE_B21');
  equal(state.activeBatchId, 'B21', 'STATE_ACTIVE_BATCH');
  equal(state.nextAuthorizedBatchId, 'B21', 'STATE_NEXT_BATCH');
  equal(state.implementationStatus, 'BLOCKED', 'STATE_IMPLEMENTATION_STATUS');
  equal(state.phaseGate?.convergenceAuthorized, false, 'STATE_CONVERGENCE');
  equal(state.activePackageLogicalName, 'FS_v0.21.25_B20_completed_r4.zip', 'STATE_PACKAGE_IDENTITY');
  equal(metadata.releaseRevision, 'v0.21.25_B20_completed_r4', 'METADATA_RELEASE_REVISION');
  equal(metadata.logicalZipName, 'FS_v0.21.25_B20_completed_r4.zip', 'METADATA_ZIP');
  equal(metadata.finalSha256Sidecar, 'FS_v0.21.25_B20_completed_r4.zip.sha256', 'METADATA_SIDECAR');

  const head = await gitHead();
  equal(head, binding.candidateHead, 'BINDING_HEAD_NOT_CHECKED_OUT');
  equal(binding.candidatePackage.zipName, handoff.release.zipName, 'BINDING_ZIP');
  equal(binding.candidatePackage.sidecarName, handoff.release.sidecarName, 'BINDING_SIDECAR');
  equal(binding.candidatePackage.releaseRevision, handoff.release.releaseRevision, 'BINDING_RELEASE_REVISION');
  equal(binding.authorityHashes.specifyTreeSha256, handoff.baseline.specifyTreeSha256, 'BINDING_SPECIFY_HASH');
  equal(binding.authorityHashes.tasksSha256, await fileSha('specs/001-fundamental-analysis-platform/tasks.md'), 'BINDING_TASKS_HASH');
  equal(binding.authorityHashes.b20Sha256, await fileSha('implementation-control/batches/B20.json'), 'BINDING_B20_HASH');
  equal(binding.authorityHashes.b21Sha256, await fileSha('implementation-control/batches/B21.json'), 'BINDING_B21_HASH');
  return { handoff, state, metadata, head };
}

async function api(path, token) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FinScope-Closure-Gate',
    },
  });
  const text = await response.text();
  assert(response.ok, 'GITHUB_API_FAILED', `${path}:${response.status}:${text.slice(0, 500)}`);
  return JSON.parse(text);
}
async function downloadArtifact(artifact, token, destination) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${artifact.artifactId}/zip`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FinScope-Closure-Gate',
    },
    redirect: 'follow',
  });
  assert(response.ok, 'ARTIFACT_DOWNLOAD_FAILED', `${artifact.artifactId}:${response.status}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  equal(`sha256:${await shaFile(destination)}`, artifact.artifactDigest, 'ARTIFACT_BYTES_DIGEST');
}
function shellQuote(value) { return `'${String(value).replaceAll("'", "'\"'\"'")}'`; }
async function safeExtract(zipPath, out) {
  const crc = await run(`unzip -tqq ${shellQuote(zipPath)}`, { cwd: root });
  assert(crc.exitCode === 0, 'ARTIFACT_CRC_FAILED', crc.stderr.toString('utf8'));
  const list = await run(`unzip -Z1 ${shellQuote(zipPath)}`, { cwd: root });
  assert(list.exitCode === 0, 'ARTIFACT_LIST_FAILED', list.stderr.toString('utf8'));
  const exact = new Set();
  const folded = new Set();
  for (const raw of list.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean)) {
    const path = raw.replaceAll('\\', '/');
    assert(raw === path && !path.startsWith('/') && !/^[A-Za-z]:\//u.test(path), 'ARTIFACT_ABSOLUTE_OR_BACKSLASH_PATH', raw);
    assert(!path.split('/').includes('..') && !path.includes('\0'), 'ARTIFACT_TRAVERSAL', raw);
    assert(!exact.has(path), 'ARTIFACT_DUPLICATE_PATH', path);
    exact.add(path);
    const key = path.normalize('NFC').toLocaleLowerCase('en-US');
    assert(!folded.has(key), 'ARTIFACT_CASE_UNICODE_COLLISION', path);
    folded.add(key);
  }
  const modes = await run(`zipinfo -l ${shellQuote(zipPath)}`, { cwd: root });
  assert(modes.exitCode === 0, 'ARTIFACT_MODE_LIST_FAILED', modes.stderr.toString('utf8'));
  assert(!modes.stdout.toString('utf8').split(/\r?\n/u).some((line) => /^l/u.test(line)), 'ARTIFACT_SYMLINK_PRESENT');
  await mkdir(out, { recursive: true });
  const extract = await run(`unzip -q ${shellQuote(zipPath)} -d ${shellQuote(out)}`, { cwd: root });
  assert(extract.exitCode === 0, 'ARTIFACT_EXTRACTION_FAILED', extract.stderr.toString('utf8'));
}
async function verifyRunArtifact(binding, artifact, token, label, work) {
  const runInfo = await api(`actions/runs/${artifact.runId}`, token);
  equal(runInfo.head_sha, binding.candidateHead, `${label}_RUN_HEAD`);
  equal(runInfo.conclusion, 'success', `${label}_RUN_CONCLUSION`);
  equal(runInfo.event, 'pull_request', `${label}_RUN_EVENT`);
  const artifactInfo = await api(`actions/artifacts/${artifact.artifactId}`, token);
  equal(artifactInfo.name, artifact.artifactName, `${label}_ARTIFACT_NAME`);
  equal(artifactInfo.digest, artifact.artifactDigest, `${label}_ARTIFACT_DIGEST`);
  equal(artifactInfo.expired, false, `${label}_ARTIFACT_EXPIRED`);
  equal(String(artifactInfo.workflow_run?.id), String(artifact.runId), `${label}_ARTIFACT_RUN`);
  equal(artifactInfo.workflow_run?.head_sha, binding.candidateHead, `${label}_ARTIFACT_HEAD`);
  const zip = join(work, `${label}.zip`);
  const extract = join(work, label);
  await downloadArtifact(artifact, token, zip);
  await safeExtract(zip, extract);
  return extract;
}
export async function verifyRemoteBinding(binding) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  assert(token, 'GITHUB_TOKEN_MISSING');
  equal(process.env.GITHUB_ACTOR, process.env.GITHUB_REPOSITORY_OWNER, 'ACTOR_NOT_REPOSITORY_OWNER');
  const pr = await api(`pulls/${PR_NUMBER}`, token);
  equal(pr.state, 'open', 'PR_NOT_OPEN');
  equal(pr.draft, true, 'PR_NOT_DRAFT');
  equal(pr.base?.ref, BASE_BRANCH, 'PR_BASE');
  equal(pr.head?.ref, HEAD_BRANCH, 'PR_BRANCH');
  equal(pr.head?.repo?.full_name, REPOSITORY, 'PR_HEAD_REPOSITORY');
  equal(pr.head?.sha, binding.candidateHead, 'PR_HEAD_CHANGED');
  const remoteBinding = extractBindingFromPrBody(pr.body ?? '');
  equal(canonicalJson(remoteBinding), canonicalJson(binding), 'PR_BODY_BINDING_CHANGED');
  const ref = await api(`git/ref/heads/${HEAD_BRANCH}`, token);
  equal(ref.object?.sha, binding.candidateHead, 'REMOTE_HEAD_CHANGED');

  const work = await mkdtemp(join(tmpdir(), 'finscope-closure-binding-'));
  try {
    const prRoot = await verifyRunArtifact(binding, binding.prValidation, token, 'pr-validation', work);
    const prManifestCount = await verifyManifest(prRoot);
    equal((await listFiles(prRoot)).length, prManifestCount + 1, 'PR_ARTIFACT_UNMANIFESTED_FILE');
    const prEvidence = await readJson(join(prRoot, 'github-validation-evidence.json'));
    equal(prEvidence.result, 'PASS', 'PR_EVIDENCE_RESULT');
    equal(prEvidence.commitSha, binding.candidateHead, 'PR_EVIDENCE_HEAD');
    equal(String(prEvidence.runId), String(binding.prValidation.runId), 'PR_EVIDENCE_RUN');
    equal(prEvidence.primaryFailure, null, 'PR_EVIDENCE_PRIMARY_FAILURE');

    const releaseRoot = await verifyRunArtifact(binding, binding.releaseQualification, token, 'release-qualification', work);
    const candidateZip = join(releaseRoot, '.finscope-release', binding.candidatePackage.zipName);
    const candidateSidecar = join(releaseRoot, '.finscope-release', binding.candidatePackage.sidecarName);
    const sidecarText = (await readFile(candidateSidecar, 'utf8')).trim();
    const sidecarMatch = /^([0-9a-f]{64})  (.+)$/u.exec(sidecarText);
    assert(sidecarMatch, 'CANDIDATE_SIDECAR_FORMAT');
    equal(sidecarMatch[1], binding.candidatePackage.zipSha256, 'CANDIDATE_SIDECAR_SHA');
    equal(sidecarMatch[2], binding.candidatePackage.zipName, 'CANDIDATE_SIDECAR_NAME');
    equal(await shaFile(candidateZip), binding.candidatePackage.zipSha256, 'CANDIDATE_ZIP_SHA');
    const candidateCrc = await run(`unzip -tqq ${shellQuote(candidateZip)}`, { cwd: root });
    assert(candidateCrc.exitCode === 0, 'CANDIDATE_ZIP_CRC', candidateCrc.stderr.toString('utf8'));
    const generation = await readJson(join(releaseRoot, '.finscope-release', 'package-generation.json'));
    equal(generation.commitSha, binding.candidateHead, 'PACKAGE_GENERATION_HEAD');
    equal(generation.zipName, binding.candidatePackage.zipName, 'PACKAGE_GENERATION_ZIP');
    equal(generation.zipSha256, binding.candidatePackage.zipSha256, 'PACKAGE_GENERATION_SHA');
    const verifierText = await readFile(join(releaseRoot, '.finscope-release', 'verifier.stdout.log'), 'utf8');
    const verifier = JSON.parse(verifierText);
    equal(verifier.result, 'PASS', 'PACKAGE_VERIFIER_RESULT');
    equal(verifier.commitSha, binding.candidateHead, 'PACKAGE_VERIFIER_HEAD');
    equal(verifier.zipSha256, binding.candidatePackage.zipSha256, 'PACKAGE_VERIFIER_SHA');

    const closureRoot = await verifyRunArtifact(binding, binding.closurePrecheck, token, 'closure-precheck', work);
    const closureManifestCount = await verifyManifest(closureRoot);
    equal((await listFiles(closureRoot)).length, closureManifestCount + 1, 'CLOSURE_ARTIFACT_UNMANIFESTED_FILE');
    const closureEvidence = await readJson(join(closureRoot, 'github-closure-evidence.json'));
    equal(closureEvidence.result, 'NOT_APPLICABLE', 'CLOSURE_PRECHECK_RESULT');
    equal(closureEvidence.commitSha, binding.candidateHead, 'CLOSURE_PRECHECK_HEAD');
    equal(closureEvidence.primaryFailure, null, 'CLOSURE_PRECHECK_PRIMARY_FAILURE');
    assert((closureEvidence.details ?? []).some((item) => item.code === 'CLOSURE_NOT_REQUESTED'), 'CLOSURE_PRECHECK_REASON');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

function replaceMarker(text, content, path) {
  const beginCount = text.split(DOC_MARKER_BEGIN).length - 1;
  const endCount = text.split(DOC_MARKER_END).length - 1;
  equal(beginCount, 1, `DOC_MARKER_BEGIN_${path}`);
  equal(endCount, 1, `DOC_MARKER_END_${path}`);
  const start = text.indexOf(DOC_MARKER_BEGIN);
  const end = text.indexOf(DOC_MARKER_END);
  assert(end > start, `DOC_MARKER_ORDER_${path}`);
  return `${text.slice(0, start)}${DOC_MARKER_BEGIN}\n${content.trim()}\n${DOC_MARKER_END}${text.slice(end + DOC_MARKER_END.length)}`;
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
function status(path) { return path.startsWith('.specify/') ? 'FROZEN' : 'ACTIVE'; }
async function trackedPaths() {
  const result = await run('git ls-files -z', { cwd: root });
  assert(result.exitCode === 0, 'TRACKED_PATHS_FAILED', result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b, 'en'));
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

export async function proposedClosureFiles(binding, authorities) {
  const bindingHash = shaBytes(Buffer.from(canonicalJson(binding), 'utf8'));
  const policyHash = shaBytes(Buffer.from(canonicalJson(CLOSURE_PATHS), 'utf8'));
  const proposed = new Map();
  const closureState = [
    '**Estado:** `REMEDIATION_CLOSURE_PENDING — EXACT_HEAD_VALIDATION_REQUIRED`',
    `- Candidate HEAD: \`${binding.candidateHead}\``,
    `- Binding SHA-256: \`${bindingHash}\``,
    `- Policy SHA-256: \`${policyHash}\``,
    '- B21 continúa bloqueado; Ready, merge, tag/Release, Fuentes y convergencia continúan no autorizados.',
  ].join('\n');
  for (const path of ['README.md', 'START_HERE_CHATGPT.md', 'DOCUMENTATION_INDEX.md', 'V0.21_PHASE_STATUS.md', 'PROMPT_IMPLEMENTACION_B21.md']) {
    const current = await readFile(join(root, path), 'utf8');
    proposed.set(path, Buffer.from(replaceMarker(current, closureState, path), 'utf8'));
  }

  const handoff = structuredClone(authorities.handoff);
  handoff.operation.stage = 'closure';
  handoff.candidate = {
    status: 'PASS_AUTHENTICATED_EXTERNAL',
    sha: binding.candidateHead,
    runId: binding.prValidation.runId,
    artifactId: binding.prValidation.artifactId,
    artifactName: binding.prValidation.artifactName,
    artifactDigest: binding.prValidation.artifactDigest,
  };
  handoff.closure = {
    status: 'PENDING',
    candidateSha: binding.candidateHead,
    commitSha: null,
    runId: null,
    artifactId: null,
    artifactName: null,
    artifactDigest: null,
    authorizationBinding: binding,
    authorizationBindingSha256: bindingHash,
    closurePolicySha256: policyHash,
  };
  handoff.remediation.closurePolicy.status = 'PENDING';
  handoff.closureMechanism.authorizationDisposition = 'CONSUMED_PENDING_EXACT_HEAD_CLOSURE_VALIDATION';
  proposed.set('implementation-control/GITHUB_HANDOFF.json', Buffer.from(`${JSON.stringify(handoff, null, 2)}\n`, 'utf8'));

  const state = structuredClone(authorities.state);
  state.updatedBy = 'Apply-B20PostRestoreClosure.mjs';
  proposed.set('implementation-control/IMPLEMENTATION_STATE.json', Buffer.from(`${JSON.stringify(state, null, 2)}\n`, 'utf8'));

  const metadata = structuredClone(authorities.metadata);
  metadata.inputCandidate = {
    logicalName: binding.candidateHead,
    sha256: binding.candidatePackage.zipSha256,
    sidecarMatch: true,
    disposition: 'CLOSURE_REQUESTED_PENDING_EXACT_HEAD_VALIDATION',
  };
  metadata.remediationClosure = {
    status: 'PENDING',
    candidateHead: binding.candidateHead,
    authorizationBindingSha256: bindingHash,
    closurePolicySha256: policyHash,
  };
  const paths = await trackedPaths();
  const counts = extensionCounts(paths);
  const instructionText = await readFile(join(root, 'implementation-control/PROJECT_CONFIGURATION_INSTRUCTIONS.txt'), 'utf8');
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
  });
  proposed.set('PACKAGE_METADATA.json', Buffer.from(`${JSON.stringify(metadata)}\n`, 'utf8'));

  async function bytes(path) {
    return proposed.get(path) ?? readFile(join(root, path));
  }
  const sourcePaths = paths.filter((path) => !DERIVED_EXCLUSIONS.has(path));
  const files = [];
  for (const path of sourcePaths) {
    const content = await bytes(path);
    files.push({
      path,
      sizeBytes: content.length,
      sha256: shaBytes(content),
      mediaType: mediaType(path),
      category: category(path),
      status: status(path),
    });
  }
  const inventory = {
    inventoryId: `FinScope-${metadata.packageRevision}-package-inventory`,
    packageVersion: metadata.packageRevision,
    generatedOn: metadata.generatedOn,
    root: metadata.rootDirectory,
    resolutionBase: 'packageRoot',
    itemCount: files.length,
    exclusions: [
      { path: 'PACKAGE_INVENTORY.json', reason: 'self-reference excluded' },
      { path: 'FILE_MANIFEST.sha256', reason: 'manifest generated after inventory' },
    ],
    files,
  };
  proposed.set('PACKAGE_INVENTORY.json', Buffer.from(`${JSON.stringify(inventory)}\n`, 'utf8'));
  proposed.set('FILE_MANIFEST.sha256', Buffer.from(`${files.map((item) => `${item.sha256}  ${item.path}`).join('\n')}\n`, 'utf8'));

  const changed = [];
  for (const path of CLOSURE_PATHS) {
    const before = await readFile(join(root, path));
    const after = proposed.get(path);
    assert(after, 'PROPOSED_FILE_MISSING', path);
    assert(!before.equals(after), 'CLOSURE_COMMIT_WOULD_BE_EMPTY_FOR_PATH', path);
    changed.push(path);
  }
  equal(changed.length, 10, 'CLOSURE_CHANGED_PATH_COUNT');
  return { proposed, bindingHash, policyHash, changedPaths: changed };
}

async function writeDryRun(result, outputPath) {
  const directory = outputPath ? resolve(outputPath) : await mkdtemp(join(tmpdir(), 'finscope-closure-dry-run-'));
  await mkdir(directory, { recursive: true });
  const diffParts = [];
  for (const path of result.changedPaths) {
    const before = join(directory, 'before', path);
    const after = join(directory, 'after', path);
    await mkdir(dirname(before), { recursive: true });
    await mkdir(dirname(after), { recursive: true });
    await writeFile(before, await readFile(join(root, path)));
    await writeFile(after, result.proposed.get(path));
    const diff = await run(`diff -u --label ${shellQuote(`a/${path}`)} --label ${shellQuote(`b/${path}`)} ${shellQuote(before)} ${shellQuote(after)}`, { cwd: root });
    assert(diff.exitCode === 0 || diff.exitCode === 1, 'DRY_RUN_DIFF_FAILED', diff.stderr.toString('utf8'));
    diffParts.push(diff.stdout.toString('utf8'));
  }
  await writeFile(join(directory, 'closure.diff'), diffParts.join(''));
  const summary = {
    result: 'DRY_RUN',
    operationId: OPERATION_ID,
    changedPaths: result.changedPaths,
    bindingSha256: result.bindingHash,
    closurePolicySha256: result.policyHash,
    contentSha256: Object.fromEntries(result.changedPaths.map((path) => [path, shaBytes(result.proposed.get(path))])),
  };
  await writeFile(join(directory, 'changed-paths.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return { directory, summary };
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
async function main() {
  if (process.argv.includes('--self-test')) {
    const duplicateRejected = (() => { try { parseCanonicalBinding('{"a":1,"a":2}'); return false; } catch (error) { return String(error).includes('BINDING_DUPLICATE_KEY'); } })();
    const nonCanonicalRejected = (() => { try { parseCanonicalBinding('{"b":2,"a":1}'); return false; } catch (error) { return String(error).includes('BINDING_NOT_CANONICAL'); } })();
    const pathOrderStable = JSON.stringify(canonicalPathOrder([...CLOSURE_PATHS].reverse())) === JSON.stringify(canonicalPathOrder(CLOSURE_PATHS));
    assert(duplicateRejected && nonCanonicalRejected && pathOrderStable, 'SELF_TEST_FAILED');
    console.log(JSON.stringify({ result: 'PASS', duplicateKeyRejected: true, nonCanonicalRejected: true, pathOrderStable: true }, null, 2));
    return;
  }
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run');
  assert(apply !== dryRun, 'MODE_REQUIRED_EXACTLY_ONE');
  const prBodyPath = argValue('--pr-body-file');
  const bindingPath = argValue('--binding-file');
  assert(Boolean(prBodyPath) !== Boolean(bindingPath), 'BINDING_SOURCE_REQUIRED_EXACTLY_ONE');
  const binding = prBodyPath
    ? extractBindingFromPrBody(await readFile(resolve(prBodyPath), 'utf8'))
    : validateBindingShape(parseCanonicalBinding(await readFile(resolve(bindingPath), 'utf8')));
  const authorities = await validateLocalAuthorities(binding);
  if (apply) {
    assert(process.argv.includes('--verify-remote'), 'APPLY_REQUIRES_REMOTE_VERIFICATION');
    await verifyRemoteBinding(binding);
  } else if (process.argv.includes('--verify-remote')) {
    await verifyRemoteBinding(binding);
  }
  const proposal = await proposedClosureFiles(binding, authorities);
  if (dryRun) {
    const output = await writeDryRun(proposal, argValue('--output'));
    console.log(JSON.stringify({ ...output.summary, outputDirectory: output.directory }, null, 2));
    return;
  }
  for (const path of proposal.changedPaths) await writeFile(join(root, path), proposal.proposed.get(path));
  const diff = await run('git diff --name-only', { cwd: root });
  assert(diff.exitCode === 0, 'POST_APPLY_DIFF_FAILED', diff.stderr.toString('utf8'));
  const changed = diff.stdout.toString('utf8').trim().split(/\r?\n/u).filter(Boolean);
  const actualPaths = canonicalPathOrder(changed);
  const expectedPaths = canonicalPathOrder(CLOSURE_PATHS);
  assert(JSON.stringify(actualPaths) === JSON.stringify(expectedPaths), 'POST_APPLY_SCOPE_MISMATCH', JSON.stringify({ actualPaths, expectedPaths }));
  console.log(JSON.stringify({
    result: 'APPLIED_LOCALLY_PENDING_ATOMIC_COMMIT',
    operationId: OPERATION_ID,
    changedPaths: proposal.changedPaths,
    bindingSha256: proposal.bindingHash,
    closurePolicySha256: proposal.policyHash,
  }, null, 2));
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) await main();
