import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import { EmailDeliveryUnavailableError } from './email-delivery-state.js';
import { getSmtpConfiguration, sendTransactionalEmail } from './email-delivery.js';

export const EMAIL_VERIFICATION_DEFAULT_TTL_MS = 60 * 60 * 1000;
export const EMAIL_VERIFICATION_MIN_TTL_MS = 5 * 60 * 1000;
export const EMAIL_VERIFICATION_MAX_TTL_MS = 24 * 60 * 60 * 1000;

export type EmailVerificationResult = 'verified' | 'already_verified' | 'invalid';

export interface EmailVerificationMessage {
  email: string;
  name: string;
  token: string;
}

function getEmailVerificationTtlMs(environment: NodeJS.ProcessEnv = process.env): number {
  const configuredMinutes = Number(environment.EMAIL_VERIFICATION_TTL_MINUTES || '60');
  if (!Number.isInteger(configuredMinutes)) return EMAIL_VERIFICATION_DEFAULT_TTL_MS;
  const configuredMs = configuredMinutes * 60 * 1000;
  return Math.min(EMAIL_VERIFICATION_MAX_TTL_MS, Math.max(EMAIL_VERIFICATION_MIN_TTL_MS, configuredMs));
}

function digestToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function isValidEmailVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function buildEmailVerificationMessage(message: EmailVerificationMessage) {
  const config = getSmtpConfiguration();
  if (!config) throw new Error('EMAIL_VERIFICATION_EMAIL_NOT_CONFIGURED');

  const link = new URL('/verify-email', config.appUrl);
  link.hash = `token=${encodeURIComponent(message.token)}`;
  const safeName = escapeHtml(message.name);
  const safeLink = escapeHtml(link.toString());

  return {
    from: config.from,
    to: message.email,
    subject: 'Verify your MY OWL email address',
    text: `Hello ${message.name},\n\nVerify your MY OWL email address using this link. It expires in ${Math.round(getEmailVerificationTtlMs() / 60000)} minutes and can be used once:\n${link}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Verify your MY OWL email address using the link below. It expires in ${Math.round(getEmailVerificationTtlMs() / 60000)} minutes and can be used once.</p><p><a href="${safeLink}">Verify email address</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  };
}

async function sendDefaultEmail(message: EmailVerificationMessage): Promise<void> {
  await sendTransactionalEmail(buildEmailVerificationMessage(message));
}

export async function requestEmailVerification(
  userId: string,
  sendEmail: (message: EmailVerificationMessage) => Promise<void> = sendDefaultEmail,
): Promise<'sent' | 'already_verified' | 'unavailable'> {
  const db = getDatabase();
  const user = await db.queryOne<{ email: string; name: string; email_verified_at: string | null }>(
    'SELECT email, name, email_verified_at FROM users WHERE id = ?', [userId],
  );
  if (!user) return 'unavailable';
  if (user.email_verified_at) return 'already_verified';
  if (!getSmtpConfiguration()) return 'unavailable';

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = digestToken(token);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + getEmailVerificationTtlMs()).toISOString();
  const id = `evt_${crypto.randomBytes(16).toString('hex')}`;

  const reservation = await db.transaction(async (tx) => {
    const currentUser = await tx.queryOne<{ email: string; name: string; email_verified_at: string | null }>(
      `SELECT email, name, email_verified_at FROM users WHERE id = ?${tx.engine === 'postgres' ? ' FOR UPDATE' : ''}`,
      [userId],
    );
    if (!currentUser) return { status: 'unavailable' as const };
    if (currentUser.email_verified_at) return { status: 'already_verified' as const };
    await tx.execute('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
    await tx.execute(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, [id, userId, tokenHash, expiresAt, createdAt]);
    return { status: 'reserved' as const, user: currentUser };
  });
  if (reservation.status !== 'reserved') return reservation.status;

  try {
    await sendEmail({ email: reservation.user.email, name: reservation.user.name, token });
  } catch (error) {
    await db.execute('DELETE FROM email_verification_tokens WHERE id = ? AND token_hash = ?', [id, tokenHash]);
    if (error instanceof EmailDeliveryUnavailableError) throw error;
    throw new Error('EMAIL_VERIFICATION_DELIVERY_FAILED', { cause: error });
  }
  return 'sent';
}

export async function verifyEmail(token: string): Promise<EmailVerificationResult> {
  if (!isValidEmailVerificationToken(token)) return 'invalid';
  const db = getDatabase();
  const tokenHash = digestToken(token);

  return db.transaction(async (tx) => {
    const candidate = await tx.queryOne<{ user_id: string }>(
      'SELECT user_id FROM email_verification_tokens WHERE token_hash = ?', [tokenHash],
    );
    if (!candidate) return 'invalid';
    const user = await tx.queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = ?${tx.engine === 'postgres' ? ' FOR UPDATE' : ''}`,
      [candidate.user_id],
    );
    if (!user) return 'invalid';

    const now = new Date().toISOString();
    const row = await tx.queryOne<{ id: string; user_id: string }>(`
      SELECT id, user_id FROM email_verification_tokens
      WHERE token_hash = ? AND user_id = ? AND used_at IS NULL AND expires_at > ?
    `, [tokenHash, candidate.user_id, now]);
    if (!row) return 'invalid';
    const consumed = await tx.execute(`
      UPDATE email_verification_tokens SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `, [now, row.id, now]);
    if (consumed.changes !== 1) return 'invalid';
    const updated = await tx.execute(
      'UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL',
      [now, row.user_id],
    );
    return updated.changes === 1 ? 'verified' : 'already_verified';
  });
}
