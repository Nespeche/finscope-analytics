import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export const BUILD_OUTPUT_DIRECTORY = 'dist';
export const BUNDLE_REPORT_PLUGIN_NAME = 'finscope-deterministic-bundle-report';

export function deterministicBundleReport(): Plugin {
  return {
    name: BUNDLE_REPORT_PLUGIN_NAME,
    apply: 'build',
    generateBundle(_options, bundle): void {
      const entries = Object.entries(bundle)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([fileName, output]) => ({
          fileName,
          bytes: output.type === 'asset'
            ? typeof output.source === 'string'
              ? new TextEncoder().encode(output.source).byteLength
              : output.source.byteLength
            : new TextEncoder().encode(output.code).byteLength,
        }));
      const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
      this.info(`[bundle-report] assets=${entries.length} bytes=${totalBytes}`);
      for (const entry of entries) {
        this.info(`[bundle-report] ${entry.fileName} ${entry.bytes}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [svelte(), deterministicBundleReport()],
  json: {
    namedExports: true,
    stringify: true,
  },
  resolve: {
    alias: {
      $app: new URL('./src/app', import.meta.url).pathname,
      $core: new URL('./src/core', import.meta.url).pathname,
      $domain: new URL('./src/domain', import.meta.url).pathname,
    },
  },
  build: {
    target: 'es2022',
    outDir: BUILD_OUTPUT_DIRECTORY,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    manifest: true,
    reportCompressedSize: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: 'vendor',
            test: /node_modules[\\/]/,
            priority: 10,
          }],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    strictPort: true,
  },
});
