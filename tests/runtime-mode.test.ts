import { describe, expect, it } from 'vitest';
import { isE2ETestRuntime, isProductionRuntime, isTestRuntime } from '../apps/web/src/lib/server/runtime-mode.js';

describe('runtime mode classification', () => {
  it('enables the hermetic E2E runtime only for CI SQLite processes', () => {
    const environment = {
      NODE_ENV: 'production',
      CI: 'true',
      APIPROOF_E2E_TEST_MODE: 'true',
      APIPROOF_DB_PATH: '.tmp/playwright.db',
    };

    expect(isE2ETestRuntime(environment)).toBe(true);
    expect(isTestRuntime(environment)).toBe(true);
    expect(isProductionRuntime(environment)).toBe(false);
  });

  it('fails closed when a database URL is present or CI is absent', () => {
    const base = {
      NODE_ENV: 'production',
      APIPROOF_E2E_TEST_MODE: 'true',
      APIPROOF_DB_PATH: '.tmp/playwright.db',
    };

    expect(isE2ETestRuntime({ ...base, CI: 'true', DATABASE_URL: 'postgres://example' })).toBe(false);
    expect(isE2ETestRuntime({ ...base, CI: undefined })).toBe(false);
    expect(isProductionRuntime({ ...base, CI: undefined })).toBe(true);
  });
});
