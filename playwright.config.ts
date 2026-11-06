import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm --filter @apiproof/web dev -p 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APIPROOF_SKIP_DEFAULT_SEED: 'false',
      APIPROOF_LOCAL_SEED_PASSWORD: 'local-test-seed-password',
      APIPROOF_DB_PATH: resolve(process.cwd(), '.tmp', 'playwright.db'),
    },
  },
});
