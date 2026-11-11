import type { DatabaseAdapter, Migration } from './types.js';

// This is intentionally not registered in the integration migrator. Migration
// 024 is also used by Member 2 for organization invitations and audit events;
// owner-approved reconciliation is required before either history is activated.
export const emailVerificationMigrations: Migration[] = [{
  id: '024',
  name: 'email_verification_tokens_and_user_state',
  async up(db: DatabaseAdapter): Promise<void> {
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT');
    } else {
      const columns = await db.query<{ name: string }>('PRAGMA table_info(users)');
      if (!columns.some((column) => column.name === 'email_verified_at')) {
        await db.execute('ALTER TABLE users ADD COLUMN email_verified_at TEXT');
      }
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expiry ON email_verification_tokens(expires_at, used_at)');

    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE email_verification_tokens FROM PUBLIC, anon, authenticated');
    }
  },
}];
