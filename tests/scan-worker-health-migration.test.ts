import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { scanWorkerHealthMigrations } from '../apps/web/src/lib/server/db/scan-worker-health-migration.js';

describe('scan worker health migration', () => {
  let raw: DatabaseSync | undefined;

  afterEach(() => {
    raw?.close();
    raw = undefined;
  });

  it('adds the health index to an existing queue table idempotently', async () => {
    raw = new DatabaseSync(':memory:');
    raw.exec(`CREATE TABLE github_scan_requests (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0
    )`);

    const adapter = new SqliteDatabaseAdapter(raw);
    const migration = scanWorkerHealthMigrations[0]!;
    await migration.up(adapter);
    await migration.up(adapter);

    const indexes = await adapter.query<{ name: string }>('PRAGMA index_list(github_scan_requests)');
    expect(indexes.filter((index) => index.name === 'idx_scan_requests_health')).toHaveLength(1);
  });
});
