import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BUILD_BUDGETS = Object.freeze({ pagesFiles: 500, pagesAssetBytes: 5 * 1024 * 1024, workerCompressedBundleBytes: 512 * 1024 });

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

export async function checkCloudflareBuildBudgets({ pagesDirectory, workerBundle }) {
  const pageFiles = await filesUnder(pagesDirectory);
  const assets = await Promise.all(pageFiles.map(async (path) => ({ path: relative(pagesDirectory, path), bytes: (await stat(path)).size })));
  const largestAssetBytes = Math.max(0, ...assets.map(({ bytes }) => bytes));
  const workerCompressedBytes = gzipSync(await readFile(workerBundle), { level: 9 }).byteLength;
  const failures = [];
  if (assets.length > BUILD_BUDGETS.pagesFiles) failures.push('PAGES_FILE_BUDGET_EXCEEDED');
  if (largestAssetBytes > BUILD_BUDGETS.pagesAssetBytes) failures.push('PAGES_ASSET_BUDGET_EXCEEDED');
  if (workerCompressedBytes > BUILD_BUDGETS.workerCompressedBundleBytes) failures.push('WORKER_BUNDLE_BUDGET_EXCEEDED');
  return Object.freeze({ passed: failures.length === 0, assetCount: assets.length, largestAssetBytes, workerCompressedBytes, failures: Object.freeze(failures) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , pagesDirectory, workerBundle] = process.argv;
  if (!pagesDirectory || !workerBundle) throw new Error('USAGE: check-cloudflare-budgets.mjs <pages-directory> <worker-bundle>');
  const result = await checkCloudflareBuildBudgets({ pagesDirectory, workerBundle });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
}
