import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'local';
if (!['local', 'working-tree', 'pr', 'release'].includes(mode)) throw new Error(`INVALID_SCOPE_MODE:${mode}`);
const operation = JSON.parse(readFileSync(`${root}/implementation-control/OPERATION.json`, 'utf8'));

function globToRegex(glob) {
  let pattern = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { pattern += '.*'; i += 1; }
    else if (c === '*') pattern += '[^/]*';
    else if ('\\.^$+?()[]{}|'.includes(c)) pattern += `\\${c}`;
    else pattern += c;
  }
  return new RegExp(`${pattern}$`, 'u');
}
function git(args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim(); }

const failures = [];
let head = null;
let base = operation.base.expectedSha;
let mergeBase = null;
let originMain = null;
let files = [];
try {
  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') failures.push('NOT_A_GIT_WORKTREE');
  head = git(['rev-parse', 'HEAD']);
  git(['cat-file', '-e', `${base}^{commit}`]);
  mergeBase = git(['merge-base', base, head]);
  if (mergeBase !== base) failures.push(`BASE_NOT_ANCESTOR:${mergeBase}`);
  if (mode === 'working-tree') {
    const tracked = git(['diff', '--name-only', '--diff-filter=ACDMRTUXB', base, '--']).split(/\r?\n/u).filter(Boolean);
    const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/u).filter(Boolean);
    files = [...new Set([...tracked, ...untracked])].sort();
  } else {
    files = git(['diff', '--name-only', '--diff-filter=ACDMRTUXB', `${base}...${head}`]).split(/\r?\n/u).filter(Boolean);
  }
  try { originMain = git(['rev-parse', 'origin/main']); } catch { originMain = null; }
} catch (error) {
  failures.push(`GIT_CONTEXT_ERROR:${error instanceof Error ? error.message : String(error)}`);
}

const allowed = operation.scope.allowedPaths.map(globToRegex);
const forbidden = operation.scope.forbiddenPaths.map(globToRegex);
const outside = files.filter((path) => !allowed.some((regex) => regex.test(path)));
const forbiddenHits = files.filter((path) => forbidden.some((regex) => regex.test(path)));
if (outside.length > 0) failures.push('OUTSIDE_ALLOWLIST');
if (forbiddenHits.length > 0) failures.push('FORBIDDEN_PATH_CHANGED');
if (!files.includes('implementation-control/OPERATION.json')) failures.push('OPERATION_DECLARATION_NOT_CHANGED');

if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== operation.repository) failures.push('REPOSITORY_MISMATCH');
if (mode === 'working-tree') {
  let branch = null;
  try { branch = git(['branch', '--show-current']); } catch { branch = null; }
  if (branch !== operation.branch) failures.push('WORKING_BRANCH_MISMATCH');
  if (originMain !== null && originMain !== base) failures.push('BASE_SHA_CHANGED');
}
if (mode === 'pr') {
  if (process.env.GITHUB_HEAD_REF && process.env.GITHUB_HEAD_REF !== operation.branch) failures.push('PR_HEAD_BRANCH_MISMATCH');
  if (process.env.GITHUB_BASE_REF && process.env.GITHUB_BASE_REF !== operation.base.branch) failures.push('PR_BASE_BRANCH_MISMATCH');
  if (originMain !== null && originMain !== base) failures.push('BASE_SHA_CHANGED');
}
if (mode === 'release') {
  if (originMain !== null && originMain !== head) failures.push('RELEASE_HEAD_IS_NOT_MAIN');
}

const result = {
  schemaVersion: '2.0.0', operationId: operation.operationId, mode,
  repository: operation.repository, base, originMain, mergeBase, head,
  changedFileCount: files.length, files, outsideAllowlist: outside,
  forbiddenHits, failures, status: failures.length === 0 ? 'PASS' : 'FAIL',
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
