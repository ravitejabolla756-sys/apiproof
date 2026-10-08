import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import { skipDefaultSeed } from '../apps/web/src/lib/server/db/seed-policy.js';
import { SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/sqlite-adapter.js';
import {
  bootstrapStagingDatabase,
  readStagingBootstrapConfig,
  STAGING_DATABASE_NAME,
  STAGING_DATABASE_SESSION_USER,
  STAGING_DATABASE_URL_USERNAME,
  STAGING_REPOSITORY,
  verifyStagingDatabaseIdentity,
} from '../apps/web/src/lib/server/db/staging-bootstrap.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';
import { verifyPassword } from '../apps/web/src/lib/server/auth.js';

const tempPaths: string[] = [];
const originalEnvironment = { ...process.env };

function tempDbPath(): string {
  const dbPath = path.join(os.tmpdir(), `apiproof-staging-${crypto.randomUUID()}.db`);
  tempPaths.push(dbPath);
  return dbPath;
}

function restoreEnvironment(): void {
  for (const name of Object.keys(process.env)) {
    if (!(name in originalEnvironment)) delete process.env[name];
  }
  for (const [name, value] of Object.entries(originalEnvironment)) {
    process.env[name] = value;
  }
}

function stagingEnvironment(): NodeJS.ProcessEnv {
  return {
    APIPROOF_STAGING_BOOTSTRAP: 'true',
    APIPROOF_SKIP_DEFAULT_SEED: 'true',
    APIPROOF_STAGING_DATABASE_URL: `postgresql://${STAGING_DATABASE_URL_USERNAME}:secret@aws-0-ap-south-1.pooler.supabase.com/${STAGING_DATABASE_NAME}`,
    APIPROOF_STAGING_EXPECTED_URL_USERNAME: STAGING_DATABASE_URL_USERNAME,
    APIPROOF_STAGING_EXPECTED_DB_NAME: STAGING_DATABASE_NAME,
    APIPROOF_STAGING_USER_EMAIL: 'staging@example.invalid',
    APIPROOF_STAGING_USER_PASSWORD: 'test-only-input',
    APIPROOF_STAGING_USER_NAME: 'Staging User',
    APIPROOF_STAGING_GITHUB_ACCOUNT_LOGIN: STAGING_REPOSITORY.owner,
    APIPROOF_STAGING_GITHUB_INSTALLATION_ID: '123456789',
  };
}

afterEach(() => {
  restoreEnvironment();
  for (const dbPath of tempPaths.splice(0)) {
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.rmSync(`${dbPath}${suffix}`, { force: true }); } catch { /* test cleanup */ }
    }
  }
});

describe('safe staging database seed policy', () => {
  it('preserves the default fixture when the flag is absent', () => {
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
    const db = initDatabase(tempDbPath());
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM repositories WHERE name = 'apiproof-github-fixture'").get()).toEqual({ count: 1 });
    db.close();
  });

  it('creates the complete schema without default records when enabled', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = initDatabase(tempDbPath());
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM repositories').get()).toEqual({ count: 0 });
    const migrationDb = new SqliteDatabaseAdapter(db);
    const applied = await runMigrations(migrationDb);
    expect(applied.length).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM _apiproof_migrations').get()).not.toEqual({ count: 0 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'findings'").get()).toBeTruthy();
    db.close();
  });

  it('enables skipping only for the exact lowercase true literal', () => {
    expect(skipDefaultSeed({ APIPROOF_SKIP_DEFAULT_SEED: 'true' })).toBe(true);
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
      expect(skipDefaultSeed({ APIPROOF_SKIP_DEFAULT_SEED: value })).toBe(false);
    }
  });

  it('keeps migration idempotent in schema-only mode', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = initDatabase(tempDbPath());
    const migrationDb = new SqliteDatabaseAdapter(db);
    const first = await runMigrations(migrationDb);
    const second = await runMigrations(migrationDb);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 0 });
    db.close();
  });

  it('requires exact staging guards and explicit database identity', () => {
    expect(() => readStagingBootstrapConfig({
      APIPROOF_STAGING_BOOTSTRAP: 'TRUE',
      APIPROOF_SKIP_DEFAULT_SEED: 'true',
    })).toThrow('STAGING_BOOTSTRAP_NOT_ENABLED');
    expect(() => readStagingBootstrapConfig({
      APIPROOF_STAGING_BOOTSTRAP: 'true',
      APIPROOF_SKIP_DEFAULT_SEED: 'true',
    })).toThrow('MISSING_STAGING_BOOTSTRAP_INPUT');
    expect(() => readStagingBootstrapConfig({
      ...stagingEnvironment(),
      DATABASE_URL: 'postgresql://production.invalid/postgres',
    })).toThrow('generic database variables must be unset');
    expect(() => readStagingBootstrapConfig({
      ...stagingEnvironment(),
      APIPROOF_STAGING_EXPECTED_URL_USERNAME: 'postgres.otherref',
    })).toThrow('exact staging project identity');
    expect(() => readStagingBootstrapConfig({
      ...stagingEnvironment(),
      APIPROOF_STAGING_DATABASE_URL: 'postgresql://postgres.otherref:secret@aws-0-ap-south-1.pooler.supabase.com/postgres',
      APIPROOF_STAGING_EXPECTED_URL_USERNAME: 'postgres.otherref',
    })).toThrow('exact staging project identity');
    expect(() => readStagingBootstrapConfig({
      ...stagingEnvironment(),
      APIPROOF_STAGING_DATABASE_URL: 'postgresql://user:secret@example.invalid/postgres',
    })).toThrow('Supabase PostgreSQL host');
  });

  it('verifies the connected PostgreSQL database identity before migration', async () => {
    const config = readStagingBootstrapConfig(stagingEnvironment());
    const matchingDb = {
      engine: 'postgres',
      queryOne: async () => ({ database_name: STAGING_DATABASE_NAME, database_user: STAGING_DATABASE_SESSION_USER }),
    } as unknown as DatabaseAdapter;
    await expect(verifyStagingDatabaseIdentity(matchingDb, config)).resolves.toBeUndefined();

    const mismatchedDb = {
      engine: 'postgres',
      queryOne: async () => ({ database_name: STAGING_DATABASE_NAME, database_user: 'postgres.productionref' }),
    } as unknown as DatabaseAdapter;
    await expect(verifyStagingDatabaseIdentity(mismatchedDb, config)).rejects.toThrow('connected database identity');

    const mismatchedDatabase = {
      engine: 'postgres',
      queryOne: async () => ({ database_name: 'production', database_user: STAGING_DATABASE_SESSION_USER }),
    } as unknown as DatabaseAdapter;
    await expect(verifyStagingDatabaseIdentity(mismatchedDatabase, config)).rejects.toThrow('connected database identity');
  });

  it('bootstraps only the controlled staging identity and fixture repository idempotently', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = initDatabase(tempDbPath());
    const migrationDb = new SqliteDatabaseAdapter(db);
    await runMigrations(migrationDb);
    const config = readStagingBootstrapConfig(stagingEnvironment());
    const first = await bootstrapStagingDatabase(migrationDb, config);
    const second = await bootstrapStagingDatabase(migrationDb, config);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await migrationDb.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM users')).toEqual({ count: 1 });
    expect(await migrationDb.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM repositories')).toEqual({ count: 1 });
    expect(await migrationDb.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM scans')).toEqual({ count: 0 });
    const user = await migrationDb.queryOne<{ password_hash: string }>('SELECT password_hash FROM users LIMIT 1');
    expect(user && verifyPassword('test-only-input', user.password_hash)).toBe(true);
    expect(await migrationDb.queryOne<{ full_name: string; github_repository_id: string; default_branch: string }>('SELECT full_name, github_repository_id, default_branch FROM repositories LIMIT 1')).toEqual({
      full_name: STAGING_REPOSITORY.fullName,
      github_repository_id: STAGING_REPOSITORY.githubRepositoryId,
      default_branch: STAGING_REPOSITORY.defaultBranch,
    });
    db.close();
  });

  it('refuses unexpected application data before inserting any staging record', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = initDatabase(tempDbPath());
    const migrationDb = new SqliteDatabaseAdapter(db);
    await runMigrations(migrationDb);
    await migrationDb.execute(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)',
      ['unexpected', 'unexpected@example.invalid', 'not-a-real-secret', 'Unexpected', new Date().toISOString()],
    );
    await expect(bootstrapStagingDatabase(migrationDb, readStagingBootstrapConfig(stagingEnvironment())))
      .rejects.toThrow('unexpected records');
    expect(await migrationDb.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM repositories')).toEqual({ count: 0 });
    db.close();
  });
});
