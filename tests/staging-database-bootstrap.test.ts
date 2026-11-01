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
  STAGING_REPOSITORY,
} from '../apps/web/src/lib/server/db/staging-bootstrap.js';
import { verifyPassword } from '../apps/web/src/lib/server/auth.js';

const tempPaths: string[] = [];
const originalSkip = process.env.APIPROOF_SKIP_DEFAULT_SEED;

function tempDbPath(): string {
  const dbPath = path.join(os.tmpdir(), `apiproof-staging-${crypto.randomUUID()}.db`);
  tempPaths.push(dbPath);
  return dbPath;
}

function restoreSkip(): void {
  if (originalSkip === undefined) delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  else process.env.APIPROOF_SKIP_DEFAULT_SEED = originalSkip;
}

afterEach(() => {
  restoreSkip();
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
    const adapter = (await import('../apps/web/src/lib/server/db/sqlite-adapter.js')).SqliteDatabaseAdapter;
    const migrationDb = new adapter(db);
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

  it('fails closed unless staging guards and controlled inputs are present', () => {
    expect(() => readStagingBootstrapConfig({
      APIPROOF_STAGING_BOOTSTRAP: 'true',
      APIPROOF_SKIP_DEFAULT_SEED: 'true',
    })).toThrow('MISSING_STAGING_BOOTSTRAP_INPUT');
    expect(() => readStagingBootstrapConfig({
      APIPROOF_STAGING_BOOTSTRAP: 'TRUE',
      APIPROOF_SKIP_DEFAULT_SEED: 'true',
    })).toThrow('STAGING_BOOTSTRAP_NOT_ENABLED');
  });

  it('bootstraps only the controlled staging identity and fixture repository', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = initDatabase(tempDbPath());
    const migrationDb = new SqliteDatabaseAdapter(db);
    await runMigrations(migrationDb);
    const config = readStagingBootstrapConfig({
      APIPROOF_STAGING_BOOTSTRAP: 'true',
      APIPROOF_SKIP_DEFAULT_SEED: 'true',
      APIPROOF_STAGING_DATABASE_URL: 'postgresql://staging.example.invalid/db',
      APIPROOF_STAGING_USER_EMAIL: 'staging@example.invalid',
      APIPROOF_STAGING_USER_PASSWORD: 'test-only-input',
      APIPROOF_STAGING_USER_NAME: 'Staging User',
      APIPROOF_STAGING_GITHUB_ACCOUNT_LOGIN: STAGING_REPOSITORY.owner,
      APIPROOF_STAGING_GITHUB_INSTALLATION_ID: '123456789',
    });
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
});
