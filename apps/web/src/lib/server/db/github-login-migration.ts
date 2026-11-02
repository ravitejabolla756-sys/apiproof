import type { DatabaseAdapter, Migration } from './types.js';

/** GitHub Login OAuth state and stable provider-identity storage. */
export const SQLITE_GITHUB_LOGIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS github_login_oauth_states (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS github_oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  github_subject TEXT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  github_email TEXT NOT NULL,
  github_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_github_login_oauth_states_expiry
  ON github_login_oauth_states(expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_github_oauth_accounts_user
  ON github_oauth_accounts(user_id);
`;

export const githubLoginMigrations: Migration[] = [{
  id: '023',
  name: 'github_login_oauth_identity_and_state',
  async up(db: DatabaseAdapter): Promise<void> {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS github_login_oauth_states (
        state_hash TEXT PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        return_to TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS github_oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        github_subject TEXT UNIQUE NOT NULL,
        github_login TEXT NOT NULL,
        github_email TEXT NOT NULL,
        github_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id)
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_github_login_oauth_states_expiry ON github_login_oauth_states(expires_at, consumed_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_github_oauth_accounts_user ON github_oauth_accounts(user_id)');
    if (db.engine === 'postgres') {
      await db.execute('ALTER TABLE github_login_oauth_states ENABLE ROW LEVEL SECURITY');
      await db.execute('ALTER TABLE github_oauth_accounts ENABLE ROW LEVEL SECURITY');
      await db.execute('REVOKE ALL ON TABLE github_login_oauth_states, github_oauth_accounts FROM PUBLIC, anon, authenticated');
    }
  },
}];
