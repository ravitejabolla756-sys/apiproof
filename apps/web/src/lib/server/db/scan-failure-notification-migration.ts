import type { DatabaseAdapter, Migration } from './types.js';

export const SCAN_FAILURE_NOTIFICATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS slack_scan_failure_deliveries (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  scan_request_id TEXT NOT NULL REFERENCES github_scan_requests(id) ON DELETE CASCADE,
  slack_connection_id TEXT NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  failure_category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  lease_expires_at TEXT,
  post_started_at TEXT,
  next_attempt_at TEXT,
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  error_category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_slack_scan_failure_claim
  ON slack_scan_failure_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_slack_scan_failure_workspace
  ON slack_scan_failure_deliveries(workspace_id, created_at);
`;

export const SQLITE_SCAN_FAILURE_NOTIFICATION_SCHEMA = SCAN_FAILURE_NOTIFICATION_SCHEMA;

export const scanFailureNotificationMigrations: Migration[] = [{
  id: '027',
  name: 'slack_scan_failure_deliveries',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(SCAN_FAILURE_NOTIFICATION_SCHEMA);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE slack_scan_failure_deliveries ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE slack_scan_failure_deliveries FROM PUBLIC, anon, authenticated');
    }
  },
}];
