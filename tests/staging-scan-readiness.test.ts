import { afterEach, describe, expect, it, vi } from 'vitest';

const { queryOne, getDatabase, loggerError } = vi.hoisted(() => {
  const queryOne = vi.fn();
  const loggerError = vi.fn();
  const getDatabase = vi.fn(() => ({
    engine: 'postgres',
    queryOne,
  }));
  return { queryOne, getDatabase, loggerError };
});

vi.mock('../apps/web/src/lib/server/db/index.js', () => ({
  getDatabase,
  resolveDatabaseConfig: (environment: NodeJS.ProcessEnv) => ({
    type: 'postgres',
    url: environment.APIPROOF_DATABASE_URL,
  }),
}));

vi.mock('../apps/web/src/lib/server/logger.js', () => ({
  logger: { error: loggerError },
}));

import { GET } from '../apps/web/src/app/api/internal/staging-scan-readiness/route.js';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  queryOne.mockReset();
  getDatabase.mockClear();
  loggerError.mockReset();
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
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('returns READY with booleans only when every staging gate passes', async () => {
    setReadyEnvironment();
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(200);
    const body = await response.json() as { scanReadiness: string; checks: { liveGithubWriteDisabled: boolean; genericDatabaseOverrideBlocked: boolean } };
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
    const body = await response.json() as { scanReadiness: string; checks: { liveGithubWriteDisabled: boolean; genericDatabaseOverrideBlocked: boolean } };
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
    const body = await response.json() as { scanReadiness: string; checks: { previewStagingIsolation: boolean; providerIntelligence: boolean; liveGithub: boolean; liveGithubWriteDisabled: boolean; genericDatabaseOverrideBlocked: boolean; databaseIdentity: boolean; repositoryIsolationGuard: boolean } };
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
    const body = await response.json() as { scanReadiness: string; checks: { previewStagingIsolation: boolean; providerIntelligence: boolean; liveGithub: boolean; liveGithubWriteDisabled: boolean; genericDatabaseOverrideBlocked: boolean; databaseIdentity: boolean; repositoryIsolationGuard: boolean } };
    expect(body.scanReadiness).toBe('BLOCKED');
    expect(body.checks.providerIntelligence).toBe(false);
    expect(body.checks.repositoryIsolationGuard).toBe(false);
    expect(body.checks.databaseIdentity).toBe(false);
  });

  it('logs only a fixed identity-mismatch category and stage', async () => {
    setReadyEnvironment();
    queryOne.mockResolvedValue({ database_name: 'postgres', database_user: 'unexpected' });
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(503);
    expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
      category: 'DB_IDENTITY_MISMATCH',
      stage: 'identity-comparison',
    });
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('unexpected');
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('postgresql://');
  });

  it('classifies TLS and authentication failures without logging raw errors', async () => {
    setReadyEnvironment();
    queryOne.mockRejectedValueOnce(Object.assign(new Error('secret password'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    }));
    await GET(authorizedRequest());
    expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
      category: 'DB_TLS_CERTIFICATE_UNTRUSTED',
      stage: 'identity-query',
    });

    loggerError.mockReset();
    queryOne.mockRejectedValueOnce(Object.assign(new Error('secret password'), { code: '28P01' }));
    await GET(authorizedRequest());
    expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
      category: 'DB_AUTHENTICATION_FAILED',
      stage: 'identity-query',
    });
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('secret password');
  });

  it('classifies network, query, configuration, and unknown failures safely', async () => {
    setReadyEnvironment();
    for (const [code, category] of [
      ['ETIMEDOUT', 'DB_CONNECTION_TIMEOUT'],
      ['ENOTFOUND', 'DB_DNS_FAILED'],
      ['ECONNREFUSED', 'DB_CONNECTION_REFUSED'],
      ['ECONNRESET', 'DB_CONNECTION_RESET'],
      ['EPIPE', 'DB_CONNECTION_OTHER'],
      ['SOME_UNKNOWN_CODE', 'DB_QUERY_FAILED'],
    ] as const) {
      loggerError.mockReset();
      queryOne.mockRejectedValueOnce(Object.assign(new Error('raw sensitive detail'), { code }));
      await GET(authorizedRequest());
      expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
        category,
        stage: 'identity-query',
      });
    }
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('raw sensitive detail');
  });

  it('classifies missing configuration and pool construction failures without changing the response contract', async () => {
    setReadyEnvironment();
    delete process.env.APIPROOF_DATABASE_URL;
    const missingResponse = await GET(authorizedRequest());
    expect(missingResponse.status).toBe(503);
    expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
      category: 'DB_CONFIG_MISSING',
      stage: 'configuration',
    });

    loggerError.mockReset();
    setReadyEnvironment();
    getDatabase.mockImplementationOnce(() => {
      throw new Error('POSTGRES_TLS_DISABLE_REFUSED');
    });
    const constructionResponse = await GET(authorizedRequest());
    expect(constructionResponse.status).toBe(503);
    expect(loggerError).toHaveBeenCalledWith('MYOWL_STAGING_DB_DIAGNOSTIC', {
      category: 'DB_CONFIG_INVALID',
      stage: 'adapter-construction',
    });
    const body = await constructionResponse.json() as { checks: Record<string, boolean>; reason?: string };
    expect(body).not.toHaveProperty('reason');
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain('POSTGRES_TLS_DISABLE_REFUSED');
  });
});
