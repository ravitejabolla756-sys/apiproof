import type { DatabaseAdapter, Migration } from './types.js';

export const SQLITE_FINDING_RESOLUTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS finding_resolution_verifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  migration_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
  pull_request_id TEXT NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
  merge_sha TEXT NOT NULL,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finding_resolution_finding ON finding_resolution_verifications(finding_id, created_at);
CREATE INDEX IF NOT EXISTS idx_finding_resolution_workspace ON finding_resolution_verifications(workspace_id, created_at);
`;

export const findingResolutionMigrations: Migration[] = [{
  id: '026',
  name: 'finding_resolution_verification_evidence',
  async up(db: DatabaseAdapter): Promise<void> {
    if (db.engine === 'sqlite') {
      const pullRequestsTable = await db.queryOne<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pull_requests'",
      );
      if (!pullRequestsTable) return;
    }
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS merge_sha TEXT');
    } else {
      const columns = await db.query<{ name: string }>("PRAGMA table_info('pull_requests')");
      if (!columns.some((column) => column.name === 'merge_sha')) {
        await db.execute('ALTER TABLE pull_requests ADD COLUMN merge_sha TEXT');
      }
    }
    await db.execute(`
      CREATE TABLE IF NOT EXISTS finding_resolution_verifications (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
        migration_id TEXT NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
        pull_request_id TEXT NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
        merge_sha TEXT NOT NULL,
        scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        classification TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_finding_resolution_finding ON finding_resolution_verifications(finding_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_finding_resolution_workspace ON finding_resolution_verifications(workspace_id, created_at)');
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE finding_resolution_verifications ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE finding_resolution_verifications FROM PUBLIC, anon, authenticated');
    }
  },
}];

