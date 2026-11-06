import { getDatabase } from './db/index.js';
import { hashPassword, verifyPassword } from './auth.js';

export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  authProviders: Array<'password' | 'google' | 'github'>;
  hasLocalPassword: boolean;
}

export class AccountServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'ACCOUNT_NOT_FOUND' | 'OAUTH_ONLY_ACCOUNT' | 'INVALID_CURRENT_PASSWORD',
  ) {
    super(message);
    this.name = 'AccountServiceError';
  }
}

interface AccountRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  password_hash: string;
}

async function getAccountRow(userId: string): Promise<AccountRow> {
  const row = await getDatabase().queryOne<AccountRow>(
    'SELECT id, email, name, created_at, password_hash FROM users WHERE id = ?',
    [userId],
  );
  if (!row) throw new AccountServiceError('Account not found.', 'ACCOUNT_NOT_FOUND');
  return row;
}

async function getOAuthProviders(userId: string): Promise<Array<'google' | 'github'>> {
  const db = getDatabase();
  const providers: Array<'google' | 'github'> = [];
  const [google, github] = await Promise.all([
    db.queryOne<{ id: string }>('SELECT id FROM google_oauth_accounts WHERE user_id = ? LIMIT 1', [userId]),
    db.queryOne<{ id: string }>('SELECT id FROM github_oauth_accounts WHERE user_id = ? LIMIT 1', [userId]),
  ]);
  if (google) providers.push('google');
  if (github) providers.push('github');
  return providers;
}

export async function getAccountForUser(userId: string): Promise<AccountProfile> {
  const row = await getAccountRow(userId);
  const oauthProviders = await getOAuthProviders(userId);
  // OAuth-created accounts receive an intentionally random password hash. Until
  // a local-password enrollment flow exists, provider presence is the source of
  // truth for whether password sign-in is available to the user.
  const hasLocalPassword = oauthProviders.length === 0;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    authProviders: [
      ...(hasLocalPassword ? ['password' as const] : []),
      ...oauthProviders,
    ],
    hasLocalPassword,
  };
}

export async function updateAccountDisplayName(userId: string, name: string): Promise<AccountProfile> {
  const cleanName = name.trim();
  if (cleanName.length === 0 || cleanName.length > 100) {
    throw new Error('Account name must be 1-100 characters.');
  }
  const db = getDatabase();
  const result = await db.execute('UPDATE users SET name = ? WHERE id = ?', [cleanName, userId]);
  if (result.changes !== 1) throw new AccountServiceError('Account not found.', 'ACCOUNT_NOT_FOUND');
  return getAccountForUser(userId);
}

export async function changeAccountPassword(
  userId: string,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const row = await getAccountRow(userId);
  const oauthProviders = await getOAuthProviders(userId);
  if (oauthProviders.length > 0) {
    throw new AccountServiceError(
      'Password sign-in is not configured for this OAuth account.',
      'OAUTH_ONLY_ACCOUNT',
    );
  }
  if (!verifyPassword(currentPassword, row.password_hash)) {
    throw new AccountServiceError('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  }

  const db = getDatabase();
  const passwordHash = hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await tx.execute('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [userId, currentSessionId]);
  });
}

