import { describe, expect, it, vi } from 'vitest';
import { withPostgresTenantContext, PostgresTenantContextError } from '../apps/web/src/lib/server/db/postgres-tenant-context.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';

function adapter(engine: 'postgres' | 'sqlite', membership: { role: string } | undefined): DatabaseAdapter {
  const db = {
    engine,
    query: vi.fn(async () => []),
    queryOne: vi.fn(async () => membership),
    execute: vi.fn(async () => ({ changes: 0 })),
    transaction: vi.fn(),
    close: vi.fn(async () => undefined),
  } as unknown as DatabaseAdapter;
  const transact = async <T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> => fn(db);
  db.transaction = vi.fn(transact) as unknown as DatabaseAdapter['transaction'];
  return db;
}

describe('PostgreSQL tenant context boundary', () => {
  it('rejects empty server-side identity before opening a transaction', async () => {
    const db = adapter('postgres', { role: 'owner' });
    await expect(withPostgresTenantContext(db, '', 'ws-a', async () => true))
      .rejects.toMatchObject({ code: 'TENANT_CONTEXT_INVALID' });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('requires current membership inside the transaction', async () => {
    const db = adapter('postgres', undefined);
    await expect(withPostgresTenantContext(db, 'usr-a', 'ws-a', async () => true))
      .rejects.toBeInstanceOf(PostgresTenantContextError);
  });

  it('sets transaction-local context only after membership succeeds', async () => {
    const db = adapter('postgres', { role: 'member' });
    const operation = vi.fn(async () => 'ok');
    await expect(withPostgresTenantContext(db, 'usr-a', 'ws-a', operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('keeps SQLite behavior on the existing application authorization path', async () => {
    const db = adapter('sqlite', undefined);
    await expect(withPostgresTenantContext(db, 'usr-a', 'ws-a', async () => 'ok')).resolves.toBe('ok');
  });
});
