import type { DatabaseAdapter } from './types.js';

export async function migrateRepositoryIdentity(db: DatabaseAdapter): Promise<void> {
  const columns: Array<[string, string]> = [
    ['origin', "TEXT NOT NULL DEFAULT 'connected'"],
    ['lifecycle', "TEXT NOT NULL DEFAULT 'active'"],
  ];

  for (const [column, definition] of columns) {
    if (db.engine === 'postgres') {
      await db.execute(`ALTER TABLE repositories ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    } else {
      const existing = await db.query<{ name: string }>('PRAGMA table_info(repositories)');
      if (!existing.some((entry) => entry.name === column)) {
        await db.execute(`ALTER TABLE repositories ADD COLUMN ${column} ${definition}`);
      }
    }
  }

  await db.execute("UPDATE repositories SET origin = 'connected' WHERE origin IS NULL OR origin = ''");
  await db.execute("UPDATE repositories SET lifecycle = 'active' WHERE lifecycle IS NULL OR lifecycle = ''");
  await db.execute("UPDATE repositories SET lifecycle = 'disconnected' WHERE status IN ('unavailable', 'deleted')");
  await db.execute(
    "UPDATE repositories SET origin = 'seeded_fixture', lifecycle = 'historical' WHERE id = 'repo_apiproof_fixture'"
  );

  const duplicateIds = await db.query<{ github_repository_id: string }>(`
    SELECT github_repository_id
    FROM repositories
    GROUP BY github_repository_id
    HAVING COUNT(*) > 1
  `);

  for (const duplicate of duplicateIds) {
    const rows = await db.query<{
      id: string;
      owner: string;
      name: string;
      status: string;
      created_at: string;
      has_active_installation: number | boolean;
    }>(`
      SELECT r.id, r.owner, r.name, r.status, r.created_at,
             CASE WHEN EXISTS (
               SELECT 1 FROM github_installations gi
               WHERE gi.workspace_id = r.workspace_id
                 AND (gi.status IS NULL OR gi.status = 'active')
             ) THEN 1 ELSE 0 END AS has_active_installation
      FROM repositories r
      WHERE r.github_repository_id = ?
      ORDER BY r.created_at ASC, r.id ASC
    `, [duplicate.github_repository_id]);

    const authoritative = [...rows].sort((a, b) => {
      const installationOrder = Number(Boolean(b.has_active_installation)) - Number(Boolean(a.has_active_installation));
      if (installationOrder !== 0) return installationOrder;
      const statusOrder = Number(b.status === 'connected') - Number(a.status === 'connected');
      if (statusOrder !== 0) return statusOrder;
      return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    })[0];

    if (!authoritative) continue;
    await db.execute("UPDATE repositories SET origin = 'connected', lifecycle = 'active' WHERE id = ?", [authoritative.id]);

    for (const row of rows) {
      if (row.id === authoritative.id) continue;
      const origin = row.id === 'repo_apiproof_fixture'
        || (row.owner === 'ravitejabolla756-sys' && row.name === 'apiproof-github-fixture')
        ? 'seeded_fixture'
        : 'imported';
      await db.execute("UPDATE repositories SET origin = ?, lifecycle = 'historical' WHERE id = ?", [origin, row.id]);
    }
  }

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_repositories_active_github_identity
    ON repositories(github_repository_id) WHERE lifecycle = 'active'
  `);
}
