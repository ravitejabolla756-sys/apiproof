import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession, authenticateUser } from '../apps/web/src/lib/server/auth.js';
import { completePasswordReset, isValidResetToken, PASSWORD_RESET_TTL_MS, requestPasswordReset } from '../apps/web/src/lib/server/password-reset.js';
import { buildPasswordResetMessage, isPasswordResetEmailConfigured } from '../apps/web/src/lib/server/password-reset-email.js';
import { POST as authPost } from '../apps/web/src/app/api/auth/route.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';
import { checkRateLimit } from '../apps/web/src/lib/server/rate-limit.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-password-reset-${process.pid}.db`);
const savedEnvironment = new Map<string, string | undefined>();
const emailConfigurationKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'PASSWORD_RESET_FROM', 'APIPROOF_APP_URL'];

describe('password recovery', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'password-reset-test-secret-at-least-32-characters';
    for (const key of emailConfigurationKeys) {
      savedEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }
    resetRateLimits();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const key of emailConfigurationKeys) {
      const saved = savedEnvironment.get(key);
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
      savedEnvironment.delete(key);
    }
  });

  async function createAccount(email: string) {
    return createUserWithSession(email, 'OriginalPassword123!', `User ${email}`);
  }

  function configureMail() {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASSWORD = 'test-only-secret';
    process.env.PASSWORD_RESET_FROM = 'MY OWL <no-reply@example.test>';
    process.env.APIPROOF_APP_URL = 'https://apiproof.test';
  }

  it('stores only a digest of a random single-use token and expires it after 20 minutes', async () => {
    const user = await createAccount('reset-owner@example.test');
    let issuedToken = '';
    await requestPasswordReset(user.user.email, async (message) => { issuedToken = message.token; });

    expect(isValidResetToken(issuedToken)).toBe(true);
    const row = await getDatabase().queryOne<{ token_hash: string; expires_at: string; user_id: string }>(
      'SELECT token_hash, expires_at, user_id FROM password_reset_tokens WHERE user_id = ?', [user.user.id],
    );
    expect(row?.token_hash).toBe(crypto.createHash('sha256').update(issuedToken).digest('hex'));
    expect(row?.token_hash).not.toBe(issuedToken);
    expect(row?.user_id).toBe(user.user.id);
    expect(Date.parse(row!.expires_at) - Date.now()).toBeGreaterThan(PASSWORD_RESET_TTL_MS - 5000);
    expect(Date.parse(row!.expires_at) - Date.now()).toBeLessThanOrEqual(PASSWORD_RESET_TTL_MS);
  });

  it('does not reveal unknown accounts or create tokens for them', async () => {
    const sender = vi.fn();
    await requestPasswordReset('unknown@example.test', sender);
    expect(sender).not.toHaveBeenCalled();
    expect(await getDatabase().query('SELECT id FROM password_reset_tokens')).toHaveLength(0);
  });

  it('removes an issued token if email delivery fails', async () => {
    const user = await createAccount('delivery-failure@example.test');
    await expect(requestPasswordReset(user.user.email, async () => { throw new Error('smtp failure'); }))
      .rejects.toThrow('PASSWORD_RESET_DELIVERY_FAILED');
    expect(await getDatabase().query('SELECT id FROM password_reset_tokens WHERE user_id = ?', [user.user.id])).toHaveLength(0);
  });

  it('changes only the intended account password, consumes the token, and invalidates that account sessions', async () => {
    const target = await createAccount('target@example.test');
    const other = await createAccount('other@example.test');
    let token = '';
    await requestPasswordReset(target.user.email, async (message) => { token = message.token; });

    expect(await completePasswordReset(token, 'NewSecurePassword123!')).toBe(true);
    expect(await authenticateUser(target.user.email, 'NewSecurePassword123!')).toMatchObject({ id: target.user.id });
    expect(await authenticateUser(target.user.email, 'OriginalPassword123!')).toBeNull();
    expect(await authenticateUser(other.user.email, 'OriginalPassword123!')).toMatchObject({ id: other.user.id });
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE user_id = ?', [target.user.id])).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE user_id = ?', [other.user.id])).toBeTruthy();

    const storedToken = await getDatabase().queryOne<{ used_at: string | null }>(
      'SELECT used_at FROM password_reset_tokens WHERE user_id = ?', [target.user.id],
    );
    expect(storedToken?.used_at).toBeTruthy();
    expect(await completePasswordReset(token, 'AnotherPassword123!')).toBe(false);
  });

  it('allows exactly one concurrent password reset to consume a single-use token', async () => {
    const target = await createAccount('reset-race@example.test');
    let token = '';
    await requestPasswordReset(target.user.email, async (message) => { token = message.token; });

    const outcomes = await Promise.all([
      completePasswordReset(token, 'ConcurrentPasswordOne123!'),
      completePasswordReset(token, 'ConcurrentPasswordTwo123!'),
    ]);

    expect(outcomes.sort()).toEqual([false, true]);
    const acceptedPasswords = await Promise.all([
      authenticateUser(target.user.email, 'ConcurrentPasswordOne123!'),
      authenticateUser(target.user.email, 'ConcurrentPasswordTwo123!'),
    ]);
    expect(acceptedPasswords.filter(Boolean)).toHaveLength(1);
  });

  it('rejects expired and unknown reset tokens', async () => {
    const user = await createAccount('expired@example.test');
    let token = '';
    await requestPasswordReset(user.user.email, async (message) => { token = message.token; });
    await getDatabase().execute("UPDATE password_reset_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?", [user.user.id]);

    expect(await completePasswordReset(token, 'NewSecurePassword123!')).toBe(false);
    expect(await completePasswordReset('A'.repeat(43), 'NewSecurePassword123!')).toBe(false);
    expect(await authenticateUser(user.user.email, 'OriginalPassword123!')).toMatchObject({ id: user.user.id });
  });

  it('fails closed instead of using the in-memory limiter when reset rate-limit storage fails', async () => {
    await getDatabase().execute('DROP TABLE rate_limits');
    await expect(checkRateLimit('auth:password-reset:test', 3, 60_000, { failClosed: true }))
      .rejects.toThrow('RATE_LIMIT_STORE_UNAVAILABLE');
  });

  it('generates a token link in the URL fragment and escapes user-controlled HTML', () => {
    configureMail();
    const message = buildPasswordResetMessage({ email: 'owner@example.test', name: '<script>alert(1)</script>', token: 'a'.repeat(43) });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('#token=');
    expect(message.text).toContain('https://apiproof.test/reset-password#token=');
  });

  it('keeps the request API generic for unknown accounts and fails closed when SMTP is unconfigured', async () => {
    const createRequest = (email: string) => new Request('https://apiproof.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://apiproof.test', host: 'apiproof.test' },
      body: JSON.stringify({ action: 'request_password_reset', email }),
    });

    expect(isPasswordResetEmailConfigured()).toBe(false);
    const unavailable = await authPost(createRequest('nobody@example.test'));
    expect(unavailable.status).toBe(503);
    expect((await unavailable.json() as { code: string }).code).toBe('PASSWORD_RESET_UNAVAILABLE');

    configureMail();
    const accepted = await authPost(createRequest('nobody@example.test'));
    expect(accepted.status).toBe(202);
    expect((await accepted.json() as { message: string }).message).toContain('If an account exists');
  });
});
