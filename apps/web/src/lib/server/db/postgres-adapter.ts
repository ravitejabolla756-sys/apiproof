import pg from 'pg';
import type { DatabaseAdapter } from './types.js';
import { translatePlaceholders } from './sql-utils.js';

const { Pool } = pg;

const DEFAULT_POOL_MAX = 10;
const TRANSACTION_POOLER_MAX = 1;
const MAX_POOL_SIZE = 100;

export interface PostgresPoolConfigOptions {
  environment?: NodeJS.ProcessEnv;
  isLocal?: boolean;
}

/**
 * Builds the pg configuration without retaining or logging the connection URL.
 * Supabase transaction poolers use port 6543 and do not support named
 * prepared statements; this adapter never supplies a query name.
 */
export function buildPostgresPoolConfig(
  connectionString: string,
  options: PostgresPoolConfigOptions = {},
): pg.PoolConfig {
  const parsed = new URL(connectionString);
  const isLocal = options.isLocal ?? (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
  const conflictingSslParameter = ['sslcert', 'sslkey', 'sslrootcert'].find((name) => parsed.searchParams.has(name));

  if (conflictingSslParameter) {
    throw new Error('POSTGRES_SSL_CONFIGURATION_CONFLICT');
  }
  if (!isLocal && sslMode === 'disable') {
    throw new Error('POSTGRES_TLS_DISABLE_REFUSED');
  }

  // pg merges connection-string SSL options with the explicit ssl object. Remove
  // sslmode so the adapter owns the TLS policy deterministically.
  parsed.searchParams.delete('sslmode');
  const sanitizedConnectionString = parsed.toString();
  const transactionPooler = parsed.port === '6543';
  const configuredMax = options.environment?.APIPROOF_PG_POOL_MAX?.trim();
  const max = configuredMax ? Number(configuredMax) : transactionPooler ? TRANSACTION_POOLER_MAX : DEFAULT_POOL_MAX;
  if (!Number.isInteger(max) || max < 1 || max > MAX_POOL_SIZE) {
    throw new Error('POSTGRES_POOL_MAX_INVALID');
  }

  if (isLocal) {
    return {
      connectionString: sanitizedConnectionString,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: false,
    };
  }

  const ca = options.environment?.APIPROOF_PG_CA_CERT?.trim();
  return {
    connectionString: sanitizedConnectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true },
  };
}

export function buildRuntimePostgresPoolConfig(connectionString: string): pg.PoolConfig {
  return buildPostgresPoolConfig(connectionString, { environment: process.env });
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  private pool: pg.Pool;

  constructor(connectionStringOrPool: string | pg.Pool) {
    if (typeof connectionStringOrPool === 'string') {
      this.pool = new Pool(buildRuntimePostgresPoolConfig(connectionStringOrPool));
    } else {
      this.pool = connectionStringOrPool;
    }
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.pool.query(pgSql, params) : await this.pool.query(pgSql);
    return result.rows as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.pool.query(pgSql, params) : await this.pool.query(pgSql);
    return (result.rows[0] as T) ?? undefined;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.pool.query(pgSql, params) : await this.pool.query(pgSql);
    return { changes: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txAdapter = new PostgresTransactionAdapter(client);
      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors if already aborted
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class PostgresTransactionAdapter implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  private client: pg.PoolClient;

  constructor(client: pg.PoolClient) {
    this.client = client;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.client.query(pgSql, params) : await this.client.query(pgSql);
    return result.rows as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.client.query(pgSql, params) : await this.client.query(pgSql);
    return (result.rows[0] as T) ?? undefined;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const pgSql = translatePlaceholders(sql);
    const result = params.length > 0 ? await this.client.query(pgSql, params) : await this.client.query(pgSql);
    return { changes: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Nested transaction support using SAVEPOINT
    const savepointName = `sp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await this.client.query(`SAVEPOINT ${savepointName}`);
    try {
      const result = await fn(this);
      await this.client.query(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (error) {
      await this.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Client release is managed by the outer transaction
  }
}
