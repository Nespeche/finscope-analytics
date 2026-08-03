import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function source(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

describe('application composition contract', () => {
  it('mounts App.svelte from the single browser bootstrap', async () => {
    const main = await source('src/main.ts');
    expect(main).toContain("import { mount } from 'svelte'");
    expect(main).toContain("import App from '$app/App.svelte'");
    expect(main).toContain("querySelector<HTMLElement>('#app')");
    expect(main).toContain('mount(App');
    expect(main).not.toContain('document.createElement');
  });

  it('discovers typed views, components, plugins and styles deterministically', async () => {
    const composition = await source('src/app/composition.ts');
    expect(composition).toContain("import.meta.glob<ViewModule>('./views/*.svelte', { eager: true })");
    expect(composition).toContain("import.meta.glob<AppComponentModule>('./components/*.svelte', { eager: true })");
    expect(composition).toContain("'./lifecycle/*.ts'");
    expect(composition).toContain("'./a11y/*.ts'");
    expect(composition).toContain("'!./lifecycle/resume-refresh.ts'");
    expect(composition).toContain("import * as resumeRefreshPlugin from './lifecycle/resume-refresh'");
    expect(composition).toContain("'./lifecycle/resume-refresh.ts': async () => resumeRefreshPlugin");
    expect(composition).toContain("import.meta.glob<unknown>('./styles/*.css', { eager: true })");
    expect(composition).toContain("left.id.localeCompare(right.id, 'en')");
    expect(composition).toContain("left.sourcePath.localeCompare(right.sourcePath, 'en')");
    expect(composition).toContain('assertUniqueIds(routes');
    expect(composition).toContain('assertUniqueIds(components');
    expect(composition).toContain("route.id === 'home'");
  });

  it('does not request a dynamic chunk for the statically consumed resume plugin', async () => {
    const composition = await source('src/app/composition.ts');
    expect(composition).toContain('const discoveredPluginLoaders = import.meta.glob<AppPluginModule>');
    expect(composition).toContain("'!./lifecycle/resume-refresh.ts'");
    expect(composition).toContain('...discoveredPluginLoaders');
  });

  it('keeps ordinary components opt-in and validates complete global metadata', async () => {
    const composition = await source('src/app/composition.ts');
    expect(composition).toContain('declaredMetadataCount === 0');
    expect(composition).toContain('return [];');
    expect(composition).toContain(
      'must export componentId, appPlacement and order together to be globally composed',
    );
    expect(composition).toContain('validAppPlacements');
  });

  it('installs lazy lifecycle/accessibility plugins once and exposes every global placement', async () => {
    const [composition, app] = await Promise.all([
      source('src/app/composition.ts'),
      source('src/app/App.svelte'),
    ]);
    expect(composition).toContain('export async function installAppRuntime');
    expect(composition).toContain('installedPluginIds');
    expect(composition).toContain('await plugin.installAppPlugin(context)');
    expect(app).toContain('installAppRuntime(appComposition, { document, window })');
    for (const placement of [
      'headerComponents',
      'primaryActionComponents',
      'statusComponents',
      'recoveryComponents',
      'footerComponents',
    ]) {
      expect(app).toContain(placement);
    }
  });

  it('switches discovered routes through an explicit legacy-mode dynamic component', async () => {
    const app = await source('src/app/App.svelte');
    expect(app).toContain('<svelte:component this={activeRoute.component} />');
    expect(app).not.toContain('<ActiveView />');
  });

  it('registers the home route and status component through module metadata', async () => {
    const [home, status] = await Promise.all([
      source('src/app/views/HomeView.svelte'),
      source('src/app/components/AppStatus.svelte'),
    ]);
    expect(home).toContain('export const routeDefinition');
    expect(home).toContain("id: 'home'");
    expect(home).toContain('requiredCapabilities: []');
    expect(status).toContain("export const componentId = 'application-status'");
    expect(status).toContain("export const appPlacement: AppPlacement = 'status'");
  });
});
