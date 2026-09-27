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
    },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
