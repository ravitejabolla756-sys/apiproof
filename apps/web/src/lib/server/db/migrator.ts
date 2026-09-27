import crypto from 'node:crypto';
import type { DatabaseAdapter, Migration, MigrationRecord } from './types.js';
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from './schema.js';

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial_schema',
    up: async (db: DatabaseAdapter) => {
      const ddl = db.engine === 'postgres' ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
      
      // Execute the schema DDL
      // For multi-statement DDL, we execute statement by statement or as a raw block
      if (db.engine === 'postgres') {
        // Postgres adapter can execute multi-statement DDL in a single execute call
        await db.execute(ddl);
      } else {
        // SQLite execute block
        await db.execute(ddl);
      }

      // Check if users exist; if not, seed default user and fixture
      const userCheck = await db.queryOne<{ id: string }>('SELECT id FROM users LIMIT 1');
      if (!userCheck) {
        const userId = 'usr_pilot_developer';
        const now = new Date().toISOString();
        
        // Hash password 'apiproof2026!' with scrypt
        const salt = 'apiproof_pilot_salt';
        const hash = crypto.scryptSync('apiproof2026!', salt, 64).toString('hex');
        const passwordHash = `${salt}:${hash}`;

        await db.execute(`
          INSERT INTO users (id, email, password_hash, name, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, 'developer@apiproof.dev', passwordHash, 'APIProof Developer', now]);

        const repoId = 'repo_apiproof_fixture';
        await db.execute(`
          INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          repoId,
          userId,
          'ravitejabolla756-sys',
          'apiproof-github-fixture',
          'ravitejabolla756-sys/apiproof-github-fixture',
          '1363070568',
          'main',
          'connected',
          now
        ]);

        await db.execute(`
          INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'act_init_repo',
          userId,
          repoId,
          'repository_connected',
          'Repository Connected',
          'Connected ravitejabolla756-sys/apiproof-github-fixture via GitHub App.',
          now
        ]);
      }
    },
  },
  {
    id: '002',
    name: 'phase1_integrity_constraints_and_rate_limits',
    up: async (db: DatabaseAdapter) => {
      const resetAtType = db.engine === 'postgres' ? 'BIGINT' : 'INTEGER';
      await db.execute(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          points INTEGER NOT NULL,
          reset_at ${resetAtType} NOT NULL
        )
      `);

      await db.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_identity 
        ON findings(repository_id, change_id, file_path, symbol)
      `);

      await db.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_migration 
        ON pull_requests(migration_id)
      `);
    },
  },
];

export async function runMigrations(db: DatabaseAdapter): Promise<MigrationRecord[]> {
  // Ensure the migrations tracking table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _apiproof_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = await db.query<{ id: string }>('SELECT id FROM _apiproof_migrations');
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const newlyApplied: MigrationRecord[] = [];

  for (const migration of migrations) {
    if (!appliedSet.has(migration.id)) {
      const now = new Date().toISOString();
      await db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.execute(
          'INSERT INTO _apiproof_migrations (id, name, applied_at) VALUES (?, ?, ?)',
          [migration.id, migration.name, now]
        );
      });

      newlyApplied.push({
        id: migration.id,
        name: migration.name,
        appliedAt: now,
      });
    }
  }

  return newlyApplied;
}
