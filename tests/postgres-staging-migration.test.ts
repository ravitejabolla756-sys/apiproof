import { afterEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';
import { POSTGRES_SCHEMA } from '../apps/web/src/lib/server/db/schema.js';
import type { DatabaseAdapter } from '../apps/web/src/lib/server/db/types.js';
import {
  bootstrapStagingDatabase,
  readStagingBootstrapConfig,
  STAGING_DATABASE_NAME,
  STAGING_DATABASE_URL_USERNAME,
  STAGING_REPOSITORY,
} from '../apps/web/src/lib/server/db/staging-bootstrap.js';

const originalSkip = process.env.APIPROOF_SKIP_DEFAULT_SEED;

afterEach(() => {
  if (originalSkip === undefined) delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  else process.env.APIPROOF_SKIP_DEFAULT_SEED = originalSkip;
});

class PostgreSQLSchemaProbe implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  readonly tables = new Set<string>();
  readonly appliedMigrations = new Set<string>();

  async query<T = unknown>(sql: string): Promise<T[]> {
    if (/SELECT id FROM _apiproof_migrations/i.test(sql)) {
      return [...this.appliedMigrations].map((id) => ({ id })) as T[];
    }
    return [];
  }

  async queryOne<T = unknown>(sql: string): Promise<T | undefined> {
    if (/SELECT id FROM users LIMIT 1/i.test(sql)) return undefined;
    if (/to_regclass\('public\.migrations'\)/i.test(sql)) return { exists: false } as T;
    return undefined;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    for (const statement of sql.split(';')) {
      const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)/i);
      if (tableMatch) {
        const table = tableMatch[1]!;
        const references = [...statement.matchAll(/REFERENCES\s+([a-z_][a-z0-9_]*)\s*\(/gi)]
          .map((match) => match[1]!);
        for (const referencedTable of references) {
          if (!this.tables.has(referencedTable)) {
            throw new Error(`PostgreSQL schema probe: relation "${referencedTable}" does not exist`);
          }
        }
        this.tables.add(table);
      }
    }

    const migrationInsert = sql.match(/INSERT INTO _apiproof_migrations/i);
    if (migrationInsert && typeof params[0] === 'string') this.appliedMigrations.add(params[0]);
    return { changes: 1 };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const tables = new Set(this.tables);
    const appliedMigrations = new Set(this.appliedMigrations);
    try {
      return await fn(this);
    } catch (error) {
      this.tables.clear();
      for (const table of tables) this.tables.add(table);
      this.appliedMigrations.clear();
      for (const migration of appliedMigrations) this.appliedMigrations.add(migration);
      throw error;
    }
  }

  async close(): Promise<void> {}
}

class InterruptedBootstrapProbe implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  private rows = new Map<string, number>();
  private insertCount = 0;

  constructor(private readonly failOnInsert: number) {}

  async query<T = unknown>(): Promise<T[]> {
    return [];
  }

  async queryOne<T = unknown>(sql: string): Promise<T | undefined> {
    const table = sql.match(/FROM\s+([a-z_][a-z0-9_]*)/i)?.[1];
    if (!table) return undefined;
    return { count: this.rows.get(table) ?? 0 } as T;
  }

  async execute(sql: string): Promise<{ changes: number }> {
    const table = sql.match(/INSERT INTO\s+([a-z_][a-z0-9_]*)/i)?.[1];
    if (table) {
      this.insertCount += 1;
      this.rows.set(table, (this.rows.get(table) ?? 0) + 1);
      if (this.insertCount === this.failOnInsert) throw new Error('simulated bootstrap interruption');
    }
    return { changes: 1 };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const snapshot = new Map(this.rows);
    try {
      return await fn(this);
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  async close(): Promise<void> {}
}

function stagingEnvironment(): NodeJS.ProcessEnv {
  return {
    APIPROOF_STAGING_BOOTSTRAP: 'true',
    APIPROOF_SKIP_DEFAULT_SEED: 'true',
    APIPROOF_STAGING_DATABASE_URL: `postgresql://${STAGING_DATABASE_URL_USERNAME}:secret@aws-0-ap-south-1.pooler.supabase.com/${STAGING_DATABASE_NAME}`,
    APIPROOF_STAGING_EXPECTED_URL_USERNAME: STAGING_DATABASE_URL_USERNAME,
    APIPROOF_STAGING_EXPECTED_DB_NAME: STAGING_DATABASE_NAME,
    APIPROOF_STAGING_USER_EMAIL: 'staging@example.invalid',
    APIPROOF_STAGING_USER_PASSWORD: 'test-only-input',
    APIPROOF_STAGING_USER_NAME: 'Staging User',
    APIPROOF_STAGING_GITHUB_ACCOUNT_LOGIN: STAGING_REPOSITORY.owner,
    APIPROOF_STAGING_GITHUB_INSTALLATION_ID: '123456789',
  };
}

describe('PostgreSQL staging migration safety', () => {
  it('creates a fresh PostgreSQL schema in dependency order and records migrations', async () => {
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    const db = new PostgreSQLSchemaProbe();
    const applied = await runMigrations(db);
    expect(applied.length).toBeGreaterThan(0);
    expect(db.tables.has('repositories')).toBe(true);
    expect(db.tables.has('github_scan_requests')).toBe(true);
    expect(db.appliedMigrations.size).toBeGreaterThan(0);
    expect(POSTGRES_SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS repositories')).toBeLessThan(
      POSTGRES_SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS github_scan_requests'),
    );
  });

  it('rolls back every staging record when bootstrap is interrupted', async () => {
    const db = new InterruptedBootstrapProbe(3);
    const config = readStagingBootstrapConfig(stagingEnvironment());
    await expect(bootstrapStagingDatabase(db, config)).rejects.toThrow('simulated bootstrap interruption');
    await expect(db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM users')).resolves.toEqual({ count: 0 });
    await expect(db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM workspaces')).resolves.toEqual({ count: 0 });
    await expect(db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM workspace_members')).resolves.toEqual({ count: 0 });
    await expect(db.queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM github_installations')).resolves.toEqual({ count: 0 });
  });
});
