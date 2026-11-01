import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { DatabaseAdapter } from './types.js';
import { SqliteDatabaseAdapter } from './sqlite-adapter.js';
import { PostgresDatabaseAdapter } from './postgres-adapter.js';
import { SQLITE_SCHEMA } from './schema.js';
import { SQLITE_VERIFICATION_WORKER_SCHEMA } from './verification-worker-migration.js';
import { SQLITE_SLACK_SCHEMA } from './slack-migration.js';
import { initializeSlackReliabilitySqlite } from './slack-reliability-migration.js';
import { SQLITE_PROVIDER_CHANGE_MONITOR_SCHEMA } from './provider-change-monitor-migration.js';
import { skipDefaultSeed } from './seed-policy.js';

export * from './types.js';
export * from './sql-utils.js';
export * from './schema.js';
export * from './sqlite-adapter.js';
export * from './postgres-adapter.js';
export * from './migrator.js';

let adapterInstance: DatabaseAdapter | null = null;
let rawSqliteInstance: DatabaseSync | null = null;

export function getDatabasePath(): string {
  if (process.env.APIPROOF_DB_PATH) {
    return process.env.APIPROOF_DB_PATH;
  }
  const rootDir = process.cwd();
  const tmpDir = path.resolve(rootDir, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return path.join(tmpDir, 'apiproof.db');
}

export type ResolvedDatabaseConfig =
  | { type: 'postgres'; url: string }
  | { type: 'sqlite'; path: string };

export function resolveDatabaseConfig(): ResolvedDatabaseConfig {
  const dbUrl = process.env.DATABASE_URL || process.env.APIPROOF_DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (dbUrl && dbUrl.trim().length > 0) {
    return { type: 'postgres', url: dbUrl.trim() };
  }

  if (isProduction) {
    throw new Error(
      'MISSING_PRODUCTION_DATABASE_URL: DATABASE_URL or APIPROOF_DATABASE_URL environment variable must be configured in production.'
    );
  }

  return { type: 'sqlite', path: getDatabasePath() };
}

/** Seed a deterministic default user and repository fixture for SQLite */
function seedDefaultUserAndFixtureSqlite(db: DatabaseSync): void {
  const userCheck = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  if (!userCheck) {
    const userId = 'usr_pilot_developer';
    const workspaceId = 'ws_pilot_developer';
    const memberId = 'wsm_pilot_developer';
    const now = new Date().toISOString();

    const seedPassword = process.env.APIPROOF_LOCAL_SEED_PASSWORD;
    if (!seedPassword) {
      throw new Error(
        'MISSING_LOCAL_SEED_PASSWORD: APIPROOF_LOCAL_SEED_PASSWORD must be configured when default SQLite seeding is enabled.'
      );
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(seedPassword, salt, 64).toString('hex');
    const passwordHash = `${salt}:${hash}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'developer@apiproof.dev', passwordHash, 'APIProof Developer', now);

    db.prepare(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspaceId, "Developer's Workspace", 'developer-workspace', now, now);

    db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `).run(memberId, workspaceId, userId, now);

    const repoId = 'repo_apiproof_fixture';
    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seeded_fixture', 'historical', ?)
    `).run(
      repoId,
      workspaceId,
      userId,
      'ravitejabolla756-sys',
      'apiproof-github-fixture',
      'ravitejabolla756-sys/apiproof-github-fixture',
      '1363070568',
      'main',
      'connected',
      now
    );

    db.prepare(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'act_init_repo',
      userId,
      repoId,
      'repository_connected',
      'Repository Connected',
      'Connected ravitejabolla756-sys/apiproof-github-fixture via GitHub App.',
      now
    );
  }
}

/**
 * Direct initialization for SQLite (preserves backward compatibility with existing tests).
 */
export function initDatabase(dbPath?: string): DatabaseSync {
  const targetPath = dbPath ?? getDatabasePath();
  const parentDir = path.dirname(targetPath);
  if (parentDir && parentDir !== '.') {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  const db = new DatabaseSync(targetPath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Schema creation
  db.exec(SQLITE_SCHEMA);
  db.exec(SQLITE_VERIFICATION_WORKER_SCHEMA);
  db.exec(SQLITE_SLACK_SCHEMA);
  db.exec(SQLITE_PROVIDER_CHANGE_MONITOR_SCHEMA);
  initializeSlackReliabilitySqlite(db);

  if (!skipDefaultSeed()) seedDefaultUserAndFixtureSqlite(db);

  rawSqliteInstance = db;
  adapterInstance = new SqliteDatabaseAdapter(db);
  return db;
}

/**
 * Returns the active DatabaseAdapter (SQLite in development/test, PostgreSQL in production).
 */
export function getDatabase(): DatabaseAdapter {
  if (adapterInstance) {
    return adapterInstance;
  }

  const config = resolveDatabaseConfig();

  if (config.type === 'postgres') {
    adapterInstance = new PostgresDatabaseAdapter(config.url);
    return adapterInstance;
  }

  const rawDb = initDatabase(config.path);
  adapterInstance = new SqliteDatabaseAdapter(rawDb);
  return adapterInstance;
}

/**
 * Alias for getDatabase() or returning DatabaseAdapter with legacy interface.
 */
export function getDb(): DatabaseAdapter {
  return getDatabase();
}

/**
 * Closes the active database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (adapterInstance) {
    await adapterInstance.close();
    adapterInstance = null;
  }
  if (rawSqliteInstance) {
    rawSqliteInstance = null;
  }
}
