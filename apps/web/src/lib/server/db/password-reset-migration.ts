import type { DatabaseAdapter, Migration } from './types.js';

export const passwordResetMigrations: Migration[] = [
  {
    id: '011',
    name: 'single_use_password_reset_tokens',
    up: async (db: DatabaseAdapter) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL
        )
      `);
      await db.execute('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at)');
    },
  },
];
