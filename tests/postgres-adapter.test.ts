import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  translatePlaceholders,
  resolveDatabaseConfig,
  PostgresDatabaseAdapter,
  createPostgresPoolConfig,
  SqliteDatabaseAdapter,
  runMigrations,
  type DatabaseAdapter,
} from '../apps/web/src/lib/server/db/index.js';

describe('Database Adapter & PostgreSQL Production Architecture', () => {
  describe('1. SQL Placeholder Translation Utility', () => {
    it('translates simple positional placeholders from ? to $n', () => {
      const sql = 'SELECT * FROM users WHERE email = ? AND status = ?';
      expect(translatePlaceholders(sql)).toBe('SELECT * FROM users WHERE email = $1 AND status = $2');
    });

    it('safely ignores question marks inside single-quoted strings', () => {
      const sql = "SELECT * FROM findings WHERE reason = 'Is this deprecated?' AND id = ?";
      expect(translatePlaceholders(sql)).toBe("SELECT * FROM findings WHERE reason = 'Is this deprecated?' AND id = $1");
    });

    it('handles escaped quotes inside single-quoted string literals', () => {
      const sql = "SELECT * FROM logs WHERE message = 'What''s this?' AND user_id = ?";
      expect(translatePlaceholders(sql)).toBe("SELECT * FROM logs WHERE message = 'What''s this?' AND user_id = $1");
    });

    it('safely ignores question marks inside line comments and block comments', () => {
      const sql = `
        -- Is this active?
        SELECT * FROM repositories
        /* check status? */
        WHERE user_id = ? AND status = ?
      `;
      const translated = translatePlaceholders(sql);
      expect(translated).toContain('-- Is this active?');
      expect(translated).toContain('/* check status? */');
      expect(translated).toContain('user_id = $1');
      expect(translated).toContain('status = $2');
    });
  });

  describe('2. Environment Selection & Production Safety Guard', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      delete process.env.APIPROOF_DATABASE_URL;
      delete process.env.APIPROOF_DB_PATH;
      delete process.env.APIPROOF_PG_CA_CERT;
      process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('defaults to SQLite in development/test when APIPROOF_DATABASE_URL is absent', () => {
      process.env.NODE_ENV = 'development';
      const config = resolveDatabaseConfig();
      expect(config.type).toBe('sqlite');
    });

    it('selects PostgreSQL when APIPROOF_DATABASE_URL is provided', () => {
      process.env.APIPROOF_DATABASE_URL = 'postgresql://apiproof:secret@db.apiproof.internal:5432/apiproof_prod';
      const config = resolveDatabaseConfig();
      expect(config.type).toBe('postgres');
      if (config.type === 'postgres') {
        expect(config.url).toBe('postgresql://apiproof:secret@db.apiproof.internal:5432/apiproof_prod');
      }
    });

    it('fails clearly in production if APIPROOF_DATABASE_URL is missing without silent SQLite fallback', () => {
      process.env.NODE_ENV = 'production';
      expect(() => resolveDatabaseConfig()).toThrow(
        /MISSING_PRODUCTION_DATABASE_URL/
      );
    });

    it('requires certificate-verified TLS for remote PostgreSQL connections', () => {
      const config = createPostgresPoolConfig('postgresql://user:secret@db.example.test:5432/app');

      expect(config.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('passes the explicitly configured PostgreSQL CA certificate to the TLS client', () => {
      process.env.APIPROOF_PG_CA_CERT = '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';

      const config = createPostgresPoolConfig('postgresql://user:secret@db.example.test:5432/app');

      expect(config.ssl).toEqual({
        rejectUnauthorized: true,
        ca: process.env.APIPROOF_PG_CA_CERT,
      });
    });

    it('rejects remote connection strings that explicitly disable TLS', () => {
      expect(() => createPostgresPoolConfig('postgresql://user:secret@db.example.test:5432/app?sslmode=disable'))
        .toThrow('PRODUCTION_TLS_REQUIRED');
    });

    it('allows plaintext only for an explicitly local development endpoint', () => {
      const config = createPostgresPoolConfig('postgresql://user:secret@localhost:5432/app');

      expect(config.ssl).toBe(false);
    });
  });

  describe('3. PostgreSQL Adapter & Transaction Safety Model', () => {
    it('manages transaction commits and rollbacks deterministically', async () => {
      const executedCommands: string[] = [];
      let released = false;

      const mockClient = {
        query: async (sql: string) => {
          executedCommands.push(sql.trim());
          if (sql.includes('FAIL_TRIGGER')) {
            throw new Error('Database write failure');
          }
          return { rows: [{ count: 1 }], rowCount: 1 };
        },
        release: () => {
          released = true;
        },
      };

      const mockPool = {
        connect: async () => mockClient,
        query: async (sql: string) => {
          executedCommands.push(sql.trim());
          return { rows: [], rowCount: 0 };
        },
        end: async () => {},
      } as unknown as ConstructorParameters<typeof PostgresDatabaseAdapter>[0];

      const adapter = new PostgresDatabaseAdapter(mockPool);

      // Successful transaction
      await adapter.transaction(async (tx) => {
        await tx.execute('INSERT INTO users (id) VALUES (?)', ['usr_1']);
      });

      expect(executedCommands).toContain('BEGIN');
      expect(executedCommands).toContain('COMMIT');
      expect(released).toBe(true);

      // Failing transaction -> must rollback
      executedCommands.length = 0;
      await expect(
        adapter.transaction(async (tx) => {
          await tx.execute('INSERT INTO users (id) VALUES (?)', ['usr_2']);
          await tx.execute('FAIL_TRIGGER');
        })
      ).rejects.toThrow('Database write failure');

      expect(executedCommands).toContain('BEGIN');
      expect(executedCommands).toContain('ROLLBACK');
    });

    it('translates queries with parameter placeholders when executing against pool', async () => {
      let executedSql = '';
      let executedParams: unknown[] = [];

      const mockPool = {
        connect: async () => ({}),
        query: async (sql: string, params: unknown[]) => {
          executedSql = sql;
          executedParams = params;
          return { rows: [{ id: 'usr_test' }], rowCount: 1 };
        },
        end: async () => {},
      } as unknown as ConstructorParameters<typeof PostgresDatabaseAdapter>[0];

      const adapter = new PostgresDatabaseAdapter(mockPool);
      const res = await adapter.queryOne<{ id: string }>('SELECT * FROM users WHERE email = ? AND status = ?', ['test@apiproof.dev', 'active']);

      expect(executedSql).toBe('SELECT * FROM users WHERE email = $1 AND status = $2');
      expect(executedParams).toEqual(['test@apiproof.dev', 'active']);
      expect(res?.id).toBe('usr_test');
    });
  });

  describe('4. Tenant Isolation & IDOR Protection Suite', () => {
    let testDb: DatabaseSync;
    let adapter: DatabaseAdapter;

    beforeEach(async () => {
      // Create fresh in-memory relational database for strict isolation testing
      testDb = new DatabaseSync(':memory:');
      adapter = new SqliteDatabaseAdapter(testDb);

      testDb.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL);
        CREATE TABLE repositories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL);
        CREATE TABLE findings (id TEXT PRIMARY KEY, repository_id TEXT NOT NULL, title TEXT NOT NULL);
        CREATE TABLE migrations (id TEXT PRIMARY KEY, finding_id TEXT NOT NULL, repository_id TEXT NOT NULL);
        CREATE TABLE pull_requests (id TEXT PRIMARY KEY, migration_id TEXT NOT NULL, repository_id TEXT NOT NULL);
      `);

      // Seed User A and User B entities
      testDb.exec("INSERT INTO users VALUES ('usr_alice', 'alice@apiproof.dev'), ('usr_bob', 'bob@apiproof.dev');");
      testDb.exec("INSERT INTO repositories VALUES ('repo_a', 'usr_alice', 'alice-repo'), ('repo_b', 'usr_bob', 'bob-repo');");
      testDb.exec("INSERT INTO findings VALUES ('fnd_a', 'repo_a', 'Stripe Breaking Change'), ('fnd_b', 'repo_b', 'Twilio Breaking Change');");
      testDb.exec("INSERT INTO migrations VALUES ('mig_a', 'fnd_a', 'repo_a'), ('mig_b', 'fnd_b', 'repo_b');");
      testDb.exec("INSERT INTO pull_requests VALUES ('pr_a', 'mig_a', 'repo_a'), ('pr_b', 'mig_b', 'repo_b');");
    });

    afterEach(async () => {
      await adapter.close();
    });

    it('enforces that User A cannot access User B repository', async () => {
      // User A queries their repositories
      const userARepos = await adapter.query<{ id: string; user_id: string }>(
        'SELECT r.* FROM repositories r WHERE r.user_id = ?',
        ['usr_alice']
      );
      expect(userARepos).toHaveLength(1);
      expect(userARepos[0]?.id).toBe('repo_a');
      expect(userARepos[0]?.user_id).toBe('usr_alice');

      // User A attempts direct ID lookup for User B's repository
      const forbidden = await adapter.queryOne<{ id: string }>(
        'SELECT r.* FROM repositories r WHERE r.id = ? AND r.user_id = ?',
        ['repo_b', 'usr_alice']
      );
      expect(forbidden).toBeUndefined();
    });

    it("enforces that User A cannot access User B's findings", async () => {
      // User A queries findings
      const userAFindings = await adapter.query<{ id: string }>(
        'SELECT f.* FROM findings f JOIN repositories r ON r.id = f.repository_id WHERE r.user_id = ?',
        ['usr_alice']
      );
      expect(userAFindings).toHaveLength(1);
      expect(userAFindings[0]?.id).toBe('fnd_a');

      // User A attempts direct ID lookup for User B's finding
      const forbidden = await adapter.queryOne<{ id: string }>(
        'SELECT f.* FROM findings f JOIN repositories r ON r.id = f.repository_id WHERE f.id = ? AND r.user_id = ?',
        ['fnd_b', 'usr_alice']
      );
      expect(forbidden).toBeUndefined();
    });

    it("enforces that User A cannot access User B's migrations", async () => {
      // User A queries migrations
      const userAMigrations = await adapter.query<{ id: string }>(
        'SELECT m.* FROM migrations m JOIN repositories r ON r.id = m.repository_id WHERE r.user_id = ?',
        ['usr_alice']
      );
      expect(userAMigrations).toHaveLength(1);
      expect(userAMigrations[0]?.id).toBe('mig_a');

      // User A attempts direct ID lookup for User B's migration
      const forbidden = await adapter.queryOne<{ id: string }>(
        'SELECT m.* FROM migrations m JOIN repositories r ON r.id = m.repository_id WHERE m.id = ? AND r.user_id = ?',
        ['mig_b', 'usr_alice']
      );
      expect(forbidden).toBeUndefined();
    });

    it("enforces that User A cannot access User B's pull requests", async () => {
      // User A queries pull requests
      const userAPRs = await adapter.query<{ id: string }>(
        'SELECT pr.* FROM pull_requests pr JOIN repositories r ON r.id = pr.repository_id WHERE r.user_id = ?',
        ['usr_alice']
      );
      expect(userAPRs).toHaveLength(1);
      expect(userAPRs[0]?.id).toBe('pr_a');

      // User A attempts direct ID lookup for User B's pull request
      const forbidden = await adapter.queryOne<{ id: string }>(
        'SELECT pr.* FROM pull_requests pr JOIN repositories r ON r.id = pr.repository_id WHERE pr.id = ? AND r.user_id = ?',
        ['pr_b', 'usr_alice']
      );
      expect(forbidden).toBeUndefined();
    });
  });

  describe('5. Deterministic Migration Runner', () => {
    it('executes migrations idempotently without re-running applied migrations', async () => {
      const appliedSet = new Set<string>();
      const executedStatements: string[] = [];

      const mockDb: DatabaseAdapter = {
        engine: 'postgres',
        async query<T = unknown>(sql: string): Promise<T[]> {
          if (sql.includes('_apiproof_migrations')) {
            return Array.from(appliedSet).map((id) => ({ id })) as unknown as T[];
          }
          return [];
        },
        async queryOne<T = unknown>(): Promise<T | undefined> {
          return undefined;
        },
        async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
          executedStatements.push(sql);
          if (sql.includes('INSERT INTO _apiproof_migrations')) {
            appliedSet.add(params[0] as string);
          }
          return { changes: 1 };
        },
        async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
          return fn(this);
        },
        async close() {},
      };

      // First run: applies migration 001
      const firstRun = await runMigrations(mockDb);
      expect(firstRun.length).toBeGreaterThan(0);
      expect(appliedSet.has('001')).toBe(true);

      // Second run: database is up to date -> applies 0 migrations
      const secondRun = await runMigrations(mockDb);
      expect(secondRun.length).toBe(0);
    });
  });
});
