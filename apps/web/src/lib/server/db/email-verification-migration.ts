import type { DatabaseAdapter, Migration } from './types.js';

/** Adds server-owned account verification state and short-lived OTP storage. */
export const emailVerificationMigrations: Migration[] = [{
  id: '028',
  name: 'email_verification_otp',
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
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        used_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_codes(user_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_email_verification_expiry ON email_verification_codes(expires_at, used_at)');

    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE email_verification_codes FROM PUBLIC, anon, authenticated');
    }
  },
}];
