import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseAdapter, Migration } from './types.js';

const additions: Array<[string, string, string]> = [
  ['slack_notification_deliveries', 'next_attempt_at', 'TEXT'],
  ['slack_notification_deliveries', 'post_started_at', 'TEXT'],
  ['slack_interaction_jobs', 'next_attempt_at', 'TEXT'],
  ['slack_connections', 'rate_limit_until', 'TEXT'],
];

const indexes = `
CREATE INDEX IF NOT EXISTS idx_slack_delivery_due ON slack_notification_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_slack_interaction_due ON slack_interaction_jobs(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_slack_interaction_outcomes ON slack_interaction_jobs(migration_id, status);
CREATE INDEX IF NOT EXISTS idx_verification_terminal_outcomes ON migration_verification_jobs(status, migration_id);
`;

/** Idempotent upgrades also cover existing SQLite databases opened without the CLI migrator. */
export function initializeSlackReliabilitySqlite(db: DatabaseSync): void {
  for (const [table, column, definition] of additions) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((value) => value.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  db.exec(indexes);
}

export const slackReliabilityMigrations: Migration[] = [{
  id: '014',
  name: 'slack_scheduled_retries_and_recoverable_outcomes',
  async up(db: DatabaseAdapter) {
    for (const [table, column, definition] of additions) {
      if (db.engine === 'postgres') {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
      } else {
        const columns = await db.query<{ name: string }>(`PRAGMA table_info(${table})`);
        if (!columns.some((value) => value.name === column)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
    await db.execute(indexes);
  },
}];
