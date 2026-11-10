import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { migrations, runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';

const sqliteDatabases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of sqliteDatabases.splice(0)) db.close();
});

function sqliteAdapter(db: DatabaseSync): DatabaseAdapter {
  return {
    engine: 'sqlite',
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params as never[]) as T[];
    },
    async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      return db.prepare(sql).get(...params as never[]) as T | undefined;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      if (!params.length && sql.includes(';')) {
        db.exec(sql);
        return { changes: 0 };
      }
      const result = db.prepare(sql).run(...params as never[]);
      return { changes: Number(result.changes) };
    },
    async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
      db.exec('BEGIN TRANSACTION');
      try {
        const result = await fn(this);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async close(): Promise<void> { db.close(); },
  };
}

function newSQLite(): { raw: DatabaseSync; adapter: DatabaseAdapter } {
  const raw = new DatabaseSync(':memory:');
  sqliteDatabases.push(raw);
  return { raw, adapter: sqliteAdapter(raw) };
}

function createLedger(raw: DatabaseSync, rows: readonly { id: string; name: string; appliedAt: string }[]): void {
  raw.exec(`CREATE TABLE _apiproof_migrations (id TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)`);
  const insert = raw.prepare('INSERT INTO _apiproof_migrations (id, name, applied_at) VALUES (?, ?, ?)');
  for (const row of rows) insert.run(row.id, row.name, row.appliedAt);
}

function ledgerRows(raw: DatabaseSync): unknown[] {
  return raw.prepare('SELECT id, name, applied_at FROM _apiproof_migrations ORDER BY id').all();
}

describe('migration transaction safety', () => {
  it('accepts a valid complete history and performs no repeat DDL', async () => {
    const { raw, adapter } = newSQLite();
    createLedger(raw, migrations.map((migration) => ({ id: migration.id, name: migration.name, appliedAt: '2026-11-11T00:00:00.000Z' })));
    const before = raw.prepare("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
    expect(await runMigrations(adapter)).toEqual([]);
    expect(raw.prepare("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all()).toEqual(before);
  });

  it.each([
    ['mismatched identity', [{ id: '001', name: 'wrong_name', appliedAt: '2026-11-11T00:00:00.000Z' }]],
    ['unknown historical ID', [{ id: '999', name: 'unknown', appliedAt: '2026-11-11T00:00:00.000Z' }]],
    ['024 collision identity', [{ id: '024', name: 'workspace_invitations_and_audit_events', appliedAt: '2026-11-11T00:00:00.000Z' }]],
  ])('rejects %s before pending SQLite DDL', async (_label, rows) => {
    const { raw, adapter } = newSQLite();
    createLedger(raw, rows);
    const beforeObjects = raw.prepare("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const beforeLedger = ledgerRows(raw);
    await expect(runMigrations(adapter)).rejects.toThrow('MIGRATION_HISTORY_INCOMPATIBLE');
    expect(raw.prepare("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all()).toEqual(beforeObjects);
    expect(ledgerRows(raw)).toEqual(beforeLedger);
  });

  it('rejects incomplete records and duplicate IDs in the compatibility boundary', async () => {
    const { raw, adapter } = newSQLite();
    createLedger(raw, [{ id: '001', name: '', appliedAt: '' }]);
    await expect(runMigrations(adapter)).rejects.toThrow('MIGRATION_HISTORY_INCOMPATIBLE');
    expect(ledgerRows(raw)).toEqual([{ id: '001', name: '', applied_at: '' }]);
  });

  it('permits a subsequent valid repeat after the rejected history is repaired', async () => {
    const { raw, adapter } = newSQLite();
    createLedger(raw, [{ id: '001', name: 'wrong_name', appliedAt: '2026-11-11T00:00:00.000Z' }]);
    await expect(runMigrations(adapter)).rejects.toThrow('MIGRATION_HISTORY_INCOMPATIBLE');
    raw.prepare("UPDATE _apiproof_migrations SET name = 'initial_schema' WHERE id = '001'").run();
    const complete = migrations.map((migration) => ({ id: migration.id, name: migration.name, appliedAt: '2026-11-11T00:00:00.000Z' }));
    for (const row of complete.slice(1)) raw.prepare('INSERT INTO _apiproof_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(row.id, row.name, row.appliedAt);
    expect(await runMigrations(adapter)).toEqual([]);
  });

  it('records PostgreSQL lock and preflight ordering, without claiming live PostgreSQL proof', async () => {
    const events: string[] = [];
    const db: DatabaseAdapter = {
      engine: 'postgres',
      async query<T = unknown>(sql: string): Promise<T[]> {
        if (sql.includes('_apiproof_migrations')) return [{ id: '001', name: 'wrong_name', applied_at: '2026-11-11T00:00:00.000Z' }] as T[];
        return [];
      },
      async queryOne<T = unknown>(): Promise<T | undefined> { return undefined; },
      async execute(sql: string): Promise<{ changes: number }> {
        events.push(sql);
        return { changes: 0 };
      },
      async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
        events.push('BEGIN');
        try { const result = await fn(this); events.push('COMMIT'); return result; }
        catch (error) { events.push('ROLLBACK'); throw error; }
      },
      async close(): Promise<void> {},
    };

    await expect(runMigrations(db)).rejects.toThrow('MIGRATION_HISTORY_INCOMPATIBLE');
    expect(events[0]).toBe('BEGIN');
    expect(events[1]).toContain('pg_advisory_xact_lock');
    expect(events[2]).toContain('CREATE TABLE IF NOT EXISTS _apiproof_migrations');
    expect(events.at(-1)).toBe('ROLLBACK');
    expect(events.some((event) => event.includes('INSERT INTO _apiproof_migrations'))).toBe(false);
  });
});
