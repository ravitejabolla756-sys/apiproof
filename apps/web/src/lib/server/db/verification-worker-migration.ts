import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_VERIFICATION_WORKER_SCHEMA = `
CREATE TABLE IF NOT EXISTS migration_verification_jobs (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  baseline_sha TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  lease_expires_at TEXT,
  error_category TEXT,
  error_message TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS migration_verification_workers (
  worker_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  docker_image TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_error_category TEXT
);
CREATE INDEX IF NOT EXISTS idx_migration_verification_jobs_claim ON migration_verification_jobs(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_migration_verification_jobs_workspace ON migration_verification_jobs(workspace_id, created_at);
`;

export const verificationWorkerMigrations: Migration[] = [
  {
    id: '012',
    name: 'durable_migration_verification_jobs',
    up: async (db: DatabaseAdapter) => {
      const reference = (table: string) => ` REFERENCES ${table}(id) ON DELETE CASCADE`;
      await db.execute(`
        CREATE TABLE IF NOT EXISTS migration_verification_jobs (
          id TEXT PRIMARY KEY,
          migration_id TEXT NOT NULL UNIQUE${reference('migrations')},
          workspace_id TEXT NOT NULL${reference('workspaces')},
          repository_id TEXT NOT NULL${reference('repositories')},
          requested_by TEXT NOT NULL${reference('users')},
          baseline_sha TEXT NOT NULL,
          status TEXT NOT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          claimed_by TEXT,
          lease_expires_at TEXT,
          error_category TEXT,
          error_message TEXT,
          result_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS migration_verification_workers (
          worker_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          docker_image TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          last_error_category TEXT
        )
      `);
      await db.execute('CREATE INDEX IF NOT EXISTS idx_migration_verification_jobs_claim ON migration_verification_jobs(status, lease_expires_at, created_at)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_migration_verification_jobs_workspace ON migration_verification_jobs(workspace_id, created_at)');
    },
  },
];
