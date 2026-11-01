export const POSTGRES_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS github_installations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  installation_id TEXT UNIQUE NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS github_scan_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_id TEXT,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  lease_expires_at TEXT,
  last_error_category TEXT,
  last_error_message TEXT,
  UNIQUE (repository_id, commit_sha)
);

CREATE TABLE IF NOT EXISTS github_installation_states (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  consumed_at BIGINT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  github_repository_id TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  origin TEXT NOT NULL DEFAULT 'connected',
  lifecycle TEXT NOT NULL DEFAULT 'active',
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, full_name)
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_digest TEXT,
  files_analyzed INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  raw_result TEXT,
  error_message TEXT,
  triggered_by TEXT,
  rule_candidate_id TEXT,
  triggered_at TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  usage_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  reason_codes TEXT NOT NULL,
  evidence TEXT NOT NULL,
  source_snippet TEXT,
  source_digest TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  plan_json TEXT NOT NULL,
  patch_diff TEXT,
  patch_digest TEXT,
  patch_content TEXT,
  baseline_sha TEXT,
  verification_report TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  UNIQUE (migration_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  points INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id TEXT REFERENCES repositories(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS _apiproof_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free',
  customer_id TEXT,
  subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_usage (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, metric, period_start)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_github_installations_workspace ON github_installations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_installation_states_user ON github_installation_states(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_workspace ON repositories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_repositories_user ON repositories(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_active_github_identity
  ON repositories(github_repository_id) WHERE lifecycle = 'active';
CREATE INDEX IF NOT EXISTS idx_scans_repo ON scans(repository_id);
CREATE INDEX IF NOT EXISTS idx_findings_repo ON findings(repository_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_identity ON findings(repository_id, change_id, file_path, symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_migration ON pull_requests(migration_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON github_webhook_deliveries(event);
CREATE INDEX IF NOT EXISTS idx_scan_requests_repo ON github_scan_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_scan_requests_status ON github_scan_requests(status);
CREATE INDEX IF NOT EXISTS idx_scan_requests_claim ON github_scan_requests(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_customer ON workspace_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_period ON workspace_usage(workspace_id, period_start);
`;

export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS github_installations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  installation_id TEXT UNIQUE NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  status TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS github_scan_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_id TEXT,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  lease_expires_at TEXT,
  last_error_category TEXT,
  last_error_message TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE (repository_id, commit_sha)
);

CREATE TABLE IF NOT EXISTS github_installation_states (
  state TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  github_repository_id TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  origin TEXT NOT NULL DEFAULT 'connected',
  lifecycle TEXT NOT NULL DEFAULT 'active',
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, full_name)
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_digest TEXT,
  files_analyzed INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  raw_result TEXT,
  error_message TEXT,
  triggered_by TEXT,
  rule_candidate_id TEXT,
  triggered_at TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  usage_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  reason_codes TEXT NOT NULL,
  evidence TEXT NOT NULL,
  source_snippet TEXT,
  source_digest TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  plan_json TEXT NOT NULL,
  patch_diff TEXT,
  patch_digest TEXT,
  patch_content TEXT,
  baseline_sha TEXT,
  verification_report TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  UNIQUE (migration_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  points INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  repository_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS _apiproof_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  workspace_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL DEFAULT 'free',
  customer_id TEXT,
  subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_usage (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, metric, period_start)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_github_installations_workspace ON github_installations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_installation_states_user ON github_installation_states(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_workspace ON repositories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_repositories_user ON repositories(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_active_github_identity
  ON repositories(github_repository_id) WHERE lifecycle = 'active';
CREATE INDEX IF NOT EXISTS idx_scans_repo ON scans(repository_id);
CREATE INDEX IF NOT EXISTS idx_findings_repo ON findings(repository_id);
CREATE INDEX IF NOT EXISTS idx_findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_identity ON findings(repository_id, change_id, file_path, symbol);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_migration ON pull_requests(migration_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON github_webhook_deliveries(event);
CREATE INDEX IF NOT EXISTS idx_scan_requests_repo ON github_scan_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_scan_requests_status ON github_scan_requests(status);
CREATE INDEX IF NOT EXISTS idx_scan_requests_claim ON github_scan_requests(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_customer ON workspace_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_period ON workspace_usage(workspace_id, period_start);
`;
