import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { DatabaseAdapter } from './types.js';

type SqliteParam = null | number | bigint | string | Uint8Array;

export class SqliteDatabaseAdapter implements DatabaseAdapter {
  readonly engine = 'sqlite' as const;
  private db: DatabaseSync;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  getRawDb(): DatabaseSync {
    return this.db;
  }

  prepare(sql: string): StatementSync {
    return this.db.prepare(sql);
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    return stmt.all(...sqliteParams) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    return stmt.get(...sqliteParams) as T | undefined;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    if (params.length === 0 && sql.includes(';')) {
      this.db.exec(sql);
      return { changes: 0 };
    }
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    const result = stmt.run(...sqliteParams);
    return { changes: Number(result.changes) };
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // DatabaseSync is a single connection. Serialize transaction scopes so
    // concurrent HTTP requests cannot overlap BEGIN/COMMIT and turn a
    // recoverable first-run workspace race into SQLITE_ERROR.
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore rollback errors if transaction already rolled back
      }
      throw error;
    } finally {
      release();
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Synchronous convenience methods for backward compatibility
  querySync<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    return stmt.all(...sqliteParams) as T[];
  }

  queryOneSync<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    return stmt.get(...sqliteParams) as T | undefined;
  }

  executeSync(sql: string, params: unknown[] = []): { changes: number } {
    if (params.length === 0 && sql.includes(';')) {
      this.db.exec(sql);
      return { changes: 0 };
    }
    const stmt = this.db.prepare(sql);
    const sqliteParams = params as SqliteParam[];
    const result = stmt.run(...sqliteParams);
    return { changes: Number(result.changes) };
  }
}
