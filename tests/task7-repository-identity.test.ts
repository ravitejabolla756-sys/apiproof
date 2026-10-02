import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import { requireRepositoryAccess } from '../apps/web/src/lib/server/workspace-service.js';

const TEST_DB_PATH = path.resolve('.tmp/task7-repository-identity.db');
const GITHUB_ID = '1363070568';

describe('Task 7 authoritative repository identity', () => {
  beforeEach(async () => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.NODE_ENV = 'test';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
    await runMigrations(getDatabase());
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('keeps the seeded fixture historical only when explicitly reconciled', async () => {
    const db = getDatabase();
    const fixture = await db.queryOne<{ origin: string; lifecycle: string }>(
      'SELECT origin, lifecycle FROM repositories WHERE id = ?',
      ['repo_apiproof_fixture']
    );

    expect(fixture).toEqual({ origin: 'seeded_fixture', lifecycle: 'historical' });

    await db.execute(
      "UPDATE repositories SET origin = 'seeded_fixture', lifecycle = 'historical' WHERE id = ?",
      ['repo_apiproof_fixture']
    );
    const historical = await db.queryOne<{ lifecycle: string }>(
      'SELECT lifecycle FROM repositories WHERE id = ?',
      ['repo_apiproof_fixture']
    );
    expect(historical?.lifecycle).toBe('historical');
  });

  it('allows historical duplicates but rejects a second active GitHub identity', async () => {
    const db = getDatabase();
    await db.execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'seeded_fixture', 'historical', ?)
    `, [
      'repo_historical', 'ws_pilot_developer', 'usr_pilot_developer',
      'ravitejabolla756-sys', 'historical-copy',
      'ravitejabolla756-sys/historical-copy', GITHUB_ID, 'main', new Date().toISOString(),
    ]);

    await db.execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)
    `, [
      'repo_active', 'ws_pilot_developer', 'usr_pilot_developer',
      'ravitejabolla756-sys', 'active-copy', 'ravitejabolla756-sys/active-copy',
      GITHUB_ID, 'main', new Date().toISOString(),
    ]);

    await expect(db.execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)
    `, [
      'repo_duplicate_active', 'ws_pilot_developer', 'usr_pilot_developer',
      'ravitejabolla756-sys', 'duplicate', 'ravitejabolla756-sys/duplicate',
      GITHUB_ID, 'main', new Date().toISOString(),
    ])).rejects.toThrow();
  });

  it('runs the identity migration exactly once and is idempotent', async () => {
    const db = getDatabase();
    const before = await db.query<{ id: string }>(
      "SELECT id FROM _apiproof_migrations WHERE id = '010'"
    );
    expect(before).toHaveLength(1);

    expect(await runMigrations(db)).toEqual([]);
    const after = await db.query<{ id: string }>(
      "SELECT id FROM _apiproof_migrations WHERE id = '010'"
    );
    expect(after).toHaveLength(1);
  });

  it('does not let an authenticated user resolve another workspace repository by ID', async () => {
    const db = getDatabase();
    await db.execute(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES ('usr_other', 'other@example.com', 'test', 'Other', ?)
    `, [new Date().toISOString()]);
    await db.execute(`
      INSERT INTO workspaces (id, name, slug, created_at, updated_at)
      VALUES ('ws_other', 'Other', 'other', ?, ?)
    `, [new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wsm_other', 'ws_other', 'usr_other', 'owner', ?)
    `, [new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (
        id, workspace_id, user_id, owner, name, full_name, github_repository_id,
        default_branch, status, origin, lifecycle, created_at
      ) VALUES ('repo_other', 'ws_other', 'usr_other', 'other', 'repo', 'other/repo', '999', 'main', 'connected', 'connected', 'active', ?)
    `, [new Date().toISOString()]);

    await expect(requireRepositoryAccess('repo_other', 'usr_pilot_developer')).rejects.toThrow('not found or access denied');
  });

  it('does not authorize historical repositories through the live access boundary', async () => {
    const db = getDatabase();
    await db.execute("UPDATE repositories SET lifecycle = 'historical' WHERE id = 'repo_apiproof_fixture'");
    await expect(requireRepositoryAccess('repo_apiproof_fixture', 'usr_pilot_developer')).rejects.toThrow('not found or access denied');
  });
});
