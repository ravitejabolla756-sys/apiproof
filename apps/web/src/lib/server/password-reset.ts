import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import { hashPassword } from './auth.js';
import { sendPasswordResetEmail } from './password-reset-email.js';
import { sendTrackedEmail } from './email-delivery-state.js';

export const PASSWORD_RESET_TTL_MS = 20 * 60 * 1000;

function digestToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function requestPasswordReset(
  email: string,
  sendEmail: typeof sendPasswordResetEmail = sendPasswordResetEmail,
): Promise<void> {
  const db = getDatabase();
  const user = await db.queryOne<{ id: string; email: string; name: string }>(
    'SELECT id, email, name FROM users WHERE email = ?',
    [email.toLowerCase().trim()],
  );
  if (!user) return;

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = digestToken(token);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString();
  const id = `prt_${crypto.randomBytes(16).toString('hex')}`;

  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM password_reset_tokens WHERE expires_at <= ?', [createdAt]);
    await tx.execute(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, [id, user.id, tokenHash, expiresAt, createdAt]);
  });

  try {
    await sendTrackedEmail({
      eventKey: `password-reset:${id}`,
      templateKey: 'account.password_reset',
      templateVersion: 'v1',
      recipientUserId: user.id,
    }, () => sendEmail({ email: user.email, name: user.name, token }));
  } catch {
    await db.execute('DELETE FROM password_reset_tokens WHERE id = ? AND token_hash = ?', [id, tokenHash]);
    throw new Error('PASSWORD_RESET_DELIVERY_FAILED');
  }
}

export async function completePasswordReset(token: string, password: string): Promise<boolean> {
  const db = getDatabase();
  const tokenHash = digestToken(token);
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const reset = await tx.queryOne<{ id: string; user_id: string }>(`
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `, [tokenHash, now]);
    if (!reset) return false;

    const consumed = await tx.execute(`
      UPDATE password_reset_tokens SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `, [now, reset.id, now]);
    if (consumed.changes !== 1) return false;

    const updated = await tx.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), reset.user_id]);
    if (updated.changes !== 1) throw new Error('PASSWORD_RESET_USER_NOT_FOUND');

    // Password recovery invalidates every existing session for this user only.
    await tx.execute('DELETE FROM sessions WHERE user_id = ?', [reset.user_id]);
    await tx.execute(`
      UPDATE password_reset_tokens SET used_at = ?
      WHERE user_id = ? AND id <> ? AND used_at IS NULL
    `, [now, reset.user_id, reset.id]);
    return true;
  });
}

export function isValidResetToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
