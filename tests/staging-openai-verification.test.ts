import { describe, expect, it } from 'vitest';
import {
  STAGING_OPENAI_TARGET,
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
  it('normalizes PowerShell paste control characters without exposing the URL', () => {
    expect(normalizeMaskedInput(`\u0016${databaseUrl}\r\n`)).toBe(databaseUrl);
    expect(normalizeMaskedInput('\u0016\r\n')).toBe('');
  });

  it('accepts only the exact staging Supabase project identity and rejects disabled TLS', () => {
    expect(validateStagingDatabaseUrl(databaseUrl).username).toBe(STAGING_OPENAI_TARGET.databaseUrlUsername);
    expect(() => validateStagingDatabaseUrl(databaseUrl.replace(STAGING_OPENAI_TARGET.databaseUrlUsername, 'postgres.otherref'))).toThrow('STAGING_PROJECT_REF_MISMATCH');
    expect(() => validateStagingDatabaseUrl(`${databaseUrl}?sslmode=disable`)).toThrow('STAGING_TLS_DISABLE_REFUSED');
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

  it('verifies the exact OpenAI fixture through the read-only GitHub provider', async () => {
    const result = await verifyStagingOpenAI(baseInput, { pool: databasePool(), github: githubProvider() as never });
    expect(result.github).toMatchObject({ repositoryId: STAGING_OPENAI_TARGET.repositoryId, owner: STAGING_OPENAI_TARGET.owner, repository: STAGING_OPENAI_TARGET.repository, branch: 'main', fixtureSource: 'PASS', writes: 'BLOCKED' });
    expect(result.github.commitSha).toHaveLength(40);
  });

  it('rejects a fixture without the exact static model usage', async () => {
    const provider = { ...githubProvider(), async readFile() { return 'client.responses.create({ model: process.env.MODEL });'; } };
    await expect(verifyStagingOpenAI(baseInput, { pool: databasePool(), github: provider as never })).rejects.toMatchObject({ code: 'OPENAI_FIXTURE_SOURCE_MISMATCH' });
  });

  it('rejects invalid App credentials before any verification work', async () => {
    await expect(verifyStagingOpenAI({ ...baseInput, appId: 'not-a-number' }, { pool: databasePool(), github: githubProvider() as never })).rejects.toMatchObject({ code: 'GITHUB_APP_ID_INVALID' });
  });
});
