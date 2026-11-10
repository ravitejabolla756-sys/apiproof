import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_FINDING_LIFECYCLE_EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS finding_lifecycle_events (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_json TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finding_lifecycle_finding ON finding_lifecycle_events(finding_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finding_lifecycle_workspace ON finding_lifecycle_events(workspace_id, created_at);
`;

export const findingLifecycleMigrations: Migration[] = [{
  id: '025',
  name: 'audited_finding_lifecycle',
  async up(db: DatabaseAdapter): Promise<void> {
    const findingsExists = db.engine === 'postgres'
      ? await db.queryOne<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'findings') AS exists")
      : await db.queryOne<{ present: number }>("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'findings'");
    if (!findingsExists) return;

    if (db.engine === 'postgres') {
      await db.execute("ALTER TABLE findings ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'open'");
    } else {
      const columns = await db.query<{ name: string }>('PRAGMA table_info(findings)');
      if (!columns.some((column) => column.name === 'lifecycle_state')) {
        await db.execute("ALTER TABLE findings ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'open'");
      }
    }

    await db.execute(`
      UPDATE findings
      SET lifecycle_state = CASE
        WHEN status = 'resolved' THEN 'resolved_legacy'
        WHEN status = 'pr_created' THEN 'fixed_pending_verification'
        WHEN status = 'migration_planned' THEN 'remediating'
        ELSE 'open'
      END
      WHERE lifecycle_state IS NULL OR lifecycle_state = 'open'
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS finding_lifecycle_events (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
        repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence_json TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_findings_lifecycle_repository ON findings(repository_id, lifecycle_state)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_finding_lifecycle_finding ON finding_lifecycle_events(finding_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_finding_lifecycle_workspace ON finding_lifecycle_events(workspace_id, created_at)');
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE finding_lifecycle_events ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE finding_lifecycle_events FROM PUBLIC, anon, authenticated');
    }
  },
}];
