/// <reference types="vite/client" />

import type { Component } from 'svelte';
import * as resumeRefreshPlugin from './lifecycle/resume-refresh';

export type AppPlacement = 'header' | 'primary-action' | 'status' | 'recovery' | 'footer';

export interface RouteDefinition {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly requiredCapabilities: readonly string[];
}

export interface AppComponentDefinition {
  readonly id: string;
  readonly appPlacement: AppPlacement;
  readonly order: number;
}

export interface AppPluginContext {
  readonly document: Document;
  readonly window: Window;
}

export type AppPluginCleanup = () => void;

export interface AppPluginModule {
  readonly pluginId: string;
  readonly order: number;
  readonly installAppPlugin: (
    context: AppPluginContext,
  ) => void | AppPluginCleanup | Promise<void | AppPluginCleanup>;
}

export interface RegisteredRoute extends RouteDefinition {
  readonly component: Component;
  readonly sourcePath: string;
}

export interface RegisteredAppComponent extends AppComponentDefinition {
  readonly component: Component;
  readonly sourcePath: string;
}

export interface RegisteredAppPlugin {
  readonly id: string;
  readonly order: number;
  readonly installAppPlugin: AppPluginModule['installAppPlugin'];
  readonly sourcePath: string;
}

interface RegisteredAppPluginLoader {
  readonly sourcePath: string;
  readonly load: AppPluginLoader;
}

export interface AppComposition {
  readonly routes: readonly RegisteredRoute[];
  readonly components: readonly RegisteredAppComponent[];
  readonly pluginLoaders: readonly RegisteredAppPluginLoader[];
  readonly stylePaths: readonly string[];
  readonly homeRoute: RegisteredRoute;
}

interface ViewModule {
  readonly default: Component;
  readonly routeDefinition?: RouteDefinition;
}

interface AppComponentModule {
  readonly default: Component;
  readonly appPlacement?: AppPlacement;
  readonly componentId?: string;
  readonly order?: number;
}

type AppPluginLoader = () => Promise<AppPluginModule>;

const viewModules = import.meta.glob<ViewModule>('./views/*.svelte', { eager: true });
const componentModules = import.meta.glob<AppComponentModule>('./components/*.svelte', { eager: true });
const discoveredPluginLoaders = import.meta.glob<AppPluginModule>([
  './lifecycle/*.ts',
  './a11y/*.ts',
  '!./lifecycle/resume-refresh.ts',
]);
const pluginLoaders: Readonly<Record<string, AppPluginLoader>> = Object.freeze({
  './lifecycle/resume-refresh.ts': async () => resumeRefreshPlugin,
  ...discoveredPluginLoaders,
});
const styleModules = import.meta.glob<unknown>('./styles/*.css', { eager: true });

const validAppPlacements = new Set<AppPlacement>([
  'header',
  'primary-action',
  'status',
  'recovery',
  'footer',
]);

const installedPluginIds = new WeakMap<Document, Set<string>>();

function compareByOrderAndId(
  left: Readonly<{ order: number; id: string }>,
  right: Readonly<{ order: number; id: string }>,
): number {
  return left.order - right.order || left.id.localeCompare(right.id, 'en');
}

function compareSourcePaths(
  left: Readonly<{ sourcePath: string }>,
  right: Readonly<{ sourcePath: string }>,
): number {
  return left.sourcePath.localeCompare(right.sourcePath, 'en');
}

function assertNonEmptyIdentifier(value: string, field: string, sourcePath: string): void {
  if (!/^[a-z][a-z0-9-]*$/u.test(value)) {
    throw new Error(`${sourcePath} exports invalid ${field}: ${value}`);
  }
}

function assertUniqueIds(items: readonly Readonly<{ id: string; sourcePath: string }>[], kind: string): void {
  const seen = new Map<string, string>();
  for (const item of items) {
    const previous = seen.get(item.id);
    if (previous !== undefined) {
      throw new Error(`Duplicate ${kind} id "${item.id}" in ${previous} and ${item.sourcePath}.`);
    }
    seen.set(item.id, item.sourcePath);
  }
}

function assertAppPlacement(value: unknown, sourcePath: string): asserts value is AppPlacement {
  if (typeof value !== 'string' || !validAppPlacements.has(value as AppPlacement)) {
    throw new Error(`${sourcePath} exports an invalid appPlacement: ${String(value)}`);
  }
}

function createRoutes(modules: Readonly<Record<string, ViewModule>>): readonly RegisteredRoute[] {
  const routes = Object.entries(modules).map(([sourcePath, module]) => {
    const definition = module.routeDefinition;
    if (definition === undefined) {
      throw new Error(`${sourcePath} does not export routeDefinition.`);
    }
    assertNonEmptyIdentifier(definition.id, 'route id', sourcePath);
    if (definition.label.trim().length === 0) {
      throw new Error(`${sourcePath} exports an empty route label.`);
    }
    if (!Number.isSafeInteger(definition.order)) {
      throw new Error(`${sourcePath} exports a non-integer route order.`);
    }
    return Object.freeze({
      ...definition,
      requiredCapabilities: Object.freeze([...definition.requiredCapabilities]),
      component: module.default,
      sourcePath,
    });
  }).sort(compareByOrderAndId);

  assertUniqueIds(routes, 'route');
  return Object.freeze(routes);
}

function createComponents(
  modules: Readonly<Record<string, AppComponentModule>>,
): readonly RegisteredAppComponent[] {
  const components = Object.entries(modules).flatMap(([sourcePath, module]) => {
    const metadataValues = [module.componentId, module.appPlacement, module.order];
    const declaredMetadataCount = metadataValues.filter((value) => value !== undefined).length;

    if (declaredMetadataCount === 0) {
      return [];
    }
    if (
      module.componentId === undefined
      || module.appPlacement === undefined
      || module.order === undefined
    ) {
      throw new Error(
        `${sourcePath} must export componentId, appPlacement and order together to be globally composed.`,
      );
    }

    assertNonEmptyIdentifier(module.componentId, 'component id', sourcePath);
    assertAppPlacement(module.appPlacement, sourcePath);
    if (!Number.isSafeInteger(module.order)) {
      throw new Error(`${sourcePath} exports a non-integer component order.`);
    }

    return [Object.freeze({
      id: module.componentId,
      appPlacement: module.appPlacement,
      order: module.order,
      component: module.default,
      sourcePath,
    })];
  }).sort(compareByOrderAndId);

  assertUniqueIds(components, 'component');
  return Object.freeze(components);
}

function createPluginLoaders(
  modules: Readonly<Record<string, AppPluginLoader>>,
): readonly RegisteredAppPluginLoader[] {
  return Object.freeze(
    Object.entries(modules)
      .map(([sourcePath, load]) => Object.freeze({ sourcePath, load }))
      .sort(compareSourcePaths),
  );
}

function createStylePaths(modules: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.freeze(Object.keys(modules).sort((left, right) => left.localeCompare(right, 'en')));
}

async function loadAppPlugins(
  loaders: readonly RegisteredAppPluginLoader[],
): Promise<readonly RegisteredAppPlugin[]> {
  const plugins: RegisteredAppPlugin[] = [];

  for (const loader of loaders) {
    const module = await loader.load();
    assertNonEmptyIdentifier(module.pluginId, 'plugin id', loader.sourcePath);
    if (!Number.isSafeInteger(module.order)) {
      throw new Error(`${loader.sourcePath} exports a non-integer plugin order.`);
    }
    if (typeof module.installAppPlugin !== 'function') {
      throw new Error(`${loader.sourcePath} does not export installAppPlugin(context).`);
    }
    plugins.push(Object.freeze({
      id: module.pluginId,
      order: module.order,
      installAppPlugin: module.installAppPlugin,
      sourcePath: loader.sourcePath,
    }));
  }

  plugins.sort(compareByOrderAndId);
  assertUniqueIds(plugins, 'plugin');
  return Object.freeze(plugins);
}

function runCleanups(cleanups: readonly AppPluginCleanup[]): void {
  for (const cleanup of [...cleanups].reverse()) {
    cleanup();
  }
}

export async function installAppRuntime(
  composition: AppComposition,
  context: AppPluginContext,
): Promise<AppPluginCleanup> {
  const plugins = await loadAppPlugins(composition.pluginLoaders);
  const installedForDocument = installedPluginIds.get(context.document) ?? new Set<string>();
  installedPluginIds.set(context.document, installedForDocument);
  const cleanups: AppPluginCleanup[] = [];

  try {
    for (const plugin of plugins) {
      if (installedForDocument.has(plugin.id)) {
        continue;
      }

      const pluginCleanup = await plugin.installAppPlugin(context);
      if (pluginCleanup !== undefined && typeof pluginCleanup !== 'function') {
        throw new TypeError(`${plugin.sourcePath} returned an invalid plugin cleanup value.`);
      }
      installedForDocument.add(plugin.id);
      cleanups.push(() => {
        try {
          pluginCleanup?.();
        } finally {
          installedForDocument.delete(plugin.id);
        }
      });
    }
  } catch (error: unknown) {
    runCleanups(cleanups);
    throw error;
  }

  return () => {
    runCleanups(cleanups);
  };
}

export function createAppComposition(
  views: Readonly<Record<string, ViewModule>>,
  components: Readonly<Record<string, AppComponentModule>>,
  plugins: Readonly<Record<string, AppPluginLoader>> = {},
  styles: Readonly<Record<string, unknown>> = {},
): AppComposition {
  const routes = createRoutes(views);
  const registeredComponents = createComponents(components);
  const homeRoute = routes.find((route) => route.id === 'home');

  if (homeRoute === undefined) {
    throw new Error('The deterministic application composition requires a home route.');
  }

  return Object.freeze({
    routes,
    components: registeredComponents,
    pluginLoaders: createPluginLoaders(plugins),
    stylePaths: createStylePaths(styles),
    homeRoute,
  });
}

export const appComposition = createAppComposition(
  viewModules,
  componentModules,
  pluginLoaders,
  styleModules,
);
