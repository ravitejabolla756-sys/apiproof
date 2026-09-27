import pg from 'pg';
import type { DatabaseAdapter } from './types.js';
import { translatePlaceholders } from './sql-utils.js';

const { Pool } = pg;

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  readonly engine = 'postgres' as const;
  private pool: pg.Pool;

  constructor(connectionStringOrPool: string | pg.Pool) {
    if (typeof connectionStringOrPool === 'string') {
      const isLocal = connectionStringOrPool.includes('localhost') || connectionStringOrPool.includes('127.0.0.1');
      const sslModeDisable = connectionStringOrPool.includes('sslmode=disable');
      
      this.pool = new Pool({
        connectionString: connectionStringOrPool,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: sslModeDisable || isLocal ? false : { rejectUnauthorized: false },
      });
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
