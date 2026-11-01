import type { DatabaseAdapter, Migration } from './types.js';

/**
 * Provider intelligence is deliberately stored separately from repository
 * scans. A source update is evidence for review; it is not a production rule
 * until a human approves it.
 */
export const SQLITE_PROVIDER_CHANGE_MONITOR_SCHEMA = `
CREATE TABLE IF NOT EXISTS provider_change_sources (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  adapter_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  etag TEXT,
  last_modified TEXT,
  content_hash TEXT,
  last_fetched_at TEXT,
  last_success_at TEXT,
  next_attempt_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_changelog_entries (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES provider_change_sources(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_locator TEXT NOT NULL,
  source_url TEXT NOT NULL,
  published_at TEXT,
  effective_at TEXT,
  content_hash TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (source_id, entry_key, content_hash)
);

CREATE TABLE IF NOT EXISTS provider_rule_candidates (
  id TEXT PRIMARY KEY,
  changelog_entry_id TEXT NOT NULL REFERENCES provider_changelog_entries(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  candidate_fingerprint TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'needs_review',
  severity TEXT NOT NULL DEFAULT 'high',
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT
);

CREATE TABLE IF NOT EXISTS provider_rule_reviews (
  id TEXT PRIMARY KEY,
  rule_candidate_id TEXT NOT NULL REFERENCES provider_rule_candidates(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  notes TEXT NOT NULL,
        evidence_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_rescan_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  rule_candidate_id TEXT NOT NULL REFERENCES provider_rule_candidates(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  lease_expires_at TEXT,
  scan_request_id TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (repository_id, rule_candidate_id)
);

CREATE TABLE IF NOT EXISTS repository_provider_usage (
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  last_scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (repository_id, provider_id)
);

CREATE TABLE IF NOT EXISTS repository_rescan_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_at TEXT,
  lease_expires_at TEXT,
  scan_request_id TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (repository_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_provider_sources_due
  ON provider_change_sources(enabled, next_attempt_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_provider_entries_provider
  ON provider_changelog_entries(provider_id, first_seen_at);
CREATE INDEX IF NOT EXISTS idx_provider_candidates_review
  ON provider_rule_candidates(status, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_rescan_claim
  ON provider_rescan_jobs(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_provider_rescan_workspace
  ON provider_rescan_jobs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_repository_provider_usage_provider
  ON repository_provider_usage(provider_id, workspace_id, repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_rescan_claim
  ON repository_rescan_jobs(status, lease_expires_at, created_at);

CREATE TABLE IF NOT EXISTS slack_provider_change_deliveries (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  changelog_entry_id TEXT NOT NULL REFERENCES provider_changelog_entries(id) ON DELETE CASCADE,
  slack_connection_id TEXT NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  lease_expires_at TEXT,
  post_started_at TEXT,
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  error_category TEXT,
  next_attempt_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_slack_provider_change_claim
  ON slack_provider_change_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_slack_provider_change_workspace
  ON slack_provider_change_deliveries(workspace_id, created_at);
`;

export const providerChangeMonitorMigrations: Migration[] = [{
  id: '015',
  name: 'provider_change_monitoring_and_rescan_jobs',
  async up(db: DatabaseAdapter): Promise<void> {
    const reference = (table: string): string => ` REFERENCES ${table}(id) ON DELETE CASCADE`;

    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_change_sources (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        source_url TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        adapter_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        etag TEXT,
        last_modified TEXT,
        content_hash TEXT,
        last_fetched_at TEXT,
        last_success_at TEXT,
        next_attempt_at TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_error_code TEXT,
        last_error_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_changelog_entries (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL${reference('provider_change_sources')},
        provider_id TEXT NOT NULL,
        entry_key TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        source_locator TEXT NOT NULL,
        source_url TEXT NOT NULL,
        published_at TEXT,
        effective_at TEXT,
        content_hash TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE (source_id, entry_key, content_hash)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_rule_candidates (
        id TEXT PRIMARY KEY,
        changelog_entry_id TEXT NOT NULL${reference('provider_changelog_entries')},
        workspace_id TEXT${reference('workspaces')},
        provider_id TEXT NOT NULL,
        candidate_fingerprint TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'needs_review',
        severity TEXT NOT NULL DEFAULT 'high',
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_rule_reviews (
        id TEXT PRIMARY KEY,
        rule_candidate_id TEXT NOT NULL${reference('provider_rule_candidates')},
        decision TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS provider_rescan_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL${reference('workspaces')},
        repository_id TEXT NOT NULL${reference('repositories')},
        rule_candidate_id TEXT NOT NULL${reference('provider_rule_candidates')},
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT,
        lease_expires_at TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (repository_id, rule_candidate_id)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS repository_provider_usage (
        repository_id TEXT NOT NULL${reference('repositories')},
        workspace_id TEXT NOT NULL${reference('workspaces')},
        provider_id TEXT NOT NULL,
        last_scan_id TEXT NOT NULL${reference('scans')},
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (repository_id, provider_id)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_sources_due ON provider_change_sources(enabled, next_attempt_at, updated_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_entries_provider ON provider_changelog_entries(provider_id, first_seen_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_candidates_review ON provider_rule_candidates(status, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_rescan_claim ON provider_rescan_jobs(status, lease_expires_at, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_rescan_workspace ON provider_rescan_jobs(workspace_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_repository_provider_usage_provider ON repository_provider_usage(provider_id, workspace_id, repository_id)');
  },
}, {
  id: '016',
  name: 'repository_rescan_schedule_jobs',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS repository_rescan_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT,
        lease_expires_at TEXT,
        scan_request_id TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (repository_id, reason)
      )
    `);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE provider_rescan_jobs ADD COLUMN IF NOT EXISTS scan_request_id TEXT');
    } else {
      const columns = await db.query<{ name: string }>('PRAGMA table_info(provider_rescan_jobs)');
      if (!columns.some((entry) => entry.name === 'scan_request_id')) await db.execute('ALTER TABLE provider_rescan_jobs ADD COLUMN scan_request_id TEXT');
    }
    await db.execute('CREATE INDEX IF NOT EXISTS idx_repository_rescan_claim ON repository_rescan_jobs(status, lease_expires_at, created_at)');
  },
}, {
  id: '019',
  name: 'scan_trigger_provenance',
  async up(db: DatabaseAdapter): Promise<void> {
    const columns = db.engine === 'postgres'
      ? null
      : await db.query<{ name: string }>('PRAGMA table_info(scans)');
    // Some historical SQLite fixtures predate the scan table entirely. The
    // base schema migration will add the table when applicable; this additive
    // migration must remain safe for those upgrade simulations.
    if (db.engine === 'sqlite' && columns?.length === 0) return;
    for (const column of ['triggered_by', 'rule_candidate_id', 'triggered_at']) {
      const exists = db.engine === 'postgres'
        ? false
        : columns?.some((entry) => entry.name === column) ?? false;
      if (db.engine === 'postgres') {
        await db.execute(`ALTER TABLE scans ADD COLUMN IF NOT EXISTS ${column} TEXT`);
      } else if (!exists) {
        await db.execute(`ALTER TABLE scans ADD COLUMN ${column} TEXT`);
      }
    }
    await db.execute('CREATE INDEX IF NOT EXISTS idx_scans_trigger_provenance ON scans(triggered_by, triggered_at)');
  },
}, {
  id: '018',
  name: 'workspace_scope_provider_rule_approvals',
  async up(db: DatabaseAdapter): Promise<void> {
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE provider_rule_candidates ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE');
    } else {
      const columns = await db.query<{ name: string }>('PRAGMA table_info(provider_rule_candidates)');
      if (!columns.some((entry) => entry.name === 'workspace_id')) {
        await db.execute('ALTER TABLE provider_rule_candidates ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE');
      }
    }
    await db.execute('CREATE INDEX IF NOT EXISTS idx_provider_candidates_workspace ON provider_rule_candidates(workspace_id, status, created_at)');
  },
}, {
  id: '020',
  name: 'repository_provider_usage_index',
  async up(db: DatabaseAdapter): Promise<void> {
    const reference = (table: string): string => ` REFERENCES ${table}(id) ON DELETE CASCADE`;
    await db.execute(`
      CREATE TABLE IF NOT EXISTS repository_provider_usage (
        repository_id TEXT NOT NULL${reference('repositories')},
        workspace_id TEXT NOT NULL${reference('workspaces')},
        provider_id TEXT NOT NULL,
        last_scan_id TEXT NOT NULL${reference('scans')},
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (repository_id, provider_id)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_repository_provider_usage_provider ON repository_provider_usage(provider_id, workspace_id, repository_id)');
  },
}, {
  id: '017',
  name: 'provider_rule_review_evidence',
  async up(db: DatabaseAdapter): Promise<void> {
    const columns = await db.query<{ name: string }>(
      db.engine === 'postgres'
        ? `SELECT column_name AS name FROM information_schema.columns WHERE table_name = 'provider_rule_reviews' AND column_name = 'evidence_json'`
        : `PRAGMA table_info(provider_rule_reviews)`,
    );
    if (columns.some((column) => column.name === 'evidence_json')) return;
    await db.execute('ALTER TABLE provider_rule_reviews ADD COLUMN evidence_json TEXT');
  },
}, {
  id: '021',
  name: 'slack_provider_change_deliveries',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS slack_provider_change_deliveries (
        id TEXT PRIMARY KEY,
        event_key TEXT NOT NULL UNIQUE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        changelog_entry_id TEXT NOT NULL REFERENCES provider_changelog_entries(id) ON DELETE CASCADE,
        slack_connection_id TEXT NOT NULL REFERENCES slack_connections(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'delivered', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        claimed_by TEXT,
        lease_expires_at TEXT,
        post_started_at TEXT,
        slack_channel_id TEXT,
        slack_message_ts TEXT,
        error_category TEXT,
        next_attempt_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        delivered_at TEXT
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_slack_provider_change_claim ON slack_provider_change_deliveries(status, next_attempt_at, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_slack_provider_change_workspace ON slack_provider_change_deliveries(workspace_id, created_at)');
  },
}];
