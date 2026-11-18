import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getDatabase } from './db/index.js';

export const EMAIL_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const OTP_PATTERN = /^\d{6}$/;

function codeDigest(userId: string, code: string): string {
  const pepper = process.env.APIPROOF_SECRET?.trim();
  if (!pepper) throw new Error('EMAIL_VERIFICATION_SECRET_UNAVAILABLE');
  return crypto.createHmac('sha256', pepper).update(`${userId}:${code}`).digest('hex');
}

function getMailConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) return null;
  return { host, port, user, password, from, secure: process.env.SMTP_SECURE === 'true' || port === 465 };
}

export function isEmailVerificationConfigured(): boolean {
  return Boolean(getMailConfig() && process.env.APIPROOF_SECRET?.trim());
}

async function sendCode(email: string, name: string, code: string): Promise<void> {
  const config = getMailConfig();
  if (!config) throw new Error('EMAIL_VERIFICATION_DELIVERY_UNAVAILABLE');
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
  });
  try {
    await transporter.sendMail({
      from: config.from,
      to: email,
      subject: 'Your MY OWL verification code',
      text: `Hello ${name},\n\nYour MY OWL verification code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Your MY OWL verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    });
  } finally {
    transporter.close();
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export async function requestEmailVerificationCode(userId: string): Promise<'sent' | 'already_verified'> {
  const db = getDatabase();
  const user = await db.queryOne<{ email: string; name: string; email_verified_at: string | null }>(
    'SELECT email, name, email_verified_at FROM users WHERE id = ?', [userId],
  );
  if (!user) throw new Error('EMAIL_VERIFICATION_USER_NOT_FOUND');
  if (user.email_verified_at) return 'already_verified';
  if (!isEmailVerificationConfigured()) throw new Error('EMAIL_VERIFICATION_DELIVERY_UNAVAILABLE');

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const now = new Date();
  const createdAt = now.toISOString();
  const id = `evc_${crypto.randomBytes(16).toString('hex')}`;
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM email_verification_codes WHERE user_id = ?', [userId]);
    await tx.execute(`INSERT INTO email_verification_codes (id, user_id, code_hash, expires_at, attempts, used_at, created_at)
      VALUES (?, ?, ?, ?, 0, NULL, ?)`, [id, userId, codeDigest(userId, code), new Date(now.getTime() + EMAIL_VERIFICATION_CODE_TTL_MS).toISOString(), createdAt]);
  });
  try {
    await sendCode(user.email, user.name, code);
  } catch {
    await db.execute('DELETE FROM email_verification_codes WHERE id = ?', [id]);
    throw new Error('EMAIL_VERIFICATION_DELIVERY_FAILED');
  }
  return 'sent';
}

export async function verifyEmailCode(userId: string, code: string): Promise<boolean> {
  if (!OTP_PATTERN.test(code)) return false;
  const db = getDatabase();
  const now = new Date().toISOString();
  const digest = codeDigest(userId, code);
  return db.transaction(async (tx) => {
    const record = await tx.queryOne<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM email_verification_codes
       WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1${tx.engine === 'postgres' ? ' FOR UPDATE' : ''}`,
      [userId, now],
    );
    if (!record || record.attempts >= MAX_CODE_ATTEMPTS) return false;
    const expected = Buffer.from(record.code_hash, 'hex');
    const supplied = Buffer.from(digest, 'hex');
    const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    if (!matches) {
      await tx.execute('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      return false;
    }
    const used = await tx.execute('UPDATE email_verification_codes SET used_at = ? WHERE id = ? AND used_at IS NULL', [now, record.id]);
    if (used.changes !== 1) return false;
    const updated = await tx.execute('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL', [now, userId]);
    return updated.changes === 1;
  });
}

export async function getEmailVerificationStatus(userId: string): Promise<'verified' | 'unverified'> {
  const user = await getDatabase().queryOne<{ email_verified_at: string | null }>(
    'SELECT email_verified_at FROM users WHERE id = ?', [userId],
  );
  if (!user) throw new Error('EMAIL_VERIFICATION_USER_NOT_FOUND');
  return user.email_verified_at ? 'verified' : 'unverified';
}
