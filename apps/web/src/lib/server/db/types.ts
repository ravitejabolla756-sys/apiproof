export type DatabaseEngine = 'sqlite' | 'postgres';

export interface DatabaseAdapter {
  readonly engine: DatabaseEngine;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: string;
}

export interface Migration {
  id: string;
  name: string;
  up(db: DatabaseAdapter): Promise<void>;
}
