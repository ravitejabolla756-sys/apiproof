import { describe, expect, it } from 'vitest';
import { POSTGRES_SCHEMA } from '../apps/web/src/lib/server/db/schema.js';
import {
  STAGING_OPENAI_TARGET,
  classifyStagingVerificationError,
  normalizeMaskedInput,
  validateStagingDatabaseUrl,
  verifyStagingDatabase,
  verifyStagingOpenAI,
  type ReadOnlyPool,
} from '../apps/web/scripts/staging-verify-openai.js';

const databaseUrl = `postgresql://${STAGING_OPENAI_TARGET.databaseUrlUsername}@aws-0-ap-south-1.pooler.supabase.com/postgres`;
const baseInput = {
  databaseUrl,
  appId: '12345',
  installationId: '67890',
  privateKeyPath: 'C:/operator-only/apiproof.pem',
};

function databasePool(options: { pendingCount?: number; currentUser?: string; currentDatabase?: string } = {}): ReadOnlyPool {
  const rows = [
    [{ current_user: options.currentUser ?? 'postgres', current_database: options.currentDatabase ?? 'postgres' }],
    [{ count: 1 }],
    [{ count: 1 }],
    [{ count: 1 }],
    [{ count: 1 }],
    [{ count: options.pendingCount ?? 0 }],
  ];
  const queries: string[] = [];
  return {
    queries,
    async query<T>(sql: string): Promise<{ rows: T[] }> {
      queries.push(sql);
      if (sql === 'BEGIN' || sql === 'SET TRANSACTION READ ONLY' || sql === 'ROLLBACK') return { rows: [] };
      return { rows: rows.shift() as T[] };
    },
    async connect() { return this; },
    async end() {},
  } as unknown as ReadOnlyPool;
}

function githubProvider() {
  return {
    async getRepository() { return { repositoryId: STAGING_OPENAI_TARGET.repositoryId, owner: STAGING_OPENAI_TARGET.owner, repository: STAGING_OPENAI_TARGET.repository }; },
    async getDefaultBranch() { return { name: STAGING_OPENAI_TARGET.branch, sha: 'a'.repeat(40) }; },
    async readFile() { return `import OpenAI from 'openai';\nconst client = new OpenAI();\nclient.responses.create({ model: 'gpt-4.5-preview', input: 'fixture' });`; },
    operationAllowed(operation: string) { return ['READ_REPOSITORY', 'READ_FILE', 'READ_TREE'].includes(operation); },
  };
}

describe('Windows staging OpenAI verification command', () => {
  it('maps infrastructure failures to safe reason codes without exposing messages', () => {
    expect(classifyStagingVerificationError({ code: '28P01', message: 'password contains secret' }, 'STAGING_DATABASE_READ_FAILED'))
      .toMatchObject({ code: 'STAGING_DATABASE_AUTH_FAILED', message: 'STAGING_DATABASE_AUTH_FAILED' });
    expect(classifyStagingVerificationError({ code: '42P01', message: 'relation repositories does not exist' }, 'STAGING_DATABASE_READ_FAILED'))
      .toMatchObject({ code: 'STAGING_DATABASE_SCHEMA_FAILED', message: 'STAGING_DATABASE_SCHEMA_FAILED' });
    expect(classifyStagingVerificationError({ code: '42501', message: 'permission denied for relation repositories' }, 'STAGING_DATABASE_READ_FAILED'))
      .toMatchObject({ code: 'STAGING_DATABASE_PERMISSION_FAILED', message: 'STAGING_DATABASE_PERMISSION_FAILED' });
    expect(classifyStagingVerificationError({ code: 'ENOTFOUND', message: 'database.example secret' }, 'STAGING_DATABASE_READ_FAILED'))
      .toMatchObject({ code: 'STAGING_DATABASE_NETWORK_FAILED', message: 'STAGING_DATABASE_NETWORK_FAILED' });
    expect(classifyStagingVerificationError(new Error('GITHUB_PRIVATE_KEY_UNREADABLE: private key contents'), 'GITHUB_REPOSITORY_LOOKUP_FAILED'))
      .toMatchObject({ code: 'GITHUB_PRIVATE_KEY_INVALID', message: 'GITHUB_PRIVATE_KEY_INVALID' });
    expect(classifyStagingVerificationError(new Error('GITHUB_AUTHENTICATION_FAILED'), 'GITHUB_REPOSITORY_LOOKUP_FAILED'))
      .toMatchObject({ code: 'GITHUB_INSTALLATION_AUTHORIZATION_FAILED' });
    expect(classifyStagingVerificationError(
      Object.assign(new Error('GITHUB_AUTHENTICATION_FAILED'), { cause: Object.assign(new Error('fetch failed'), { code: 'ENOTFOUND' }) }),
      'GITHUB_REPOSITORY_LOOKUP_FAILED',
    )).toMatchObject({ code: 'GITHUB_NETWORK_FAILED' });
    expect(classifyStagingVerificationError(new Error('GITHUB_REPOSITORY_NOT_FOUND'), 'GITHUB_REPOSITORY_LOOKUP_FAILED'))
      .toMatchObject({ code: 'GITHUB_REPOSITORY_LOOKUP_FAILED' });
  });

  it('normalizes PowerShell paste control characters without exposing the URL', () => {
    expect(normalizeMaskedInput(`\u0016${databaseUrl}\r\n`)).toBe(databaseUrl);
    expect(normalizeMaskedInput('\u0016\r\n')).toBe('');
  });

  it('accepts only the exact staging Supabase project identity and rejects disabled TLS', () => {
    expect(validateStagingDatabaseUrl(databaseUrl).username).toBe(STAGING_OPENAI_TARGET.databaseUrlUsername);
    expect(() => validateStagingDatabaseUrl(databaseUrl.replace(STAGING_OPENAI_TARGET.databaseUrlUsername, 'postgres.otherref'))).toThrow('STAGING_PROJECT_REF_MISMATCH');
    expect(() => validateStagingDatabaseUrl(`${databaseUrl}?sslmode=disable`)).toThrow('STAGING_TLS_DISABLE_REFUSED');
  });

  it('keeps verifier SQL aligned with the canonical PostgreSQL schema', () => {
    for (const table of ['github_installations', 'repositories', 'github_scan_requests']) {
      expect(POSTGRES_SCHEMA).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    for (const column of [
      'installation_id TEXT UNIQUE NOT NULL',
      'account_login TEXT NOT NULL',
      "status TEXT NOT NULL DEFAULT 'active'",
      'owner TEXT NOT NULL',
      'name TEXT NOT NULL',
      'github_repository_id TEXT NOT NULL',
      'default_branch TEXT NOT NULL',
      'lifecycle TEXT NOT NULL DEFAULT \'active\'',
      'commit_sha TEXT NOT NULL',
    ]) {
      expect(POSTGRES_SCHEMA).toContain(column);
    }
  });

  it('performs only read-only PostgreSQL verification and enforces the exact records', async () => {
    const pool = databasePool();
    const result = await verifyStagingDatabase(pool, databaseUrl, baseInput.installationId);
    expect(result).toMatchObject({ projectRef: STAGING_OPENAI_TARGET.projectRef, currentUser: 'postgres', currentDatabase: 'postgres', repositoryCount: 1, exactRepositoryCount: 1, installationCount: 1, exactActiveInstallationCount: 1, pendingOrProcessingCount: 0 });
    expect((pool as unknown as { queries: string[] }).queries.some((sql) => /\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i.test(sql))).toBe(false);
  });

  it('fails closed when a pending or processing request exists', async () => {
    await expect(verifyStagingDatabase(databasePool({ pendingCount: 1 }), databaseUrl, baseInput.installationId)).rejects.toMatchObject({ code: 'STAGING_RECORD_GATE_FAILED' });
  });

  it('fails closed when PostgreSQL session identity is unexpected', async () => {
    await expect(verifyStagingDatabase(databasePool({ currentUser: 'app', currentDatabase: 'production' }), databaseUrl, baseInput.installationId))
      .rejects.toMatchObject({ code: 'STAGING_SQL_IDENTITY_MISMATCH' });
  });

  it('classifies database authentication and schema failures at their source', async () => {
    const authPool = { async connect() { throw Object.assign(new Error('password authentication failed'), { code: '28P01' }); }, async query() {}, async end() {} } as unknown as ReadOnlyPool;
    await expect(verifyStagingDatabase(authPool, databaseUrl, baseInput.installationId))
      .rejects.toMatchObject({ code: 'STAGING_DATABASE_AUTH_FAILED', details: { stage: 'connect', sqlStateClass: '28' } });

    const schemaPool = databasePool();
    const originalQuery = schemaPool.query;
    schemaPool.query = (async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM repositories')) throw Object.assign(new Error('relation repositories does not exist'), { code: '42P01' });
      return originalQuery(sql, params);
    }) as ReadOnlyPool['query'];
    await expect(verifyStagingDatabase(schemaPool, databaseUrl, baseInput.installationId))
      .rejects.toMatchObject({ code: 'STAGING_DATABASE_SCHEMA_FAILED', details: { stage: 'repositories_count', sqlStateClass: '42' } });
  });

  it('retains the failing database stage and SQLSTATE class for unknown read errors', async () => {
    const pool = databasePool();
    const originalQuery = pool.query;
    pool.query = (async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM repositories')) throw Object.assign(new Error('password=secret'), { code: 'XX999' });
      return originalQuery(sql, params);
    }) as ReadOnlyPool['query'];
    await expect(verifyStagingDatabase(pool, databaseUrl, baseInput.installationId))
      .rejects.toMatchObject({ code: 'STAGING_DATABASE_READ_FAILED', message: 'STAGING_DATABASE_READ_FAILED', details: { stage: 'repositories_count', sqlStateClass: 'XX' } });
  });

  it('verifies the exact OpenAI fixture through the read-only GitHub provider', async () => {
    const result = await verifyStagingOpenAI(baseInput, { pool: databasePool(), github: githubProvider() as never });
    expect(result.github).toMatchObject({ repositoryId: STAGING_OPENAI_TARGET.repositoryId, owner: STAGING_OPENAI_TARGET.owner, repository: STAGING_OPENAI_TARGET.repository, branch: 'main', fixtureSource: 'PASS', writes: 'BLOCKED' });
    expect(result.github.commitSha).toHaveLength(40);
  });

  it('rejects a fixture without the exact static model usage', async () => {
    const provider = { ...githubProvider(), async readFile() { return 'client.responses.create({ model: process.env.MODEL });'; } };
    await expect(verifyStagingOpenAI(baseInput, { pool: databasePool(), github: provider as never })).rejects.toMatchObject({ code: 'OPENAI_FIXTURE_SOURCE_MISMATCH' });
  });

  it('classifies GitHub installation and fixture-read failures safely', async () => {
    const unauthorizedProvider = { ...githubProvider(), async getRepository() { throw new Error('GITHUB_AUTHENTICATION_FAILED'); } };
    await expect(verifyStagingOpenAI(baseInput, { pool: databasePool(), github: unauthorizedProvider as never }))
      .rejects.toMatchObject({ code: 'GITHUB_INSTALLATION_AUTHORIZATION_FAILED' });

    const missingFixtureProvider = { ...githubProvider(), async readFile() { throw new Error('GITHUB_FILE_NOT_FOUND'); } };
    await expect(verifyStagingOpenAI(baseInput, { pool: databasePool(), github: missingFixtureProvider as never }))
      .rejects.toMatchObject({ code: 'OPENAI_FIXTURE_FILE_MISSING' });
  });

  it('rejects invalid App credentials before any verification work', async () => {
    await expect(verifyStagingOpenAI({ ...baseInput, appId: 'not-a-number' }, { pool: databasePool(), github: githubProvider() as never })).rejects.toMatchObject({ code: 'GITHUB_APP_ID_INVALID' });
  });
});
