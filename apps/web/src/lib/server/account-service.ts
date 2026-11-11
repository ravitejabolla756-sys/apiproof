import { getDatabase } from './db/index.js';
import { hashPassword, verifyPassword } from './auth.js';

export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  authProviders: ['password'];
  hasLocalPassword: true;
}

export class AccountServiceError extends Error {
  constructor(message: string, public readonly code: 'ACCOUNT_NOT_FOUND' | 'INVALID_CURRENT_PASSWORD') {
    super(message);
    this.name = 'AccountServiceError';
  }
}

async function getAccountRow(userId: string) {
  const row = await getDatabase().queryOne<{ id: string; email: string; name: string; created_at: string; password_hash: string }>(
    'SELECT id, email, name, created_at, password_hash FROM users WHERE id = ?', [userId],
  );
  if (!row) throw new AccountServiceError('Account not found.', 'ACCOUNT_NOT_FOUND');
  return row;
}

export async function getAccountForUser(userId: string): Promise<AccountProfile> {
  const row = await getAccountRow(userId);
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at, authProviders: ['password'], hasLocalPassword: true };
}

export async function updateAccountDisplayName(userId: string, name: string): Promise<AccountProfile> {
  const cleanName = name.trim();
  if (cleanName.length === 0 || cleanName.length > 100) throw new Error('Account name must be 1-100 characters.');
  const result = await getDatabase().execute('UPDATE users SET name = ? WHERE id = ?', [cleanName, userId]);
  if (result.changes !== 1) throw new AccountServiceError('Account not found.', 'ACCOUNT_NOT_FOUND');
  return getAccountForUser(userId);
}

export async function changeAccountPassword(userId: string, currentSessionId: string, currentPassword: string, newPassword: string): Promise<void> {
  const row = await getAccountRow(userId);
  if (!verifyPassword(currentPassword, row.password_hash)) throw new AccountServiceError('Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
  await getDatabase().transaction(async (tx) => {
    await tx.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), userId]);
    await tx.execute('DELETE FROM sessions WHERE user_id = ? AND id <> ?', [userId, currentSessionId]);
  });
}
