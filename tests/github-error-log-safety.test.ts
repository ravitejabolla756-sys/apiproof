import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessibleRepositoryInfo, getGitHubProvider } from '../apps/web/src/lib/server/github.js';

const environmentKeys = [
  'NODE_ENV',
  'APIPROOF_ENABLE_LIVE_GITHUB',
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_PRIVATE_KEY_PATH',
  'GITHUB_INSTALLATION_ID',
  'GITHUB_ALLOWED_REPOSITORY_ID',
  'GITHUB_ALLOWED_REPOSITORY_OWNER',
  'GITHUB_ALLOWED_REPOSITORY_NAME',
] as const;
const savedEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of environmentKeys) {
    const value = savedEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe('GitHub operational error log safety', () => {
  it('does not log a raw error object when provider initialization fails', () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'true';
    delete process.env.GITHUB_APP_ID;
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(getGitHubProvider()).toBeNull();
    expect(errorLog.mock.calls).toEqual([['Failed to initialize GitHubAppSourceControlProvider.']]);
  });

  it('does not log a raw error object when repository discovery fails', async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'true';
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY_PATH = 'C:\\missing-test-key\\private.pem';
    process.env.GITHUB_INSTALLATION_ID = '12345';
    process.env.GITHUB_ALLOWED_REPOSITORY_ID = '12345';
    process.env.GITHUB_ALLOWED_REPOSITORY_OWNER = 'test-owner';
    process.env.GITHUB_ALLOWED_REPOSITORY_NAME = 'test-repository';
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(getAccessibleRepositoryInfo()).resolves.toBeNull();
    expect(errorLog.mock.calls).toEqual([['Unable to fetch accessible repository info from GitHub App.']]);
  });
});
