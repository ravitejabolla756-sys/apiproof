import { describe, expect, it } from 'vitest';
import { getRuntimeConfiguration } from '../apps/web/src/lib/server/runtime-configuration.js';

const readyEnvironment = (): NodeJS.ProcessEnv => ({
  APIPROOF_DATABASE_URL: 'postgresql://configured.example/db',
  APIPROOF_SECRET: 'application-secret-that-is-at-least-32-chars',
  CRON_SECRET: 'cron-secret-16-chars',
  GITHUB_APP_ID: '123',
  GITHUB_APP_SLUG: 'apiproof',
  GITHUB_APP_PRIVATE_KEY: '-----BEGIN RSA PRIVATE KEY-----\nfixture\n-----END RSA PRIVATE KEY-----',
  GITHUB_INSTALLATION_ID: '456',
  GITHUB_ALLOWED_REPOSITORY_ID: '789',
  GITHUB_ALLOWED_REPOSITORY_OWNER: 'owner',
  GITHUB_ALLOWED_REPOSITORY_NAME: 'repository',
  GITHUB_WEBHOOK_SECRET: 'webhook-secret-16',
  APIPROOF_APP_URL: 'https://owl.example.com',
  APIPROOF_ENABLE_LIVE_GITHUB: 'true',
  APIPROOF_ENABLE_LIVE_GITHUB_WRITE: 'false',
  PROVIDER_INTELLIGENCE_V1_ENABLED: 'true',
});

describe('runtime configuration contract', () => {
  it('recognizes a complete read-only live-beta configuration', () => {
    expect(getRuntimeConfiguration(readyEnvironment())).toEqual({
      database: true,
      applicationSecret: true,
      cronSecret: true,
      githubApp: true,
      githubInstallation: true,
      githubWebhook: true,
      publicAppUrl: true,
      liveGithubEnabled: true,
      liveGithubWriteEnabled: false,
      productizationV1Enabled: true,
      readyForLiveBeta: true,
    });
  });

  it('fails closed when a required class is missing or repository writes are enabled', () => {
    const environment = readyEnvironment();
    delete environment.GITHUB_WEBHOOK_SECRET;
    environment.APIPROOF_ENABLE_LIVE_GITHUB_WRITE = 'true';
    const result = getRuntimeConfiguration(environment);
    expect(result.githubWebhook).toBe(false);
    expect(result.liveGithubWriteEnabled).toBe(true);
    expect(result.readyForLiveBeta).toBe(false);
  });

  it('fails closed when the full productization scanner is disabled', () => {
    const environment = readyEnvironment();
    delete environment.PROVIDER_INTELLIGENCE_V1_ENABLED;
    const result = getRuntimeConfiguration(environment);
    expect(result.productizationV1Enabled).toBe(false);
    expect(result.readyForLiveBeta).toBe(false);
  });

  it('does not treat a local private-key path as production GitHub configuration', () => {
    const environment = readyEnvironment();
    delete environment.GITHUB_APP_PRIVATE_KEY;
    environment.GITHUB_APP_PRIVATE_KEY_PATH = 'C:/keys/my-owl.pem';
    const result = getRuntimeConfiguration(environment);
    expect(result.githubApp).toBe(false);
    expect(result.readyForLiveBeta).toBe(false);
  });

  it('does not treat an App without an authorized installation as live-ready', () => {
    const environment = readyEnvironment();
    delete environment.GITHUB_INSTALLATION_ID;
    const result = getRuntimeConfiguration(environment);
    expect(result.githubApp).toBe(true);
    expect(result.githubInstallation).toBe(false);
    expect(result.readyForLiveBeta).toBe(false);
  });

  it('returns booleans only and never exposes configured values', () => {
    const result = getRuntimeConfiguration(readyEnvironment());
    expect(Object.values(result).every((value) => typeof value === 'boolean')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-key');
    expect(JSON.stringify(result)).not.toContain('postgresql://');
  });
});
