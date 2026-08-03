import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
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
import {
  assertClosureWorkflowOutcomes,
  remediationClosureArtifactName,
  validateRemediationCandidateEvidence,
  validateRemediationProductState,
} from './Apply-GitHubRemediationClosure.mjs';

const out = join(root, '.finscope-evidence', 'closure');
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
const handoff = await readJson(join(root, 'implementation-control/GITHUB_HANDOFF.json'));
const state = await readJson(join(root, 'implementation-control/IMPLEMENTATION_STATE.json'));
const branch = process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
const headResult = await run('git rev-parse HEAD', { cwd: root });
const sha = headResult.exitCode === 0 ? headResult.stdout.toString('utf8').trim().toLowerCase() : '0'.repeat(40);
const derivedRoute = resolveGitHubClosureContext({ branch, handoff });
const closureType = process.env.FINSCOPE_CLOSURE_TYPE ?? derivedRoute.closureType;
const verificationPhase = process.env.FINSCOPE_VERIFICATION_PHASE ?? 'remote';

async function outputs(result) {
  await setOutput('artifact_name', remediationClosureArtifactName(sha, result));
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
    localValidation: 'NOT_RUN', controlPlaneValidation: 'NOT_RUN', remotePushValidation: 'NOT_RUN',
    remoteBranchVerified: false, remoteHeadSha: null,
  };
}

async function writeRemediationEvidence(evidence) {
  const path = join(out, 'github-closure-evidence.json');
  await writeJson(path, evidence);
  await validateRemediationClosureEvidence(path);
  await writeManifest(out);
  await outputs(evidence.result);
  console.log(JSON.stringify(evidence, null, 2));
}

const applyLogLimit = 64 * 1024;
const applyDetailLimit = 4 * 1024;

function sanitizeApplyLog(value, secrets = []) {
  let text = String(value).replaceAll('\0', '');
  for (const secret of secrets.filter((entry) => typeof entry === 'string' && entry.length > 0)) text = text.replaceAll(secret, '[REDACTED]');
  text = text
    .replace(/\bgh[a-z]_[A-Za-z0-9_]{8,}\b/gu, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{8,}\b/gu, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(authorization\s*:\s*(?:bearer|token)\s+)[^\s]+/giu, '$1[REDACTED]');
  return text.length > applyLogLimit ? `${text.slice(0, applyLogLimit)}\n[TRUNCATED_AT_${applyLogLimit}_CHARACTERS]\n` : text;
}

export async function collectApplyFailureDiagnostics(contextDirectory, evidenceDirectory, options = {}) {
  const secrets = options.secrets ?? [process.env.GH_TOKEN, process.env.GITHUB_TOKEN];
  const names = ['apply.exit-code', 'apply.stdout.log', 'apply.stderr.log'];
  const contents = new Map(); const logs = [];
  await mkdir(evidenceDirectory, { recursive: true });
  for (const name of names) {
    try {
      const sanitized = sanitizeApplyLog(await readFile(join(contextDirectory, name), 'utf8'), secrets);
      const destination = join(evidenceDirectory, name);
      await writeFile(destination, sanitized, 'utf8');
      const sha256 = await shaFile(destination);
      contents.set(name, sanitized); logs.push({ path: name, sha256: `sha256:${sha256}` });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const combined = `${contents.get('apply.stderr.log') ?? ''}\n${contents.get('apply.stdout.log') ?? ''}`;
  const codes = [...combined.matchAll(/\b(REMEDIATION_[A-Z0-9_]+)\b/gu)].map((match) => match[1]);
  const code = codes.find((entry) => !['REMEDIATION_CLOSURE_APPLY_CONTEXT_MISSING', 'REMEDIATION_CLOSURE_APPLY_FAILED'].includes(entry)) ?? 'REMEDIATION_CLOSURE_APPLY_FAILED';
  const line = combined.split(/\r?\n/u).find((entry) => entry.includes(code))?.trim() ?? `apply exited with ${contents.get('apply.exit-code')?.trim() || 'an unknown non-zero code'}`;
  return {
    primaryFailure: { code, detail: line.slice(0, applyDetailLimit) },
    secondaryFailure: {
      code: 'REMEDIATION_CLOSURE_APPLY_CONTEXT_MISSING',
      detail: sanitizeApplyLog(String(options.contextError ?? 'remediation-closure-apply.json missing'), secrets).slice(0, applyDetailLimit),
    },
    logs,
  };
}

async function recordMissingApplyContext({ error, contextDirectory, evidence, fail }) {
  if (process.env.APPLY_OUTCOME !== 'success') {
    try {
      const diagnostic = await collectApplyFailureDiagnostics(contextDirectory, out, { contextError: error });
      fail(diagnostic.primaryFailure.code, diagnostic.primaryFailure.detail);
      for (const log of diagnostic.logs) evidence.details.push({ code: 'REMEDIATION_APPLY_LOG_SHA256', detail: JSON.stringify(log) });
      evidence.details.push(diagnostic.secondaryFailure);
    } catch (diagnosticError) {
      fail('REMEDIATION_CLOSURE_APPLY_FAILED', String(diagnosticError).slice(0, applyDetailLimit));
      evidence.details.push({ code: 'REMEDIATION_CLOSURE_APPLY_CONTEXT_MISSING', detail: sanitizeApplyLog(String(error)).slice(0, applyDetailLimit) });
    }
    return;
  }
  fail('REMEDIATION_CLOSURE_APPLY_CONTEXT_MISSING', sanitizeApplyLog(String(error)).slice(0, applyDetailLimit));
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

async function diffPaths(from, to, paths = []) {
  const pathspec = paths.length > 0 ? ` -- ${paths.map((path) => `"${path}"`).join(' ')}` : '';
  const result = await run(`git diff --name-only "${from}" "${to}"${pathspec}`, { cwd: root });
  if (result.exitCode !== 0) throw new Error(`REMEDIATION_CLOSURE_DIFF_FAILED:${result.stderr.toString('utf8')}`);
  return result.stdout.toString('utf8').split(/\r?\n/u).filter(Boolean).map((path) => path.replaceAll('\\', '/'));
}

async function runRemediationLocalClosure(route) {
  const evidence = baseRemediationEvidence(route); let primaryFailure = null;
  const fail = (code, detail = '') => { if (!primaryFailure) primaryFailure = { code, detail }; evidence.details.push({ code, detail }); };
  const contextDirectory = process.env.FINSCOPE_CLOSURE_CONTEXT_DIR ?? join(process.env.RUNNER_TEMP ?? root, 'finscope-context');
  let context;
  try { context = await readJson(join(contextDirectory, 'remediation-closure-apply.json')); }
  catch (error) { await recordMissingApplyContext({ error, contextDirectory, evidence, fail }); }
  try {
    Object.assign(evidence, assertClosureWorkflowOutcomes({ applyOutcome: process.env.APPLY_OUTCOME, controlPlaneOutcome: process.env.CONTROL_PLANE_OUTCOME }));
  } catch (error) {
    evidence.localValidation = 'FAIL';
    evidence.controlPlaneValidation = process.env.CONTROL_PLANE_OUTCOME === 'success' ? 'PASS' : 'FAIL';
    fail(error.code ?? 'REMEDIATION_WORKFLOW_OUTCOME_INVALID', String(error.detail ?? error.message ?? error));
  }
  if (context) {
    Object.assign(evidence, {
      repository: context.repository, remediationId: context.remediationId, remediationMode: context.remediationMode,
      candidateSha: context.candidate?.sha ?? null, closureRequestSha: context.requestSha, closureCommitSha: context.closureSha,
      candidateRunId: context.candidate?.runId ?? null, artifactId: context.candidate?.artifactId ?? null, artifactName: context.candidate?.artifactName ?? null,
      artifactDigest: context.candidate?.artifactDigest ?? null, changedFiles: context.changedFiles, closureAllowedPaths: context.allowedPaths,
      productStateUnchanged: context.productStateUnchanged, tasksUnchanged: context.tasksUnchanged, batchesUnchanged: context.batchesUnchanged,
      specifyByteIdentical: context.specifyByteIdentical, b21Status: context.b21Status, b22Status: context.b22Status,
      convergenceAuthorized: context.convergenceAuthorized,
    });
    if (context.prepared !== true || context.pushed !== false || context.remoteExpectedHead !== context.requestSha) fail('REMEDIATION_PREPARATION_CONTEXT_INVALID');
    if (sha !== context.closureSha) fail('REMEDIATION_LOCAL_HEAD_MISMATCH', JSON.stringify({ head: sha, closureSha: context.closureSha }));
    const ancestry = await run(`git merge-base --is-ancestor "${context.candidate.sha}" "${context.requestSha}"`, { cwd: root });
    evidence.candidateAncestry = ancestry.exitCode === 0 ? 'PASS' : 'FAIL'; if (ancestry.exitCode !== 0) fail('REMEDIATION_CANDIDATE_NOT_ANCESTOR', ancestry.stderr.toString('utf8'));
    try {
      const files = await diffPaths(context.requestSha, context.closureSha); evidence.changedFiles = files;
      const denied = files.filter((path) => !new Set(context.allowedPaths).has(path));
      if (denied.length > 0) fail('REMEDIATION_CLOSURE_ALLOWLIST_VIOLATION', denied.join(','));
      const tasksChanged = await diffPaths(context.requestSha, context.closureSha, ['specs/001-fundamental-analysis-platform/tasks.md']);
      const stateChanged = await diffPaths(context.requestSha, context.closureSha, ['implementation-control/IMPLEMENTATION_STATE.json']);
      const batchesChanged = await diffPaths(context.requestSha, context.closureSha, ['implementation-control/batches']);
      const productChanged = await diffPaths(context.requestSha, context.closureSha, ['src', 'workers', 'public', 'index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json']);
      const specifyChanged = await diffPaths(context.requestSha, context.closureSha, ['.specify']);
      evidence.tasksUnchanged = tasksChanged.length === 0; evidence.batchesUnchanged = batchesChanged.length === 0;
      evidence.productStateUnchanged = stateChanged.length === 0 && productChanged.length === 0;
      evidence.specifyByteIdentical = specifyChanged.length === 0;
      if (!evidence.tasksUnchanged) fail('REMEDIATION_TASKS_CHANGED', tasksChanged.join(','));
      if (stateChanged.length > 0) fail('REMEDIATION_IMPLEMENTATION_STATE_CHANGED', stateChanged.join(','));
      if (!evidence.batchesUnchanged) fail('REMEDIATION_BATCHES_CHANGED', batchesChanged.join(','));
      if (productChanged.length > 0) fail('REMEDIATION_PRODUCT_CHANGED', productChanged.join(','));
      if (!evidence.specifyByteIdentical) fail('REMEDIATION_SPECIFY_CHANGED', specifyChanged.join(','));
    } catch (error) { fail(error.code ?? 'REMEDIATION_CLOSURE_DIFF_FAILED', String(error.message ?? error)); }
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
    } catch (error) { evidence.manifestValidation = evidence.manifestValidation === 'PASS' ? 'PASS' : 'FAIL'; evidence.artifactSchemaValidation = 'FAIL'; evidence.requiredCommands = 'FAIL'; fail('REMEDIATION_CANDIDATE_ARTIFACT_REVALIDATION_FAILED', String(error)); }
    try {
      validateRemediationProductState(state);
      const specify = await canonicalTreeHash(join(root, '.specify'));
      evidence.specifyByteIdentical = specify.sha256 === handoff.completedBaseline.specifyTreeSha256;
      if (!evidence.specifyByteIdentical) fail('REMEDIATION_SPECIFY_NOT_BYTE_IDENTICAL', specify.sha256);
    } catch (error) { fail(error.code ?? 'REMEDIATION_PRODUCT_STATE_CHANGED', String(error)); }
  }
  evidence.primaryFailure = primaryFailure; evidence.result = primaryFailure ? 'FAIL' : 'PASS'; evidence.checkedAt = now();
  const localContext = {
    ...evidence, requestSha: context?.requestSha ?? null, closureSha: context?.closureSha ?? null,
    candidateSha: context?.candidateSha ?? context?.candidate?.sha ?? null, prepared: context?.prepared === true,
    pushed: false, artifactExtractPath: context?.artifactExtractPath ?? null,
  };
  await writeJson(join(contextDirectory, 'remediation-closure-local-verification.json'), localContext);
  await setOutput('result', evidence.result);
  console.log(JSON.stringify(localContext, null, 2));
}

async function remoteBranchHead(branchName) {
  if (!/^(?!\/)(?!.*(?:\.\.|\/\/|@\{))[A-Za-z0-9._/-]+(?<!\/)$/u.test(branchName ?? '')) throw new Error(`REMEDIATION_REMOTE_BRANCH_INVALID:${String(branchName)}`);
  const result = await run(`git ls-remote --heads origin "refs/heads/${branchName}"`, { cwd: root });
  if (result.exitCode !== 0) throw new Error(`REMEDIATION_REMOTE_HEAD_LOOKUP_FAILED:${result.stderr.toString('utf8')}`);
  const lines = result.stdout.toString('utf8').trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1) throw new Error(`REMEDIATION_REMOTE_BRANCH_NOT_UNIQUE:${JSON.stringify(lines)}`);
  const match = /^([0-9a-f]{40})\s+refs\/heads\/(.+)$/u.exec(lines[0]);
  if (!match || match[2] !== branchName) throw new Error(`REMEDIATION_REMOTE_HEAD_INVALID:${lines[0]}`);
  return match[1];
}

async function runRemediationRemoteClosure(route) {
  const evidence = baseRemediationEvidence(route); let primaryFailure = null;
  const fail = (code, detail = '') => { if (!primaryFailure) primaryFailure = { code, detail }; evidence.details.push({ code, detail }); };
  const contextDirectory = process.env.FINSCOPE_CLOSURE_CONTEXT_DIR ?? join(process.env.RUNNER_TEMP ?? root, 'finscope-context');
  let applyContext; let localContext; let pushContext;
  try { applyContext = await readJson(join(contextDirectory, 'remediation-closure-apply.json')); } catch (error) { await recordMissingApplyContext({ error, contextDirectory, evidence, fail }); }
  try { localContext = await readJson(join(contextDirectory, 'remediation-closure-local-verification.json')); } catch (error) { fail('REMEDIATION_LOCAL_VALIDATION_CONTEXT_MISSING', String(error)); }
  try { pushContext = await readJson(join(contextDirectory, 'remediation-closure-push.json')); } catch (error) { fail('REMEDIATION_PUSH_CONTEXT_MISSING', String(error)); }
  try { assertClosureWorkflowOutcomes({ applyOutcome: process.env.APPLY_OUTCOME, controlPlaneOutcome: process.env.CONTROL_PLANE_OUTCOME }); }
  catch (error) { fail(error.code ?? 'REMEDIATION_WORKFLOW_OUTCOME_INVALID', String(error.detail ?? error.message ?? error)); }
  if (process.env.LOCAL_VERIFY_OUTCOME !== 'success' || localContext?.result !== 'PASS') fail('REMEDIATION_LOCAL_VALIDATION_NOT_PASS', `${process.env.LOCAL_VERIFY_OUTCOME ?? 'missing'}/${localContext?.result ?? 'missing'}`);
  if (process.env.FINALIZE_OUTCOME !== 'success' || pushContext?.result !== 'PASS') fail('REMEDIATION_REMOTE_PUSH_NOT_PASS', `${process.env.FINALIZE_OUTCOME ?? 'missing'}/${pushContext?.result ?? 'missing'}`);
  if (applyContext && localContext) {
    Object.assign(evidence, {
      repository: applyContext.repository, remediationId: applyContext.remediationId, remediationMode: applyContext.remediationMode,
      candidateSha: applyContext.candidate?.sha ?? null, closureRequestSha: applyContext.requestSha, closureCommitSha: applyContext.closureSha,
      candidateRunId: applyContext.candidate?.runId ?? null, artifactId: applyContext.candidate?.artifactId ?? null,
      artifactName: applyContext.candidate?.artifactName ?? null, artifactDigest: applyContext.candidate?.artifactDigest ?? null,
      artifactSchemaValidation: localContext.artifactSchemaValidation, manifestValidation: localContext.manifestValidation,
      requiredCommands: localContext.requiredCommands, candidateAncestry: localContext.candidateAncestry,
      changedFiles: localContext.changedFiles, closureAllowedPaths: localContext.closureAllowedPaths,
      productStateUnchanged: localContext.productStateUnchanged, tasksUnchanged: localContext.tasksUnchanged,
      batchesUnchanged: localContext.batchesUnchanged, specifyByteIdentical: localContext.specifyByteIdentical,
      b21Status: localContext.b21Status, b22Status: localContext.b22Status,
      convergenceAuthorized: localContext.convergenceAuthorized, localValidation: localContext.localValidation,
      controlPlaneValidation: localContext.controlPlaneValidation,
    });
    if (applyContext.prepared !== true || applyContext.pushed !== false || localContext.requestSha !== applyContext.requestSha || localContext.closureSha !== applyContext.closureSha) fail('REMEDIATION_PREPARATION_CONTEXT_INCONSISTENT');
  }
  if (applyContext && pushContext) {
    evidence.remotePushValidation = pushContext.remotePushValidation;
    evidence.remoteBranchVerified = pushContext.remoteBranchVerified;
    evidence.remoteHeadSha = pushContext.remoteHeadSha;
    if (pushContext.requestSha !== applyContext.requestSha || pushContext.closureSha !== applyContext.closureSha || pushContext.pushed !== true) fail('REMEDIATION_PUSH_CONTEXT_INCONSISTENT');
    try {
      const observed = await remoteBranchHead(applyContext.branch);
      if (observed !== applyContext.closureSha) {
        evidence.remotePushValidation = 'FAIL'; evidence.remoteBranchVerified = false; evidence.remoteHeadSha = observed;
        fail('REMEDIATION_REMOTE_HEAD_NOT_CLOSURE', JSON.stringify({ observed, closureSha: applyContext.closureSha }));
      }
      else { evidence.remotePushValidation = 'PASS'; evidence.remoteBranchVerified = true; evidence.remoteHeadSha = observed; }
    } catch (error) {
      evidence.remotePushValidation = 'FAIL'; evidence.remoteBranchVerified = false;
      fail(error.code ?? 'REMEDIATION_REMOTE_HEAD_VERIFICATION_FAILED', String(error.message ?? error));
    }
  }
  if (localContext?.artifactExtractPath && localContext.result === 'PASS') {
    try { await cp(localContext.artifactExtractPath, join(out, 'candidate-artifact'), { recursive: true }); }
    catch (error) { fail('REMEDIATION_CANDIDATE_ARTIFACT_COPY_FAILED', String(error)); }
  }
  for (const [field, expected] of [
    ['localValidation', 'PASS'], ['controlPlaneValidation', 'PASS'], ['remotePushValidation', 'PASS'],
    ['remoteBranchVerified', true], ['productStateUnchanged', true], ['tasksUnchanged', true],
    ['batchesUnchanged', true], ['specifyByteIdentical', true], ['b21Status', 'COMPLETED'], ['b22Status', 'PENDING'],
  ]) if (evidence[field] !== expected) fail('REMEDIATION_FINAL_EVIDENCE_INCONSISTENT', `${field}=${String(evidence[field])}`);
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
  try { assertClosureWorkflowOutcomes({ applyOutcome: process.env.APPLY_OUTCOME, controlPlaneOutcome: process.env.CONTROL_PLANE_OUTCOME }); }
  catch (error) { fail(error.code ?? 'CLOSURE_WORKFLOW_OUTCOME_INVALID', String(error.detail ?? error.message ?? error)); }
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

async function main() {
  if (verificationPhase === 'local') {
    if (closureType === 'REMEDIATION_CLOSURE') await runRemediationLocalClosure(derivedRoute);
    else if (closureType === 'BATCH_CLOSURE') {
      let result = 'PASS';
      try { assertClosureWorkflowOutcomes({ applyOutcome: process.env.APPLY_OUTCOME, controlPlaneOutcome: process.env.CONTROL_PLANE_OUTCOME }); }
      catch { result = 'FAIL'; }
      await setOutput('result', result);
      console.log(`BATCH_CLOSURE_LOCAL_GATE_${result}`);
    } else if (closureType === 'NOT_APPLICABLE') {
      await setOutput('result', 'NOT_APPLICABLE');
      console.log('CLOSURE_NOT_APPLICABLE');
    } else throw new Error(`CLOSURE_TYPE_INVALID:${closureType}`);
  } else if (closureType === 'NOT_APPLICABLE') await notApplicable(derivedRoute);
  else if (closureType === 'BATCH_CLOSURE') await runBatchClosure();
  else if (closureType === 'REMEDIATION_CLOSURE') await runRemediationRemoteClosure(derivedRoute);
  else throw new Error(`CLOSURE_TYPE_INVALID:${closureType}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
