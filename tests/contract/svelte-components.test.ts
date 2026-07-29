import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

async function collectSvelteSources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedPaths = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSvelteSources(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.svelte') ? [entryPath] : [];
  }));

  return nestedPaths
    .flat()
    .map((path) => path.replaceAll('\\', '/'))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

describe('Svelte application shell contract', () => {
  it('compiles every application Svelte source without diagnostics', async () => {
    const componentPaths = await collectSvelteSources('src/app');
    expect(componentPaths.length).toBeGreaterThan(0);

    for (const path of componentPaths) {
      const source = await readFile(path, 'utf8');
      const result = compile(source, {
        filename: path,
        generate: 'client',
        modernAst: true,
      });
      expect(result.warnings, `${path} must compile without Svelte diagnostics`).toEqual([]);
      expect(result.js.code.length).toBeGreaterThan(0);
    }
  });

  it('contains semantic navigation, main, status and footer regions', async () => {
    const [app, status] = await Promise.all([
      readFile('src/app/App.svelte', 'utf8'),
      readFile('src/app/components/AppStatus.svelte', 'utf8'),
    ]);
    expect(app).toContain('<nav aria-label="Primary navigation">');
    expect(app).toContain('<main id="main-content" tabindex="-1">');
    expect(app).toContain('<footer>');
    expect(app).toContain('href="#main-content"');
    expect(status).toContain('role="status"');
    expect(status).toContain('aria-live="polite"');
    expect(status).toContain('tabindex="-1"');
    expect(status).not.toMatch(/tabindex\s*=\s*["'](?:0|[1-9]\d*)["']/u);
  });
});
