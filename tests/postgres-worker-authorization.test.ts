import { describe, expect, it } from 'vitest';
import { assertWorkerDatabaseAuthorization, TRUSTED_WORKER_BRIDGE } from '../apps/web/src/lib/server/db/postgres-worker-authorization.js';
import type { PostgresWorkerAuthorizationError } from '../apps/web/src/lib/server/db/postgres-worker-authorization.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';

function adapter(rows: Array<{ available?: boolean; allowed?: boolean }>): DatabaseAdapter {
  let index = 0;
  return {
    engine: 'postgres',
    query: async () => [],
    queryOne: async () => rows[index++] ?? undefined,
    execute: async () => ({ changes: 0 }),
    transaction: async (operation) => operation(adapter(rows)),
    close: async () => undefined,
  } as unknown as DatabaseAdapter;
}

describe('PostgreSQL worker database authorization', () => {
  it('requires the owner-provisioned zero-argument bridge', async () => {
    await expect(assertWorkerDatabaseAuthorization(adapter([{ available: false }]))).rejects.toMatchObject({
      code: 'WORKER_DATABASE_AUTH_UNAVAILABLE',
    } satisfies Partial<PostgresWorkerAuthorizationError>);
  });

  it('fails closed when the bridge denies the database connection', async () => {
    await expect(assertWorkerDatabaseAuthorization(adapter([{ available: true }, { allowed: false }]))).rejects.toMatchObject({
      code: 'WORKER_DATABASE_AUTH_DENIED',
    } satisfies Partial<PostgresWorkerAuthorizationError>);
  });

  it('accepts only a database-approved bridge decision and sends no worker token', async () => {
    const calls: string[] = [];
    const db = adapter([{ available: true }, { allowed: true }]);
    const original = db.queryOne;
    db.queryOne = async (sql: string) => {
      calls.push(sql);
      return original(sql);
    };
    await expect(assertWorkerDatabaseAuthorization(db)).resolves.toBeUndefined();
    expect(calls[0]).toContain('to_regprocedure');
    expect(calls[1]).toContain(TRUSTED_WORKER_BRIDGE);
    expect(calls.join(' ')).not.toMatch(/token|secret|session_id/i);
  });

  it('does not add a PostgreSQL requirement to disposable SQLite fixtures', async () => {
    await expect(assertWorkerDatabaseAuthorization({ engine: 'sqlite' } as DatabaseAdapter)).resolves.toBeUndefined();
  });
});
