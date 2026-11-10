import type { DatabaseAdapter, Migration } from './types.js';

/**
 * Durable ORG-10 request and security-event records. Membership identifiers are
 * retained as plain text because the membership row is intentionally deleted
 * when access is revoked; the security record must remain independently
 * readable for audit and retention workflows.
 */
export const SQLITE_MEMBER_REVOCATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_member_revocation_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  subject_user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  audit_event_id TEXT,
  outcome_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS workspace_security_audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (workspace_id, event_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_member_revocation_requests_workspace
  ON workspace_member_revocation_requests(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_member_revocation_requests_subject
  ON workspace_member_revocation_requests(workspace_id, subject_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_workspace
  ON workspace_security_audit_events(workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_subject
  ON workspace_security_audit_events(workspace_id, subject_user_id, occurred_at);
`;

export const memberRevocationMigrations: Migration[] = [{
  id: '027',
  name: 'durable_workspace_member_revocation',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS workspace_member_revocation_requests (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        subject_user_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        membership_id TEXT NOT NULL,
        reason TEXT,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        audit_event_id TEXT,
        outcome_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE (workspace_id, idempotency_key)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS workspace_security_audit_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        subject_user_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        membership_id TEXT NOT NULL,
        reason TEXT,
        idempotency_key TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        UNIQUE (workspace_id, event_type, idempotency_key)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_member_revocation_requests_workspace ON workspace_member_revocation_requests(workspace_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_member_revocation_requests_subject ON workspace_member_revocation_requests(workspace_id, subject_user_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_security_audit_events_workspace ON workspace_security_audit_events(workspace_id, occurred_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_security_audit_events_subject ON workspace_security_audit_events(workspace_id, subject_user_id, occurred_at)');
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE workspace_member_revocation_requests ENABLE ROW LEVEL SECURITY');
      await db.execute('ALTER TABLE workspace_security_audit_events ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE workspace_member_revocation_requests, workspace_security_audit_events FROM PUBLIC, anon, authenticated');
    }
  },
}];
