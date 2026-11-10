import type { DatabaseAdapter, Migration } from './types.js';

const INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_scan_requests_health
  ON github_scan_requests(status, lease_expires_at, created_at, attempt_count)`;

/** Covers bounded worker-health scans on existing SQLite and PostgreSQL databases. */
export const scanWorkerHealthMigrations: Migration[] = [{
  id: '028',
  name: 'scan_worker_health_metrics_index',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(INDEX_SQL);
  },
}];
