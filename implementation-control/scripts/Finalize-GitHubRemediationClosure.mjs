import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, root, run, setOutput, writeJson } from './GitHub-Common.mjs';

export class RemediationFinalizationError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `:${detail}` : ''}`); this.code = code; this.detail = detail; }
}

const fail = (code, detail = '') => { throw new RemediationFinalizationError(code, detail); };
const shaPattern = /^[0-9a-f]{40}$/u;
const branchPattern = /^(?!\/)(?!.*(?:\.\.|\/\/|@\{))[A-Za-z0-9._/-]+(?<!\/)$/u;

export function assertPreparedFinalization({ applyContext, localContext, localHead, remoteHead }) {
  if (!applyContext || applyContext.result !== 'PASS' || applyContext.prepared !== true || applyContext.pushed !== false) fail('REMEDIATION_PREPARATION_INVALID');
  if (!localContext || localContext.result !== 'PASS' || localContext.localValidation !== 'PASS' || localContext.controlPlaneValidation !== 'PASS') fail('REMEDIATION_LOCAL_VALIDATION_NOT_PASS');
  for (const field of ['requestSha', 'closureSha', 'candidateSha']) if (!shaPattern.test(applyContext[field] ?? '')) fail('REMEDIATION_PREPARATION_SHA_INVALID', field);
  if (!branchPattern.test(applyContext.branch ?? '')) fail('REMEDIATION_BRANCH_INVALID', String(applyContext.branch));
  if (applyContext.remoteExpectedHead !== applyContext.requestSha) fail('REMEDIATION_REMOTE_EXPECTATION_INVALID');
  if (localContext.requestSha !== applyContext.requestSha || localContext.closureSha !== applyContext.closureSha || localContext.branch !== applyContext.branch) fail('REMEDIATION_LOCAL_CONTEXT_IDENTITY_MISMATCH');
  if (localHead !== applyContext.closureSha) fail('REMEDIATION_LOCAL_HEAD_MOVED', JSON.stringify({ localHead, closureSha: applyContext.closureSha }));
  if (remoteHead !== applyContext.requestSha) fail('REMEDIATION_REMOTE_HEAD_MOVED', JSON.stringify({ remoteHead, requestSha: applyContext.requestSha }));
  return true;
}

export function buildConditionalPushCommand({ branch, requestSha, closureSha }) {
  if (!branchPattern.test(branch ?? '') || !shaPattern.test(requestSha ?? '') || !shaPattern.test(closureSha ?? '')) fail('REMEDIATION_CONDITIONAL_PUSH_INPUT_INVALID');
  return `git push --porcelain origin "${closureSha}:refs/heads/${branch}"`;
}

export function confirmRemotePush(remoteHead, closureSha) {
  if (remoteHead !== closureSha) fail('REMEDIATION_REMOTE_PUSH_NOT_CONFIRMED', JSON.stringify({ remoteHead, closureSha }));
  return { remotePushValidation: 'PASS', remoteBranchVerified: true, remoteHeadSha: remoteHead };
}

async function command(commandText, code) {
  const result = await run(commandText, { cwd: root });
  if (result.exitCode !== 0) fail(code, result.stderr.toString('utf8'));
  return result.stdout.toString('utf8').trim();
}

async function readRemoteBranchHead(branch) {
  const output = await command(`git ls-remote --heads origin "refs/heads/${branch}"`, 'REMEDIATION_REMOTE_HEAD_LOOKUP_FAILED');
  const lines = output.split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1) fail('REMEDIATION_REMOTE_BRANCH_NOT_UNIQUE', JSON.stringify(lines));
  const match = /^([0-9a-f]{40})\s+refs\/heads\/(.+)$/u.exec(lines[0]);
  if (!match || match[2] !== branch) fail('REMEDIATION_REMOTE_HEAD_INVALID', lines[0]);
  return match[1];
}

export async function finalizeGitHubRemediationClosure() {
  const contextDirectory = resolve(process.env.FINSCOPE_CLOSURE_CONTEXT_DIR ?? join(process.env.RUNNER_TEMP ?? root, 'finscope-context'));
  const pushContextPath = join(contextDirectory, 'remediation-closure-push.json');
  let applyContext;
  try {
    applyContext = await readJson(join(contextDirectory, 'remediation-closure-apply.json'));
    const localContext = await readJson(join(contextDirectory, 'remediation-closure-local-verification.json'));
    const localHead = (await command('git rev-parse HEAD', 'REMEDIATION_LOCAL_HEAD_LOOKUP_FAILED')).toLowerCase();
    const remoteHead = await readRemoteBranchHead(applyContext.branch);
    assertPreparedFinalization({ applyContext, localContext, localHead, remoteHead });
    const requiredPushMode = process.env.FINSCOPE_REQUIRED_PUSH_MODE ?? 'normal-fast-forward';
    if (requiredPushMode !== 'normal-fast-forward') fail('REMEDIATION_PUSH_MODE_INVALID', requiredPushMode);
    await command(`git merge-base --is-ancestor "${applyContext.requestSha}" "${applyContext.closureSha}"`, 'REMEDIATION_CLOSURE_NOT_FAST_FORWARD');
    await command(buildConditionalPushCommand(applyContext), 'REMEDIATION_NORMAL_PUSH_FAILED');
    const confirmedRemoteHead = await readRemoteBranchHead(applyContext.branch);
    const confirmation = confirmRemotePush(confirmedRemoteHead, applyContext.closureSha);
    const pushContext = {
      result: 'PASS', repository: applyContext.repository, remediationId: applyContext.remediationId,
      branch: applyContext.branch, requestSha: applyContext.requestSha, closureSha: applyContext.closureSha,
      prepared: true, pushed: true, ...confirmation, primaryFailure: null,
    };
    await writeJson(pushContextPath, pushContext);
    await Promise.all([setOutput('result', 'PASS'), setOutput('pushed', 'true'), setOutput('closure_sha', applyContext.closureSha)]);
    console.log(JSON.stringify(pushContext, null, 2));
    return pushContext;
  } catch (error) {
    const primaryFailure = { code: error.code ?? 'REMEDIATION_FINALIZATION_FAILED', detail: String(error.detail ?? error.message ?? error) };
    const failure = {
      result: 'FAIL', repository: applyContext?.repository ?? null, remediationId: applyContext?.remediationId ?? null,
      branch: applyContext?.branch ?? null, requestSha: applyContext?.requestSha ?? null, closureSha: applyContext?.closureSha ?? null,
      prepared: applyContext?.prepared === true, pushed: false, remotePushValidation: 'FAIL',
      remoteBranchVerified: false, remoteHeadSha: null, primaryFailure,
    };
    await writeJson(pushContextPath, failure);
    await Promise.all([setOutput('result', 'FAIL'), setOutput('pushed', 'false')]);
    console.error(JSON.stringify(failure, null, 2));
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await finalizeGitHubRemediationClosure();
