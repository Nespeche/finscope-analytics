import { createWriteStream } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { get } from 'node:https';
import { join, relative } from 'node:path';
import {
  canonicalTreeHash,
  now,
  readJson,
  root,
  run,
  setOutput,
  shaFile,
  validateJsonFile,
  verifyManifest,
  writeJson,
  writeManifest,
} from './GitHub-Common.mjs';
import { resolveGitHubClosureContext } from './Resolve-GitHubContext.mjs';
import { validateRemediationCandidateEvidence, validateRemediationProductState } from './Apply-GitHubRemediationClosure.mjs';

const out = join(root, '.finscope-evidence', 'closure');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const state = await readJson(join(root, 'implementation-control/IMPLEMENTATION_STATE.json'));
const branch = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
const headResult = await run('git rev-parse HEAD', { cwd: root });
const sha = headResult.exitCode === 0 ? headResult.stdout.toString('utf8').trim().toLowerCase() : '0'.repeat(40);
const derivedRoute = resolveGitHubClosureContext({ branch, handoff });
const closureType = process.env.FINSCOPE_CLOSURE_TYPE ?? derivedRoute.closureType;

async function outputs(result) {
  await setOutput('artifact_name', `finscope-closure-${sha.slice(0, 12)}-${result === 'PASS' ? 'PASS' : result === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : '_FAILED'}`);
  await setOutput('evidence_dir', relative(root, out).replaceAll('\\', '/'));
  await setOutput('result', result);
}

async function validateRemediationClosureEvidence(path) {
  const schemaPath = join(root, 'implementation-control/schemas/github-remediation-closure-evidence.schema.json');
  await validateJsonFile(schemaPath, path);
  const [{ default: Ajv2020 }, schema, document] = await Promise.all([import('ajv/dist/2020.js'), readJson(schemaPath), readJson(path)]);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(document)) throw new Error(`REMEDIATION_CLOSURE_EVIDENCE_AJV_INVALID:${JSON.stringify(validate.errors)}`);
}

function baseRemediationEvidence(route) {
  let product = { b21Status: 'UNKNOWN', b22Status: 'UNKNOWN', convergenceAuthorized: false };
  try { product = validateRemediationProductState(state); } catch { product = { b21Status: state.batchStatus?.B21 ?? 'UNKNOWN', b22Status: state.batchStatus?.B22 ?? 'UNKNOWN', convergenceAuthorized: false }; }
  return {
    schemaVersion: '1.0.0', result: 'FAIL', mode: 'REMEDIATION_CLOSURE', repository: handoff.repository,
    remediationId: route.remediationId ?? null, remediationMode: route.remediationMode ?? null, branch,
    candidateSha: route.candidate?.sha ?? null, closureRequestSha: null, closureCommitSha: null,
    candidateRunId: route.candidate?.runId ?? null, artifactId: route.candidate?.artifactId ?? null,
    artifactName: route.candidate?.artifactName ?? null, artifactDigest: route.candidate?.artifactDigest ?? null,
    artifactSchemaValidation: 'NOT_RUN', manifestValidation: 'NOT_RUN', requiredCommands: 'NOT_RUN', candidateAncestry: 'NOT_RUN',
    changedFiles: [], closureAllowedPaths: route.allowedPaths?.length ? route.allowedPaths : ['implementation-control/GITHUB_HANDOFF.json'],
    productStateUnchanged: false, tasksUnchanged: false, batchesUnchanged: false, specifyByteIdentical: false,
    ...product, checkedAt: now(), primaryFailure: null, details: [],
  };
}

async function writeRemediationEvidence(evidence) {
  const path = join(out, 'github-closure-evidence.json');
  await writeJson(path, evidence);
  await validateRemediationClosureEvidence(path);
  await validateRemediationClosureEvidence(path);
  await writeManifest(out);
  await outputs(evidence.result);
  console.log(JSON.stringify(evidence, null, 2));
}

async function notApplicable(route) {
  const evidence = baseRemediationEvidence(route);
  const remediation = handoff.remediations?.find((entry) => entry.id === route.remediationId);
  const specify = await canonicalTreeHash(join(root, '.specify'));
  evidence.result = 'NOT_APPLICABLE'; evidence.mode = 'NOT_APPLICABLE';
  evidence.productStateUnchanged = true; evidence.tasksUnchanged = true; evidence.batchesUnchanged = true;
  evidence.specifyByteIdentical = specify.sha256 === handoff.completedBaseline.specifyTreeSha256;
  evidence.primaryFailure = null;
  evidence.details = [{ code: 'CLOSURE_NOT_REQUESTED', detail: remediation?.closurePolicy ? `${remediation.closurePolicy.stage}/${remediation.closurePolicy.status}` : 'No authenticated closure request matches this branch.' }];
  await writeRemediationEvidence(evidence);
}

async function runRemediationClosure(route) {
  const evidence = baseRemediationEvidence(route); let primaryFailure = null;
  const fail = (code, detail = '') => { if (!primaryFailure) primaryFailure = { code, detail }; evidence.details.push({ code, detail }); };
  const contextDirectory = process.env.FINSCOPE_CLOSURE_CONTEXT_DIR ?? join(process.env.RUNNER_TEMP ?? root, 'finscope-context');
  let context;
  try { context = await readJson(join(contextDirectory, 'remediation-closure-apply.json')); }
  catch (error) { fail(process.env.APPLY_OUTCOME === 'failure' ? 'REMEDIATION_CLOSURE_APPLY_FAILED' : 'REMEDIATION_CLOSURE_APPLY_CONTEXT_MISSING', String(error)); }
  if (context) {
    Object.assign(evidence, {
      repository: context.repository, remediationId: context.remediationId, remediationMode: context.remediationMode,
      candidateSha: context.candidate.sha, closureRequestSha: context.requestSha, closureCommitSha: context.closureSha,
      candidateRunId: context.candidate.runId, artifactId: context.candidate.artifactId, artifactName: context.candidate.artifactName,
      artifactDigest: context.candidate.artifactDigest, changedFiles: context.changedFiles, closureAllowedPaths: context.allowedPaths,
      productStateUnchanged: context.productStateUnchanged, tasksUnchanged: context.tasksUnchanged, batchesUnchanged: context.batchesUnchanged,
      specifyByteIdentical: context.specifyByteIdentical, b21Status: context.b21Status, b22Status: context.b22Status,
      convergenceAuthorized: context.convergenceAuthorized,
    });
    const ancestry = await run(`git merge-base --is-ancestor "${context.candidate.sha}" "${context.requestSha}"`, { cwd: root });
    evidence.candidateAncestry = ancestry.exitCode === 0 ? 'PASS' : 'FAIL'; if (ancestry.exitCode !== 0) fail('REMEDIATION_CANDIDATE_NOT_ANCESTOR', ancestry.stderr.toString('utf8'));
    const diff = await run(`git diff --name-only "${context.requestSha}" "${context.closureSha}"`, { cwd: root });
    if (diff.exitCode !== 0) fail('REMEDIATION_CLOSURE_DIFF_FAILED', diff.stderr.toString('utf8'));
    else {
      const files = diff.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean); evidence.changedFiles = files;
      const denied = files.filter((path) => !new Set(context.allowedPaths).has(path));
      if (denied.length > 0) fail('REMEDIATION_CLOSURE_ALLOWLIST_VIOLATION', denied.join(','));
    }
    const remediation = handoff.remediations?.find((entry) => entry.id === context.remediationId);
    if (!remediation || remediation.closurePolicy?.stage !== 'completed' || remediation.closurePolicy?.status !== 'COMPLETED' || remediation.closurePolicy?.closure?.requestSha !== context.requestSha) fail('REMEDIATION_CLOSURE_COMPLETION_NOT_RECORDED');
    try {
      const extract = context.artifactExtractPath;
      await verifyManifest(extract); evidence.manifestValidation = 'PASS';
      const candidateEvidencePath = join(extract, 'github-validation-evidence.json');
      const candidateSchemaPath = join(root, 'implementation-control/schemas/github-validation-evidence.schema.json');
      await validateJsonFile(candidateSchemaPath, candidateEvidencePath);
      const [{ default: Ajv2020 }, schema, candidateEvidence] = await Promise.all([import('ajv/dist/2020.js'), readJson(candidateSchemaPath), readJson(candidateEvidencePath)]);
      const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
      if (!validate(candidateEvidence)) throw new Error(JSON.stringify(validate.errors));
      validateRemediationCandidateEvidence({ evidence: candidateEvidence, remediation, candidate: context.candidate, handoff });
      evidence.artifactSchemaValidation = 'PASS'; evidence.requiredCommands = 'PASS';
      await cp(extract, join(out, 'candidate-artifact'), { recursive: true });
    } catch (error) { evidence.manifestValidation = evidence.manifestValidation === 'PASS' ? 'PASS' : 'FAIL'; evidence.artifactSchemaValidation = 'FAIL'; evidence.requiredCommands = 'FAIL'; fail('REMEDIATION_CANDIDATE_ARTIFACT_REVALIDATION_FAILED', String(error)); }
    try {
      validateRemediationProductState(state);
      const specify = await canonicalTreeHash(join(root, '.specify'));
      evidence.specifyByteIdentical = specify.sha256 === handoff.completedBaseline.specifyTreeSha256;
      if (!evidence.specifyByteIdentical) fail('REMEDIATION_SPECIFY_NOT_BYTE_IDENTICAL', specify.sha256);
    } catch (error) { fail(error.code ?? 'REMEDIATION_PRODUCT_STATE_CHANGED', String(error)); }
  }
  if (process.env.APPLY_OUTCOME === 'failure') fail('REMEDIATION_CLOSURE_APPLY_FAILED', 'workflow apply step failed');
  evidence.primaryFailure = primaryFailure; evidence.result = primaryFailure ? 'FAIL' : 'PASS'; evidence.checkedAt = now();
  await writeRemediationEvidence(evidence);
}

async function download(url, destination) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  await new Promise((resolvePromise, reject) => {
    const request = (target, authorized) => get(target, { headers: { ...(authorized ? { Authorization: `Bearer ${token}` } : {}), 'User-Agent': 'FinScope-GitHub', Accept: 'application/vnd.github+json' } }, (response) => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) { response.resume(); request(response.headers.location, false); return; }
      if (response.statusCode !== 200) { reject(new Error(`ARTIFACT_HTTP_${response.statusCode}`)); return; }
      const stream = createWriteStream(destination); response.pipe(stream); stream.on('finish', () => stream.close(resolvePromise)); stream.on('error', reject);
    }).on('error', reject); request(url, true);
  });
}

async function runBatchClosure() {
  const operation = handoff.operation ?? {}; const batchId = operation.activeBatchId ?? handoff.productState?.activeBatchId ?? operation.id;
  let primaryFailure = null; const details = []; const fail = (code, detail) => { if (!primaryFailure) primaryFailure = { code, detail }; details.push({ code, detail }); };
  const candidate = handoff.candidate;
  if (!candidate?.sha || !candidate?.runId || !candidate?.artifactId || !candidate?.artifactName || !candidate?.artifactDigest) fail('CANDIDATE_REFERENCE_INCOMPLETE', JSON.stringify(candidate));
  if (handoff.closure?.candidateSha !== candidate?.sha || handoff.closure?.status !== 'PENDING') fail('CLOSURE_REQUEST_INVALID', JSON.stringify(handoff.closure));
  const escaped = batchId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const allow = [/^implementation-control\/GITHUB_HANDOFF\.json$/u, new RegExp(`^implementation-control/reports/${escaped}_`, 'u'), /^implementation-control\/CHANGE_LEDGER\.md$/u, /^implementation-control\/IMPLEMENTATION_STATE\.json$/u, /^implementation-control\/IMPLEMENTATION_BATCH_MAP\.(?:json|md)$/u, /^implementation-control\/TASK_SOURCE_LOCK\.json$/u, /^implementation-control\/batches\/B\d{2}\.json$/u, /^implementation-control\/AUTHORITY_MATRIX\.json$/u, /^DOCUMENTATION_INDEX\.md$/u, /^START_HERE_CHATGPT\.md$/u, /^PROJECT_CONTEXT\.md$/u, /^V0\.21_PHASE_STATUS\.md$/u, /^PACKAGE_METADATA\.json$/u, /^PACKAGE_INVENTORY\.json$/u, /^FILE_MANIFEST\.sha256$/u, /^specs\/001-fundamental-analysis-platform\/tasks\.md$/u];
  if (!primaryFailure) { const diff = await run(`git diff --name-only ${candidate.sha} ${sha}`, { cwd: root }); if (diff.exitCode !== 0) fail('CLOSURE_DIFF_FAILED', diff.stderr.toString()); else { const files = diff.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean); const denied = files.filter((path) => !allow.some((pattern) => pattern.test(path))); details.push({ code: 'CLOSURE_CHANGED_FILES', detail: JSON.stringify(files) }); if (denied.length) fail('CLOSURE_ALLOWLIST_VIOLATION', JSON.stringify(denied)); } }
  if (!primaryFailure) { const api = await run(`gh api repos/${handoff.repository}/actions/runs/${candidate.runId}`, { cwd: root }); if (api.exitCode !== 0) fail('CANDIDATE_RUN_LOOKUP_FAILED', api.stderr.toString()); else { const runInfo = JSON.parse(api.stdout.toString()); if (runInfo.head_sha !== candidate.sha || runInfo.conclusion !== 'success' || runInfo.event !== 'pull_request') fail('CANDIDATE_RUN_IDENTITY_MISMATCH', JSON.stringify({ head_sha: runInfo.head_sha, conclusion: runInfo.conclusion, event: runInfo.event })); } }
  if (!primaryFailure) { const api = await run(`gh api repos/${handoff.repository}/actions/artifacts/${candidate.artifactId}`, { cwd: root }); if (api.exitCode !== 0) fail('CANDIDATE_ARTIFACT_LOOKUP_FAILED', api.stderr.toString()); else { const artifact = JSON.parse(api.stdout.toString()); if (artifact.name !== candidate.artifactName || artifact.expired || artifact.workflow_run?.head_sha !== candidate.sha || artifact.digest !== candidate.artifactDigest) fail('CANDIDATE_ARTIFACT_IDENTITY_MISMATCH', JSON.stringify({ name: artifact.name, expired: artifact.expired, head_sha: artifact.workflow_run?.head_sha, digest: artifact.digest })); } }
  const zipPath = join(out, 'candidate-artifact.zip'); const extract = join(out, 'candidate-artifact');
  if (!primaryFailure) { try { await download(`https://api.github.com/repos/${handoff.repository}/actions/artifacts/${candidate.artifactId}/zip`, zipPath); const digest = await shaFile(zipPath); if (digest !== candidate.artifactDigest.replace(/^sha256:/u, '')) fail('CANDIDATE_ARTIFACT_DIGEST_MISMATCH', digest); } catch (error) { fail('CANDIDATE_ARTIFACT_DOWNLOAD_FAILED', String(error)); } }
  if (!primaryFailure) { await mkdir(extract); const unzip = await run(`unzip -q "${zipPath}" -d "${extract}"`, { cwd: root }); if (unzip.exitCode !== 0) fail('CANDIDATE_ARTIFACT_UNZIP_FAILED', unzip.stderr.toString()); else { try { await verifyManifest(extract); const evidencePath = join(extract, 'github-validation-evidence.json'); await validateJsonFile(join(root, 'implementation-control/schemas/github-validation-evidence.schema.json'), evidencePath); const document = await readJson(evidencePath); const baseline = document.releaseBaseline ?? {}; if (document.result !== 'PASS' || document.commitSha !== candidate.sha || document.activeBatchId !== batchId || baseline.tag !== handoff.baseline.tag || baseline.zipSha256 !== handoff.baseline.zipSha256) fail('CANDIDATE_EVIDENCE_IDENTITY_MISMATCH', JSON.stringify({ result: document.result, commitSha: document.commitSha, activeBatchId: document.activeBatchId, baselineTag: baseline.tag, baselineSha256: baseline.zipSha256 })); } catch (error) { fail('CANDIDATE_EVIDENCE_INVALID', String(error)); } } }
  const result = primaryFailure ? 'FAIL' : 'PASS'; const evidence = { schemaVersion: '1.0.0', result, mode: 'BATCH_CLOSURE', repository: handoff.repository, operationId: operation.id, activeBatchId: batchId, branch, commitSha: sha, candidate, checkedAt: now(), primaryFailure, details };
  await writeJson(join(out, 'github-closure-evidence.json'), evidence); await writeManifest(out); await outputs(result); console.log(JSON.stringify(evidence, null, 2));
}

if (closureType === 'NOT_APPLICABLE') await notApplicable(derivedRoute);
else if (closureType === 'BATCH_CLOSURE') await runBatchClosure();
else if (closureType === 'REMEDIATION_CLOSURE') await runRemediationClosure(derivedRoute);
else throw new Error(`CLOSURE_TYPE_INVALID:${closureType}`);
