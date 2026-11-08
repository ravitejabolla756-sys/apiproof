import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: process.env.CI
      ? 'pnpm exec tsx apps/web/scripts/playwright-server.ts'
      : `pnpm --filter @apiproof/web dev -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    // Reusing an arbitrary listener can silently test another checkout. Opt
    // in only when the caller has established that the existing server belongs
    // to this worktree.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true',
    timeout: 120_000,
    env: {
      APIPROOF_SKIP_DEFAULT_SEED: 'false',
      APIPROOF_LOCAL_SEED_PASSWORD: process.env.APIPROOF_LOCAL_SEED_PASSWORD ?? 'local-test-seed-password',
      APIPROOF_E2E_TEST_MODE: process.env.CI ? 'true' : 'false',
      APIPROOF_DB_PATH: process.env.APIPROOF_DB_PATH ?? resolve(process.cwd(), '.tmp', 'playwright.db'),
    },
  },
});
