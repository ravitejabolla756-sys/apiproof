import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { initDatabase, closeDatabase, SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from '../apps/web/src/lib/server/db/schema.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase2-upgrade.db');

describe('Phase 2 — Multi-Tenant Database Schema, Constraints & Upgrade Behavior', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    db = initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  it('verifies SQLite and PostgreSQL schema definitions include multi-tenant tables and indexes', () => {
    // Check SQLITE_SCHEMA
    expect(SQLITE_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(SQLITE_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS workspace_members');
    expect(SQLITE_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS github_installations');
    expect(SQLITE_SCHEMA).toContain('workspace_id TEXT');
    expect(SQLITE_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_workspaces_slug');
    expect(SQLITE_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_workspace_members_user');
    expect(SQLITE_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_repositories_workspace');
    expect(SQLITE_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_github_installations_workspace');

    // Check POSTGRES_SCHEMA
    expect(POSTGRES_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS workspaces');
    expect(POSTGRES_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS workspace_members');
    expect(POSTGRES_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS github_installations');
    expect(POSTGRES_SCHEMA).toContain('workspace_id TEXT');
    expect(POSTGRES_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_workspaces_slug');
    expect(POSTGRES_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_workspace_members_user');
    expect(POSTGRES_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_repositories_workspace');
    expect(POSTGRES_SCHEMA).toContain('CREATE INDEX IF NOT EXISTS idx_github_installations_workspace');
  });

  it('enforces UNIQUE(workspace_id, user_id) on workspace_members', async () => {
    const user = createUser('unique_mem@test.com', 'Pass12345!', 'Unique Test');
    const ws = await getDefaultWorkspaceForUser(user.id);

    expect(() => {
      db.prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
        VALUES ('wsm_dup', ?, ?, 'member', ?)
      `).run(ws.id, user.id, new Date().toISOString());
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('enforces UNIQUE(slug) on workspaces', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES ('ws_first', 'First', 'acme-hq', ?, ?)
    `).run(now, now);

    expect(() => {
      db.prepare(`
        INSERT INTO workspaces (id, name, slug, created_at, updated_at)
        VALUES ('ws_second', 'Second', 'acme-hq', ?, ?)
      `).run(now, now);
    }).toThrow(/UNIQUE constraint failed/);
  });

  it('tests upgrade behavior on an simulated v0.7 SQLite schema without workspace tables', async () => {
    // Simulate raw v0.7 tables in memory / standalone
    const legacyDb = new (await import('node:sqlite')).DatabaseSync(':memory:');
    legacyDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE repositories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        github_repository_id TEXT NOT NULL,
        default_branch TEXT NOT NULL,
        status TEXT NOT NULL,
        last_scan_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE _apiproof_migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO _apiproof_migrations VALUES ('001', 'initial_schema', '2026-09-01T00:00:00.000Z');
      INSERT INTO _apiproof_migrations VALUES ('002', 'postgres_compatibility_and_indexes', '2026-09-01T00:00:00.000Z');
    `);

    // Seed 2 existing users with repositories
    const now = new Date().toISOString();
    legacyDb.exec(`
      INSERT INTO users VALUES ('usr_alice', 'alice@corp.com', 'h1', 'Alice', '${now}');
      INSERT INTO users VALUES ('usr_bob', 'bob@corp.com', 'h2', 'Bob', '${now}');
      INSERT INTO repositories VALUES ('repo_1', 'usr_alice', 'corp', 'repo-1', 'corp/repo-1', '1', 'main', 'connected', NULL, '${now}');
      INSERT INTO repositories VALUES ('repo_2', 'usr_bob', 'corp', 'repo-2', 'corp/repo-2', '2', 'main', 'connected', NULL, '${now}');
    `);

    // Exercise the production SQLite adapter, including complete multi-statement migration DDL.
    const adapter = new SqliteDatabaseAdapter(legacyDb);

    // Run migrator
    const applied = await runMigrations(adapter);
    expect(applied.map((m) => m.id)).toContain('003');
    expect(applied.map((m) => m.id)).toContain('014');
    expect((await adapter.query<{ name: string }>('PRAGMA table_info(slack_notification_deliveries)')).map((column) => column.name)).toContain('next_attempt_at');
    expect((await adapter.query<{ name: string }>('PRAGMA table_info(slack_interaction_jobs)')).map((column) => column.name)).toContain('next_attempt_at');

    // Verify workspaces created for both existing users
    const wsAlice = await adapter.queryOne<{ id: string; name: string }>(`
      SELECT w.id, w.name FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = 'usr_alice'
    `);
    expect(wsAlice).toBeDefined();
    expect(wsAlice?.name).toBe("Alice's Workspace");

    const wsBob = await adapter.queryOne<{ id: string; name: string }>(`
      SELECT w.id, w.name FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = 'usr_bob'
    `);
    expect(wsBob).toBeDefined();
    expect(wsBob?.name).toBe("Bob's Workspace");

    // Verify repositories were assigned the appropriate workspace_id without data loss
    const repo1 = await adapter.queryOne<{ workspace_id: string }>('SELECT workspace_id FROM repositories WHERE id = ?', ['repo_1']);
    expect(repo1?.workspace_id).toBe(wsAlice?.id);

    const repo2 = await adapter.queryOne<{ workspace_id: string }>('SELECT workspace_id FROM repositories WHERE id = ?', ['repo_2']);
    expect(repo2?.workspace_id).toBe(wsBob?.id);

    legacyDb.close();
  });
});
