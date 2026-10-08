import { afterEach, describe, expect, it } from 'vitest';
import {
  PREVIEW_STAGING_DATABASE_NAME,
  PREVIEW_STAGING_DATABASE_URL_USERNAME,
  readPreviewStagingDatabaseConfig,
  verifyPreviewStagingDatabaseIdentity,
} from '../apps/web/src/lib/server/db/preview-isolation.js';
import { resolveDatabaseConfig } from '../apps/web/src/lib/server/db/index.js';
import { isAuthorizedInternalRequest } from '../apps/web/src/lib/server/internal-auth.js';
import { GET as verifyPreviewDatabaseGet } from '../apps/web/src/app/api/internal/preview-database-isolation/route.js';

const stagingUrl = `postgresql://${PREVIEW_STAGING_DATABASE_URL_USERNAME}:not-a-real-secret@aws-0-ap-south-1.pooler.supabase.com/${PREVIEW_STAGING_DATABASE_NAME}`;
const originalCronSecret = process.env.CRON_SECRET;
const originalIsolation = process.env.APIPROOF_PREVIEW_STAGING_ISOLATION;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalIsolation === undefined) delete process.env.APIPROOF_PREVIEW_STAGING_ISOLATION;
  else process.env.APIPROOF_PREVIEW_STAGING_ISOLATION = originalIsolation;
});

function stagingEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    APIPROOF_PREVIEW_STAGING_ISOLATION: 'true',
    APIPROOF_DATABASE_URL: stagingUrl,
    ...overrides,
  };
}

describe('Preview staging database isolation', () => {
  it('accepts only the exact staging project URL identity', () => {
    const config = readPreviewStagingDatabaseConfig(stagingEnvironment());
    expect(config.urlUsername).toBe(PREVIEW_STAGING_DATABASE_URL_USERNAME);
    expect(config.databaseName).toBe(PREVIEW_STAGING_DATABASE_NAME);
    expect(resolveDatabaseConfig(stagingEnvironment())).toEqual({ type: 'postgres', url: stagingUrl });
  });

  it('rejects a generic database fallback when isolation is enabled', () => {
    expect(() => resolveDatabaseConfig(stagingEnvironment({ DATABASE_URL: 'postgresql://production.invalid/postgres' })))
      .toThrow('DATABASE_URL must be unset');
  });

  it('fails closed for missing staging configuration', () => {
    expect(() => resolveDatabaseConfig(stagingEnvironment({ APIPROOF_DATABASE_URL: undefined })))
      .toThrow('APIPROOF_DATABASE_URL is required');
    expect(() => resolveDatabaseConfig(stagingEnvironment({ APIPROOF_PREVIEW_STAGING_ISOLATION: undefined })))
      .not.toThrow();
  });

  it('rejects incorrect project identity and unexpected hosts', () => {
    expect(() => resolveDatabaseConfig(stagingEnvironment({
      APIPROOF_DATABASE_URL: 'postgresql://postgres.other-project:not-a-real-secret@aws-0-ap-south-1.pooler.supabase.com/postgres',
    }))).toThrow('unexpected staging project identity');
    expect(() => resolveDatabaseConfig(stagingEnvironment({
      APIPROOF_DATABASE_URL: `postgresql://${PREVIEW_STAGING_DATABASE_URL_USERNAME}:not-a-real-secret@db.example.invalid/postgres`,
    }))).toThrow('unexpected database host');
    expect(() => resolveDatabaseConfig(stagingEnvironment({
      APIPROOF_DATABASE_URL: `postgresql://${PREVIEW_STAGING_DATABASE_URL_USERNAME}:not-a-real-secret@evil.supabase.com/postgres`,
    }))).toThrow('unexpected database host');
    expect(() => resolveDatabaseConfig(stagingEnvironment({
      APIPROOF_DATABASE_URL: `postgresql://${PREVIEW_STAGING_DATABASE_URL_USERNAME}:not-a-real-secret@aws-0-ap-south-1.pooler.supabase.com/other`,
    }))).toThrow('unexpected staging database name');
  });

  it('preserves the existing production resolver when isolation is disabled', () => {
    const config = resolveDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://production.invalid/postgres',
      APIPROOF_DATABASE_URL: stagingUrl,
    });
    expect(config).toEqual({ type: 'postgres', url: 'postgresql://production.invalid/postgres' });
  });

  it('verifies only the expected PostgreSQL session identity', async () => {
    const config = readPreviewStagingDatabaseConfig(stagingEnvironment());
    let executed = false;
    const matchingDb = {
      engine: 'postgres',
      queryOne: async (sql: string) => {
        expect(sql).toContain('current_database()');
        expect(sql).toContain('current_user');
        return { database_name: PREVIEW_STAGING_DATABASE_NAME, database_user: 'postgres' };
      },
      execute: async () => { executed = true; return { changes: 0 }; },
    } as never;
    await expect(verifyPreviewStagingDatabaseIdentity(matchingDb, config)).resolves.toBe(true);
    expect(executed).toBe(false);

    const wrongIdentityDb = {
      engine: 'postgres',
      queryOne: async () => ({ database_name: PREVIEW_STAGING_DATABASE_NAME, database_user: 'wrong-user' }),
    } as never;
    await expect(verifyPreviewStagingDatabaseIdentity(wrongIdentityDb, config)).resolves.toBe(false);

    const failingDb = {
      engine: 'postgres',
      queryOne: async () => { throw new Error('connection failed'); },
    } as never;
    await expect(verifyPreviewStagingDatabaseIdentity(failingDb, config)).resolves.toBe(false);
  });

  it('keeps the internal verification endpoint authorization fail-closed without a database call', () => {
    expect(isAuthorizedInternalRequest(new Request('https://example.invalid/internal'))).toBe(false);
    expect(isAuthorizedInternalRequest(new Request('https://example.invalid/internal', {
      headers: { authorization: 'Bearer wrong' },
    }), 'expected-secret')).toBe(false);
    expect(isAuthorizedInternalRequest(new Request('https://example.invalid/internal', {
      headers: { authorization: 'Bearer expected-secret' },
    }), 'expected-secret')).toBe(true);
  });

  it('does not expose the verification endpoint without the internal bearer secret', async () => {
    delete process.env.CRON_SECRET;
    const response = await verifyPreviewDatabaseGet(new Request('https://example.invalid/api/internal/preview-database-isolation'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns only sanitized failure status when authenticated configuration is missing', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    delete process.env.APIPROOF_PREVIEW_STAGING_ISOLATION;
    const response = await verifyPreviewDatabaseGet(new Request('https://example.invalid/api/internal/preview-database-isolation', {
      headers: { authorization: 'Bearer expected-secret' },
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, status: 'unverified' });
  });
});
