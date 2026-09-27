import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { DatabaseAdapter } from './types.js';
import { SqliteDatabaseAdapter } from './sqlite-adapter.js';
import { PostgresDatabaseAdapter } from './postgres-adapter.js';

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
  const dbUrl = process.env.APIPROOF_DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (dbUrl && dbUrl.trim().length > 0) {
    return { type: 'postgres', url: dbUrl.trim() };
  }

  if (isProduction) {
    throw new Error(
      'MISSING_PRODUCTION_DATABASE_URL: APIPROOF_DATABASE_URL environment variable must be configured in production.'
    );
  }

  return { type: 'sqlite', path: getDatabasePath() };
}

/** Seed a deterministic default user and repository fixture for SQLite */
function seedDefaultUserAndFixtureSqlite(db: DatabaseSync): void {
  const userCheck = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  if (!userCheck) {
    const userId = 'usr_pilot_developer';
    const now = new Date().toISOString();

    const salt = 'apiproof_pilot_salt';
    const hash = crypto.scryptSync('apiproof2026!', salt, 64).toString('hex');
    const passwordHash = `${salt}:${hash}`;

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, 'developer@apiproof.dev', passwordHash, 'APIProof Developer', now);

    const repoId = 'repo_apiproof_fixture';
    db.prepare(`
      INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      repoId,
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
  const db = new DatabaseSync(targetPath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      github_repository_id TEXT NOT NULL,
      default_branch TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      last_scan_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, full_name)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      sha TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      input_digest TEXT,
      files_analyzed INTEGER DEFAULT 0,
      findings_count INTEGER DEFAULT 0,
      raw_result TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      usage_id TEXT NOT NULL,
      change_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence REAL NOT NULL,
      file_path TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reason TEXT NOT NULL,
      reason_codes TEXT NOT NULL,
      evidence TEXT NOT NULL,
      source_snippet TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      finding_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      plan_json TEXT NOT NULL,
      patch_diff TEXT,
      patch_digest TEXT,
      verification_report TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pull_requests (
      id TEXT PRIMARY KEY,
      migration_id TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      base_branch TEXT NOT NULL,
      url TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      repository_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS _apiproof_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repositories_user ON repositories(user_id);
    CREATE INDEX IF NOT EXISTS idx_scans_repo ON scans(repository_id);
    CREATE INDEX IF NOT EXISTS idx_findings_repo ON findings(repository_id);
    CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
    CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id);
  `);

  seedDefaultUserAndFixtureSqlite(db);

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
