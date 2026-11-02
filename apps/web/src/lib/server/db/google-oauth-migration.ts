import type { DatabaseAdapter, Migration } from './types.js';

/**
 * Google OAuth state and stable provider-identity storage.
 *
 * The provider subject is the only automatic account key. Email collisions
 * are deliberately handled by the OAuth service instead of being linked.
 */
export const SQLITE_GOOGLE_OAUTH_SCHEMA = `
CREATE TABLE IF NOT EXISTS google_oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  google_subject TEXT UNIQUE NOT NULL,
  google_email TEXT NOT NULL,
  google_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expiry
  ON google_oauth_states(expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_google_oauth_accounts_user
  ON google_oauth_accounts(user_id);
`;

export const googleOAuthMigrations: Migration[] = [{
  id: '022',
  name: 'google_oauth_identity_and_state',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS google_oauth_states (
        state_hash TEXT PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        nonce TEXT NOT NULL,
        return_to TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS google_oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        google_subject TEXT UNIQUE NOT NULL,
        google_email TEXT NOT NULL,
        google_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expiry ON google_oauth_states(expires_at, consumed_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_google_oauth_accounts_user ON google_oauth_accounts(user_id)');
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE google_oauth_states ENABLE ROW LEVEL SECURITY');
      await db.execute('ALTER TABLE google_oauth_accounts ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE google_oauth_states, google_oauth_accounts FROM PUBLIC, anon, authenticated');
    }
  },
}];
