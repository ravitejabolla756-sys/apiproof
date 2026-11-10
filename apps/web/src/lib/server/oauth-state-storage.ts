import { getDatabase } from './db/index.js';

export type OAuthStateTable = 'github_login_oauth_states' | 'google_oauth_states';

const OAUTH_STATE_TABLES: Record<OAuthStateTable, string> = {
  'github_login_oauth_states': 'github_login_oauth_states',
  'google_oauth_states': 'google_oauth_states',
};

const MAX_EXPIRED_OAUTH_STATES_PER_PRUNE = 1_000;

/** Remove expired transient login state while retaining unexpired replay evidence. */
export async function pruneExpiredOAuthStates(table: OAuthStateTable, now: Date): Promise<void> {
  const tableName = OAUTH_STATE_TABLES[table];
  if (!tableName) throw new Error('OAUTH_STATE_TABLE_INVALID');
  await getDatabase().execute(
    `DELETE FROM ${tableName}
     WHERE state_hash IN (
       SELECT state_hash FROM ${tableName}
       WHERE expires_at <= ?
       ORDER BY expires_at, state_hash
       LIMIT ?
     )`,
    [now.toISOString(), MAX_EXPIRED_OAUTH_STATES_PER_PRUNE],
  );
}
