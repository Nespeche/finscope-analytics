import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const output = resolve(process.argv[3] ?? '.finscope-evidence');
mkdirSync(output, { recursive: true });
const operation = JSON.parse(readFileSync(`${root}/implementation-control/OPERATION.json`, 'utf8'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const ids = operation.commands.map(({ id }) => id);
if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_OPERATION_COMMAND_ID');

let headSha = '0'.repeat(40);
try { headSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* package candidate outside git */ }

const startedAt = new Date().toISOString();
const results = [];
let stop = null;
let primaryFailure = null;
let primaryBlocker = null;
const infrastructurePattern = /(?:EAI_AGAIN|ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED|HTTP\s+5\d\d|registry[^\n]*5\d\d|service unavailable|rate limit)/iu;

for (const item of operation.commands) {
  if (stop !== null) {
    results.push({
      id: item.id, command: item.command, status: 'NOT_RUN', exitCode: null,
      stdoutSha256: null, stderrSha256: null,
      reason: `STOP_AFTER:${stop.id}:${stop.status}`,
    });
    continue;
  }

  const run = spawnSync(item.command, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const stdout = run.stdout ?? '';
  const stderr = run.stderr ?? '';
  writeFileSync(`${output}/${item.id}.stdout.log`, stdout, 'utf8');
  writeFileSync(`${output}/${item.id}.stderr.log`, stderr, 'utf8');
  const exitCode = Number.isInteger(run.status) ? run.status : 1;
  let status = exitCode === 0 ? 'PASS' : 'FAIL';
  let reason = null;

  const combined = `${stdout}\n${stderr}`;
  const internalProxy404 = /\bE404\b/iu.test(combined) && /internal\.api\.openai\.org/iu.test(combined);
  if (exitCode !== 0 && (infrastructurePattern.test(combined) || internalProxy404)) {
    status = 'ENVIRONMENT_BLOCKED';
    reason = 'EXTERNAL_INFRASTRUCTURE_UNAVAILABLE';
    primaryBlocker = item.id;
  } else if (exitCode !== 0) {
    primaryFailure = item.id;
  }

  if (status !== 'PASS') stop = { id: item.id, status };
  results.push({
    id: item.id, command: item.command, status, exitCode,
    stdoutSha256: sha(stdout), stderrSha256: sha(stderr), reason,
  });
}

const terminal = results.some(({ status }) => status === 'FAIL')
  ? 'FAIL'
  : results.some(({ status }) => status === 'ENVIRONMENT_BLOCKED')
    ? 'ENVIRONMENT_BLOCKED'
    : 'PASS';
const evidence = {
  $schema: 'implementation-control/schemas/operation-evidence.schema.json',
  schemaVersion: '2.0.0', operationId: operation.operationId, headSha,
  status: terminal, startedAt, finishedAt: new Date().toISOString(),
  primaryFailure, primaryBlocker, commands: results,
};
writeFileSync(`${output}/operation-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (terminal !== 'PASS') process.exitCode = 1;
