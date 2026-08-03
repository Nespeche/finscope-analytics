import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const repository = resolve('.');
const packageScript = join(repository, 'implementation-control/scripts/Package-GitHubCompletedRelease.mjs');
const createdAtRoot: string[] = [];

afterEach(async () => {
  await Promise.all(createdAtRoot.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

async function expectDirtyWorkspaceRejected(name: string) {
  const contaminant = join(repository, name);
  const output = await mkdtemp(join(tmpdir(), 'finscope-package-negative-'));
  createdAtRoot.push(contaminant, output);
  await writeFile(contaminant, 'must not enter a completed package\n', 'utf8');
  await expect(execute(process.execPath, [packageScript, output], { cwd: repository })).rejects.toMatchObject({
    stderr: expect.stringContaining('RELEASE_WORKTREE_NOT_CLEAN'),
  });
}

describe.sequential('completed package contamination remediation', () => {
  it('fails closed when github-context.json is untracked', async () => {
    await expectDirtyWorkspaceRejected('github-context.json');
  });

  it('fails closed for an arbitrary untracked file, independently of the nominal denylist', async () => {
    await expectDirtyWorkspaceRejected('arbitrary-untracked-probe.dat');
  });

  it('extracts source bytes only from the exact Git commit', async () => {
    const source = await readFile(packageScript, 'utf8');
    expect(source).toContain("['ls-tree', '-r', '-z', releaseCommitSha]");
    expect(source).toContain("['cat-file', 'blob', match[3]]");
    expect(source).not.toContain('copyFile(source, destination)');
  });

  it('keeps denylist rejection independent from inventory and manifest claims', async () => {
    const verifier = await readFile(join(repository, 'implementation-control/scripts/Verify-GitHubCompletedPackage.mjs'), 'utf8');
    const denylistIndex = verifier.indexOf("'COMPLETED_PACKAGE_TEMPORARY_FILE'");
    const inventoryIndex = verifier.indexOf('const manifestPath');
    expect(denylistIndex).toBeGreaterThan(0);
    expect(denylistIndex).toBeLessThan(inventoryIndex);
    expect(verifier).toContain('COMPLETED_PACKAGE_PATH_NOT_IN_GIT_TREE');
    expect(verifier).toContain('COMPLETED_PACKAGE_GIT_BYTES_MISMATCH');
  });

  it('reauthenticates published assets and preserves a published release on failure', async () => {
    const transfer = await readFile(join(repository, 'implementation-control/scripts/Run-GitHubReleaseTransfer.mjs'), 'utf8');
    expect(transfer).toContain('authenticatePublishedRelease');
    expect(transfer).toContain('POST_PUBLICATION_REAUTHENTICATION.json');
    expect(transfer).toContain("if (!release?.draft) return");
    expect(transfer).toContain('POST_PUBLISH_ASSET_BYTES_MISMATCH');
    expect(transfer).toContain('gitTreeComparisonExecuted === true');
  });

  it('writes resolver output outside the checkout and always cleans it', async () => {
    for (const name of ['finscope-pr-validation.yml', 'finscope-closure-validation.yml', 'finscope-release-qualification.yml', 'finscope-completed-release.yml']) {
      const workflow = await readFile(join(repository, '.github/workflows', name), 'utf8');
      expect(workflow).toContain('$RUNNER_TEMP/finscope-context');
      expect(workflow).toContain('if: always()');
      expect(workflow).not.toMatch(/> github-context\.json/u);
    }
  });

  it('delegates publication authority to the executable completed-state resolver', async () => {
    const workflow = await readFile(join(repository, '.github/workflows/finscope-completed-release.yml'), 'utf8');
    expect(workflow).toContain('--release-publication');
    expect(workflow).toContain('NOT_APPLICABLE: $reason');
    expect(workflow).not.toContain('test "$kind" = RELEASE_REMEDIATION');
    expect(workflow).not.toContain('test "$pending" = true');
  });
});
