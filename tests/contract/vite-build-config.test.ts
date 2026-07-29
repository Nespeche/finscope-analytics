import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function readSource(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

describe('Vite build configuration contract', () => {
  it('uses the Svelte 5 plugin without SvelteKit', async () => {
    const [config, packageDocument] = await Promise.all([
      readSource('vite.config.ts'),
      readSource('package.json'),
    ]);
    expect(config).toContain("from '@sveltejs/vite-plugin-svelte'");
    expect(config).toContain('svelte()');
    expect(packageDocument.toLowerCase()).not.toContain('sveltekit');
  });

  it('fixes deterministic JSON and production output settings', async () => {
    const config = await readSource('vite.config.ts');
    expect(config).toContain("BUILD_OUTPUT_DIRECTORY = 'dist'");
    expect(config).toContain('namedExports: true');
    expect(config).toContain('stringify: true');
    expect(config).toContain('emptyOutDir: true');
    expect(config).toContain('assetsInlineLimit: 0');
    expect(config).toContain('manifest: true');
    expect(config).toContain('sourcemap: true');
  });

  it('reports a sorted asset count and byte total during build', async () => {
    const config = await readSource('vite.config.ts');
    expect(config).toContain('finscope-deterministic-bundle-report');
    expect(config).toContain("left.localeCompare(right, 'en')");
    expect(config).toContain('[bundle-report] assets=');
    expect(config).toContain('[bundle-report] ${entry.fileName} ${entry.bytes}');
  });
});
