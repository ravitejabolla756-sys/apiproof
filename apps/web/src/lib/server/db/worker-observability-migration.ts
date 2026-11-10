import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_WORKER_OBSERVABILITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS worker_run_heartbeats (
  component TEXT NOT NULL,
  run_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'degraded', 'failed')),
  error_code TEXT,
  PRIMARY KEY (component, run_id)
);
CREATE INDEX IF NOT EXISTS idx_worker_run_heartbeats_latest ON worker_run_heartbeats(component, started_at);
`;

/** Durable, non-tenant-scoped execution heartbeats for scheduled workers. */
export const workerObservabilityMigrations: Migration[] = [{
  id: 'sec13_worker_run_heartbeats_v1',
  name: 'sec13_worker_run_heartbeats_v1',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(SQLITE_WORKER_OBSERVABILITY_SCHEMA);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE worker_run_heartbeats ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE worker_run_heartbeats FROM PUBLIC, anon, authenticated');
    }
  },
}];
