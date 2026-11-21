import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_ORGANIZATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email, expires_at);

CREATE TABLE IF NOT EXISTS workspace_audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_workspace ON workspace_audit_events(workspace_id, created_at);
`;

export const organizationMigrations: Migration[] = [{
  id: '024',
  name: 'workspace_invitations_and_audit_events',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(SQLITE_ORGANIZATION_SCHEMA);
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY');
      await db.execute('ALTER TABLE workspace_audit_events ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE workspace_invitations, workspace_audit_events FROM PUBLIC, anon, authenticated');
    }
  },
}];
