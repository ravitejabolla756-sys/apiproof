import { afterEach, describe, expect, it, vi } from 'vitest';

const { queryOne, getDatabase } = vi.hoisted(() => {
  const queryOne = vi.fn();
  const getDatabase = vi.fn(() => ({
    engine: 'postgres',
    queryOne,
  }));
  return { queryOne, getDatabase };
});

vi.mock('../apps/web/src/lib/server/db/index.js', () => ({
  getDatabase,
  resolveDatabaseConfig: (environment: NodeJS.ProcessEnv) => ({
    type: 'postgres',
    url: environment.APIPROOF_DATABASE_URL,
  }),
}));

import { GET } from '../apps/web/src/app/api/internal/staging-scan-readiness/route.js';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  queryOne.mockReset();
  getDatabase.mockClear();
});

function setReadyEnvironment(): void {
  process.env.CRON_SECRET = 'expected-secret';
  process.env.APIPROOF_PREVIEW_STAGING_ISOLATION = 'true';
  process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'true';
  process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'true';
  process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE = 'false';
  process.env.GITHUB_ALLOWED_REPOSITORY_ID = '1408947921';
  process.env.GITHUB_ALLOWED_REPOSITORY_OWNER = 'ravitejabolla756-sys';
  process.env.GITHUB_ALLOWED_REPOSITORY_NAME = 'my-owl-staging-affected-openai';
  process.env.APIPROOF_DATABASE_URL = 'postgresql://postgres.elzkxgfsciivlrejujwb:secret@aws-0-ap-south-1.pooler.supabase.com/postgres';
  delete process.env.DATABASE_URL;
  queryOne.mockResolvedValue({ database_name: 'postgres', database_user: 'postgres' });
}

function authorizedRequest(): Request {
  return new Request('https://example.invalid/api/internal/staging-scan-readiness', {
    headers: { authorization: 'Bearer expected-secret' },
  });
}

describe('staging scan readiness endpoint', () => {
  it('is protected and does not reveal readiness to unauthenticated callers', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request('https://example.invalid/internal'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('returns READY with booleans only when every staging gate passes', async () => {
    setReadyEnvironment();
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      status: 'verified',
      scanReadiness: 'READY',
      checks: {
        previewStagingIsolation: true,
        providerIntelligence: true,
        liveGithub: true,
        liveGithubWriteDisabled: true,
        genericDatabaseOverrideBlocked: true,
        databaseIdentity: true,
        repositoryIsolationGuard: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain('postgres.elzkxgfsciivlrejujwb');
    expect(JSON.stringify(body)).not.toContain('my-owl-staging-affected-openai');
  });

  it('blocks unsafe write mode and conflicting generic database configuration', async () => {
    setReadyEnvironment();
    process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE = 'true';
    process.env.DATABASE_URL = 'postgresql://production.invalid/postgres';
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.scanReadiness).toBe('BLOCKED');
    expect(body.checks.liveGithubWriteDisabled).toBe(false);
    expect(body.checks.genericDatabaseOverrideBlocked).toBe(false);
    expect(body).not.toHaveProperty('reason');
  });

  it('blocks when live GitHub read access is not explicitly enabled', async () => {
    setReadyEnvironment();
    process.env.APIPROOF_ENABLE_LIVE_GITHUB = 'false';
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.scanReadiness).toBe('BLOCKED');
    expect(body.checks.liveGithub).toBe(false);
  });

  it('blocks missing feature flags, incorrect repository policy, or failed identity', async () => {
    setReadyEnvironment();
    process.env.PROVIDER_INTELLIGENCE_V1_ENABLED = 'false';
    process.env.GITHUB_ALLOWED_REPOSITORY_ID = 'wrong';
    queryOne.mockResolvedValue({ database_name: 'postgres', database_user: 'unexpected' });
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.scanReadiness).toBe('BLOCKED');
    expect(body.checks.providerIntelligence).toBe(false);
    expect(body.checks.repositoryIsolationGuard).toBe(false);
    expect(body.checks.databaseIdentity).toBe(false);
  });
});
