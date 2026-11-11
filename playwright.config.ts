import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
  webServer: {
    command: `pnpm --filter @apiproof/web dev -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      APIPROOF_SKIP_DEFAULT_SEED: 'false',
      APIPROOF_LOCAL_SEED_PASSWORD: process.env.APIPROOF_LOCAL_SEED_PASSWORD ?? 'local-test-seed-password',
      APIPROOF_E2E_TEST_MODE: 'true',
      APIPROOF_DB_PATH: process.env.APIPROOF_DB_PATH ?? resolve(process.cwd(), '.tmp', 'playwright.db'),
    },
  },
});
