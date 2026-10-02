import type { DatabaseAdapter, Migration } from './types.js';
import { migrateRepositoryIdentity } from './repository-identity-migration.js';

export const extendedMigrations: Migration[] = [
  {
    id: '008',
    name: 'evidence_bound_migration_outputs',
    up: async (db: DatabaseAdapter) => {
      const hasTable = async (table: string) => db.engine === 'postgres'
        ? Boolean((await db.queryOne<{ exists: boolean }>(`SELECT to_regclass('public.${table}') IS NOT NULL AS exists`))?.exists)
        : Boolean(await db.queryOne<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${table}'`));
      const addColumn = async (table: string, column: string) => {
        if (db.engine === 'postgres') {
          await db.execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} TEXT`);
          return;
        }
        const columns = await db.query<{ name: string }>(`PRAGMA table_info(${table})`);
        if (!columns.some((entry) => entry.name === column)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
      };
      if (await hasTable('findings')) await addColumn('findings', 'source_digest');
      if (await hasTable('migrations')) await addColumn('migrations', 'patch_content');
    },
  },
  {
    id: '009',
    name: 'reliable_scan_worker_leases_and_failures',
    up: async (db: DatabaseAdapter) => {
      const columns: Array<[string, string]> = [
        ['attempt_count', 'INTEGER NOT NULL DEFAULT 0'],
        ['claimed_at', 'TEXT'],
        ['lease_expires_at', 'TEXT'],
        ['last_error_category', 'TEXT'],
        ['last_error_message', 'TEXT'],
      ];
      for (const [column, definition] of columns) {
        if (db.engine === 'postgres') {
          await db.execute(`ALTER TABLE github_scan_requests ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
        } else {
          const existing = await db.query<{ name: string }>('PRAGMA table_info(github_scan_requests)');
          if (!existing.some((entry) => entry.name === column)) await db.execute(`ALTER TABLE github_scan_requests ADD COLUMN ${column} ${definition}`);
        }
      }
      await db.execute('CREATE INDEX IF NOT EXISTS idx_scan_requests_claim ON github_scan_requests(status, lease_expires_at, created_at)');
    },
  },
  { id: '010', name: 'authoritative_repository_identity_and_lifecycle', up: migrateRepositoryIdentity },
];
