import type { DatabaseAdapter, Migration } from './types.js';

const slackTables = `
CREATE TABLE IF NOT EXISTS slack_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  installer_slack_user_id TEXT NOT NULL,
  connected_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_ciphertext TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_auth_tag TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slack_connections_team ON slack_connections(team_id, status);

CREATE TABLE IF NOT EXISTS slack_oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slack_oauth_states_expiry ON slack_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS slack_notification_deliveries (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  migration_id TEXT REFERENCES migrations(id) ON DELETE CASCADE,
  slack_connection_id TEXT NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('breaking_finding', 'proposal_result')),
  result_state TEXT,
  result_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  lease_expires_at TEXT,
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  error_category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_slack_delivery_claim ON slack_notification_deliveries(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_slack_delivery_workspace ON slack_notification_deliveries(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS slack_action_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  delivery_id TEXT NOT NULL REFERENCES slack_notification_deliveries(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create_pr', 'dismiss')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (delivery_id, action)
);

CREATE TABLE IF NOT EXISTS slack_notification_dismissals (
  id TEXT PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES slack_notification_deliveries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (delivery_id, user_id)
);

CREATE TABLE IF NOT EXISTS slack_interaction_jobs (
  id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL UNIQUE,
  action_token_id TEXT NOT NULL UNIQUE REFERENCES slack_action_tokens(id) ON DELETE CASCADE,
  delivery_id TEXT NOT NULL REFERENCES slack_notification_deliveries(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  slack_connection_id TEXT NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_user_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create_pr', 'dismiss')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  lease_expires_at TEXT,
  migration_id TEXT REFERENCES migrations(id) ON DELETE SET NULL,
  error_category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slack_interaction_claim ON slack_interaction_jobs(status, lease_expires_at, created_at);
`;

export const SQLITE_SLACK_SCHEMA = slackTables;

export const slackMigrations: Migration[] = [{
  id: '013',
  name: 'slack_connections_notifications_and_interactions',
  async up(db: DatabaseAdapter) {
    await db.execute(slackTables);
  },
}];
