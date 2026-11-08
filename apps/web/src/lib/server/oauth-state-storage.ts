import { getDatabase } from './db/index.js';

export type OAuthStateTable = 'github_login_oauth_states' | 'google_oauth_states';

const OAUTH_STATE_TABLES: Record<OAuthStateTable, string> = {
  'github_login_oauth_states': 'github_login_oauth_states',
  'google_oauth_states': 'google_oauth_states',
};

/** Remove expired transient login state while retaining unexpired replay evidence. */
export async function pruneExpiredOAuthStates(table: OAuthStateTable, now: Date): Promise<void> {
  const tableName = OAUTH_STATE_TABLES[table];
  if (!tableName) throw new Error('OAUTH_STATE_TABLE_INVALID');
  await getDatabase().execute(
    `DELETE FROM ${tableName} WHERE expires_at <= ?`,
    [now.toISOString()],
  );
}
