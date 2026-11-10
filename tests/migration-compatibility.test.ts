import { describe, expect, it } from 'vitest';
import { validateMigrationHistory, type MigrationIdentity } from '../apps/web/src/lib/server/db/migration-compatibility.js';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';

const collisions: readonly MigrationIdentity[] = [
  { id: '024', name: 'email_verification' },
  { id: '025', name: 'finding_lifecycle' },
  { id: '026', name: 'finding_resolution_verification' },
  { id: '027', name: 'workspace_member_revocation' },
];

const member2Names: readonly MigrationIdentity[] = [
  { id: '024', name: 'workspace_invitations_and_audit_events' },
  { id: '025', name: 'notification_preferences' },
  { id: '026', name: 'email_delivery_ledger' },
  { id: '027', name: 'slack_scan_failure_deliveries' },
];

const applied = (available: readonly MigrationIdentity[]) => available.map((migration) => ({
  ...migration,
  appliedAt: '2026-11-11T00:00:00.000Z',
}));

describe('migration compatibility preflight', () => {
  it('accepts a fresh database without applied records', () => {
    const result = validateMigrationHistory({ available: collisions, applied: [] });
    expect(result).toEqual({ compatible: true, pending: [...collisions], errors: [] });
  });

  it('accepts a complete Member 1 legacy history and has no pending migrations', () => {
    const result = validateMigrationHistory({ available: collisions, applied: applied(collisions) });
    expect(result.compatible).toBe(true);
    expect(result.pending).toEqual([]);
  });

  it('accepts a complete Member 2 legacy history against its own registry', () => {
    const result = validateMigrationHistory({ available: member2Names, applied: applied(member2Names) });
    expect(result.compatible).toBe(true);
  });

  it('fails closed for mixed histories with the same ids and different names', () => {
    const result = validateMigrationHistory({ available: collisions, applied: applied(member2Names) });
    expect(result.compatible).toBe(false);
    expect(result.errors).toEqual([
      'MIGRATION_ID_NAME_CONFLICT:024:workspace_invitations_and_audit_events:email_verification',
      'MIGRATION_ID_NAME_CONFLICT:025:notification_preferences:finding_lifecycle',
      'MIGRATION_ID_NAME_CONFLICT:026:email_delivery_ledger:finding_resolution_verification',
      'MIGRATION_ID_NAME_CONFLICT:027:slack_scan_failure_deliveries:workspace_member_revocation',
    ]);
  });

  it('fails closed for duplicate and unknown applied records', () => {
    const result = validateMigrationHistory({
      available: collisions,
      applied: [
        { id: '024', name: 'email_verification', appliedAt: '2026-11-11T00:00:00.000Z' },
        { id: '024', name: 'email_verification', appliedAt: '2026-11-11T00:00:01.000Z' },
        { id: '999', name: 'unrecognized', appliedAt: '2026-11-11T00:00:02.000Z' },
      ],
    });
    expect(result.compatible).toBe(false);
    expect(result.errors).toEqual([
      'DUPLICATE_APPLIED_ID:024',
      'UNKNOWN_APPLIED_ID:999',
    ]);
  });

  it('fails closed for incomplete records and is deterministic on repeat execution', () => {
    const input = {
      available: collisions,
      applied: [{ id: '024', name: '', appliedAt: '' }],
    };
    const first = validateMigrationHistory(input);
    const second = validateMigrationHistory(input);
    expect(first).toEqual(second);
    expect(first.compatible).toBe(false);
    expect(first.errors).toEqual([
      'MIGRATION_ID_NAME_CONFLICT:024::email_verification',
      'INCOMPLETE_APPLIED_RECORD:024:appliedAt',
      'INCOMPLETE_APPLIED_RECORD:024:name',
    ]);
  });

  it('fails closed when a partially applied schema is missing an expected object', () => {
    const result = validateMigrationHistory({
      available: collisions,
      applied: applied(collisions),
      schema: { engine: 'sqlite', expectedObjects: ['email_verification_tokens', 'finding_lifecycle_events'], observedObjects: ['email_verification_tokens'] },
    });
    expect(result.compatible).toBe(false);
    expect(result.errors).toContain('MISSING_SCHEMA_OBJECT:sqlite:finding_lifecycle_events');
  });

  it('fails closed for unexpected schema objects', () => {
    const result = validateMigrationHistory({
      available: collisions,
      applied: applied(collisions),
      schema: { engine: 'postgres', expectedObjects: ['workspace_security_audit_events'], observedObjects: ['workspace_security_audit_events', 'unknown_table'] },
    });
    expect(result.errors).toEqual(['UNEXPECTED_SCHEMA_OBJECT:postgres:unknown_table']);
  });

  it('models a PostgreSQL legacy history independently from SQLite', () => {
    const result = validateMigrationHistory({
      available: collisions,
      applied: applied(collisions),
      schema: { engine: 'postgres', expectedObjects: ['workspace_security_audit_events'], observedObjects: ['workspace_security_audit_events'] },
    });
    expect(result.compatible).toBe(true);
  });

  it('fails closed for a missing ledger record even when schema objects exist', () => {
    const result = validateMigrationHistory({
      available: collisions,
      applied: applied(collisions).slice(0, 3),
      schema: { engine: 'sqlite', expectedObjects: ['workspace_security_audit_events'], observedObjects: ['workspace_security_audit_events'] },
    });
    expect(result.compatible).toBe(true);
    expect(result.pending).toEqual([collisions[3]]);
  });

  it('does not mutate inputs and remains idempotent across repeated validation', () => {
    const input = { available: collisions, applied: applied(collisions) };
    const before = JSON.stringify(input);
    const first = validateMigrationHistory(input);
    const second = validateMigrationHistory(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('blocks the real runner before migration DDL on an ID/name conflict', async () => {
    const executed: string[] = [];
    const db: DatabaseAdapter = {
      engine: 'sqlite',
      async query<T = unknown>(sql: string): Promise<T[]> {
        if (sql.includes('_apiproof_migrations')) {
          return [{ id: '001', name: 'wrong_name', applied_at: '2026-11-11T00:00:00.000Z' }] as T[];
        }
        return [];
      },
      async queryOne<T = unknown>(): Promise<T | undefined> { return undefined; },
      async execute(sql: string): Promise<{ changes: number }> { executed.push(sql); return { changes: 0 }; },
      async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> { return fn(this); },
      async close(): Promise<void> {},
    };

    await expect(runMigrations(db)).rejects.toThrow('MIGRATION_HISTORY_INCOMPATIBLE');
    expect(executed).toHaveLength(1);
    expect(executed[0]).toContain('CREATE TABLE IF NOT EXISTS _apiproof_migrations');
  });
});
