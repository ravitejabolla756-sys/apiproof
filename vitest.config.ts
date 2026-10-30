import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    conditions: ['apiproof-source'],
    alias: {
      ...Object.fromEntries(['shared', 'core', 'providers', 'analyzers'].map((name) => [
        `@apiproof/${name}`, fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
      ])),
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      'next/server': fileURLToPath(new URL('./apps/web/node_modules/next/server.js', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    // Several integration suites deliberately exercise process-level rollout
    // flags and database-path selection. Running files concurrently lets one
    // suite change that shared test state while another is mid-request.
    // Keep the suite deterministic; production code remains concurrent.
    fileParallelism: false,
    // These integration suites intentionally exercise process-level rollout
    // flags and database-path selection. Force one Vitest worker as well so
    // the shared process environment cannot diverge between test files.
    maxWorkers: 1,
  },
});
