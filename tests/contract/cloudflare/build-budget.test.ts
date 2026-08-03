import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_BUDGETS, checkCloudflareBuildBudgets } from '../../../scripts/check-cloudflare-budgets.mjs';

describe('Cloudflare build budgets', () => {
  it('measures Pages assets and the compressed Worker bundle before deployment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'finscope-budget-'));
    const pages = join(root, 'dist');
    await mkdir(pages);
    await writeFile(join(pages, 'index.html'), '<main>FinScope</main>');
    const worker = join(root, 'worker.js');
    await writeFile(worker, 'export default {fetch(){return new Response("ok")}}');
    const result = await checkCloudflareBuildBudgets({ pagesDirectory: pages, workerBundle: worker });
    expect(result).toMatchObject({ passed: true, assetCount: 1, failures: [] });
    expect(BUILD_BUDGETS).toEqual({ pagesFiles: 500, pagesAssetBytes: 5_242_880, workerCompressedBundleBytes: 524_288 });
  });
});
