import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDatabase, getDatabase, initDatabase, SQLITE_SCHEMA, SqliteDatabaseAdapter } from '../apps/web/src/lib/server/db/index.js';
import { emailVerificationMigrations } from '../apps/web/src/lib/server/db/email-verification-migration.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import {
  EMAIL_VERIFICATION_DEFAULT_TTL_MS,
  buildEmailVerificationMessage,
  requestEmailVerification,
  verifyEmail,
} from '../apps/web/src/lib/server/email-verification.js';
import { POST as authPost } from '../apps/web/src/app/api/auth/route.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-email-verification-${process.pid}.db`);
const environmentKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'PASSWORD_RESET_FROM', 'APIPROOF_APP_URL', 'EMAIL_VERIFICATION_TTL_MINUTES'];
const savedEnvironment = new Map<string, string | undefined>();

describe('email verification', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    for (const key of environmentKeys) {
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
    for (const key of environmentKeys) {
      const saved = savedEnvironment.get(key);
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
      savedEnvironment.delete(key);
    }
  });

  function configureMail() {
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASSWORD = 'test-only-secret';
    process.env.EMAIL_FROM = 'MY OWL <no-reply@example.test>';
    process.env.APIPROOF_APP_URL = 'https://apiproof.test';
  }

  it('stores only a digest, binds the token to the account, and applies the configured expiry', async () => {
    configureMail();
    process.env.EMAIL_VERIFICATION_TTL_MINUTES = '30';
    const account = await createUserWithSession('verify-owner@example.test', 'OriginalPassword123!', 'Verify Owner');
    let token = '';

    await expect(requestEmailVerification(account.user.id, async (message) => { token = message.token; })).resolves.toBe('sent');
    const row = await getDatabase().queryOne<{ token_hash: string; user_id: string; expires_at: string; used_at: string | null }>(
      'SELECT token_hash, user_id, expires_at, used_at FROM email_verification_tokens WHERE user_id = ?', [account.user.id],
    );
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row?.token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(row?.token_hash).not.toBe(token);
    expect(row?.user_id).toBe(account.user.id);
    expect(row?.used_at).toBeNull();
    expect(Date.parse(row!.expires_at) - Date.now()).toBeGreaterThan(30 * 60 * 1000 - 5000);
  });

  it('removes a verification token if delivery fails', async () => {
    configureMail();
    const account = await createUserWithSession('verify-failure@example.test', 'OriginalPassword123!', 'Verify Failure');

    await expect(requestEmailVerification(account.user.id, async () => { throw new Error('smtp failure'); }))
      .rejects.toThrow('EMAIL_VERIFICATION_DELIVERY_FAILED');
    expect(await getDatabase().query('SELECT id FROM email_verification_tokens WHERE user_id = ?', [account.user.id])).toHaveLength(0);
  });

  it('invalidates an older outstanding token when verification is resent', async () => {
    configureMail();
    const account = await createUserWithSession('verify-resend@example.test', 'OriginalPassword123!', 'Verify Resend');
    let firstToken = '';
    let secondToken = '';
    await requestEmailVerification(account.user.id, async (message) => { firstToken = message.token; });
    await requestEmailVerification(account.user.id, async (message) => { secondToken = message.token; });

    expect(firstToken).not.toBe(secondToken);
    await expect(verifyEmail(firstToken)).resolves.toBe('invalid');
    await expect(verifyEmail(secondToken)).resolves.toBe('verified');
  });

  it('verifies once, rejects replay, and changes only the intended account', async () => {
    configureMail();
    const target = await createUserWithSession('verify-target@example.test', 'OriginalPassword123!', 'Verify Target');
    const other = await createUserWithSession('verify-other@example.test', 'OriginalPassword123!', 'Verify Other');
    let token = '';
    await requestEmailVerification(target.user.id, async (message) => { token = message.token; });

    await expect(verifyEmail(token)).resolves.toBe('verified');
    await expect(verifyEmail(token)).resolves.toBe('invalid');
    expect((await getDatabase().queryOne<{ email_verified_at: string | null }>('SELECT email_verified_at FROM users WHERE id = ?', [target.user.id]))?.email_verified_at).toBeTruthy();
    expect((await getDatabase().queryOne<{ email_verified_at: string | null }>('SELECT email_verified_at FROM users WHERE id = ?', [other.user.id]))?.email_verified_at).toBeNull();
  });

  it('allows exactly one concurrent email verification to consume a single-use token', async () => {
    configureMail();
    const account = await createUserWithSession('verify-race@example.test', 'OriginalPassword123!', 'Verify Race');
    let token = '';
    await requestEmailVerification(account.user.id, async (message) => { token = message.token; });

    const outcomes = await Promise.all([verifyEmail(token), verifyEmail(token)]);

    expect(outcomes.sort()).toEqual(['invalid', 'verified']);
    expect((await getDatabase().queryOne<{ email_verified_at: string | null }>(
      'SELECT email_verified_at FROM users WHERE id = ?', [account.user.id],
    ))?.email_verified_at).toBeTruthy();
    expect(await getDatabase().query('SELECT id FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL', [account.user.id])).toHaveLength(0);
  });

  it('rejects expired and malformed tokens without changing verification state', async () => {
    configureMail();
    const account = await createUserWithSession('verify-expired@example.test', 'OriginalPassword123!', 'Verify Expired');
    let token = '';
    await requestEmailVerification(account.user.id, async (message) => { token = message.token; });
    await getDatabase().execute("UPDATE email_verification_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?", [account.user.id]);

    await expect(verifyEmail(token)).resolves.toBe('invalid');
    await expect(verifyEmail('not-a-token')).resolves.toBe('invalid');
    expect((await getDatabase().queryOne<{ email_verified_at: string | null }>('SELECT email_verified_at FROM users WHERE id = ?', [account.user.id]))?.email_verified_at).toBeNull();
  });

  it('builds a safe verification message and requires authentication for resend', async () => {
    configureMail();
    const message = buildEmailVerificationMessage({ email: 'owner@example.test', name: '<script>alert(1)</script>', token: 'a'.repeat(43) });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.text).toContain('https://apiproof.test/verify-email#token=');

    const request = new Request('https://apiproof.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://apiproof.test', host: 'apiproof.test' },
      body: JSON.stringify({ action: 'resend_email_verification' }),
    });
    const response = await authPost(request);
    expect(response.status).toBe(401);
  });

  it('returns a safe unavailable response when resend delivery is not configured', async () => {
    const account = await createUserWithSession('verify-unavailable@example.test', 'OriginalPassword123!', 'Verify Unavailable');
    const request = new Request('https://apiproof.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `apiproof_session=${account.session.id}`, origin: 'https://apiproof.test', host: 'apiproof.test' },
      body: JSON.stringify({ action: 'resend_email_verification' }),
    });
    const response = await authPost(request);
    expect(response.status).toBe(503);
    expect((await response.json() as { code: string }).code).toBe('EMAIL_VERIFICATION_UNAVAILABLE');
  });

  it('limits authenticated verification resend attempts per user before delivery work', async () => {
    const account = await createUserWithSession('verify-resend-limit@example.test', 'OriginalPassword123!', 'Verify Resend Limit');
    const sendResend = () => authPost(new Request('https://apiproof.test/api/auth', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${account.session.id}`,
        origin: 'https://apiproof.test',
        host: 'apiproof.test',
      },
      body: JSON.stringify({ action: 'resend_email_verification' }),
    }));

    const firstThree = await Promise.all([sendResend(), sendResend(), sendResend()]);
    expect(firstThree.map((response) => response.status)).toEqual([503, 503, 503]);
    const fourth = await sendResend();
    expect(fourth.status).toBe(429);
    expect(await fourth.json()).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });

    const rateLimit = await getDatabase().queryOne<{ points: number }>(
      'SELECT points FROM rate_limits WHERE key = ?',
      [`auth:email-verification:resend:user:${account.user.id}`],
    );
    expect(Number(rateLimit?.points)).toBe(4);
  });

  it('uses the one-hour default when no TTL override is configured', () => {
    configureMail();
    const message = buildEmailVerificationMessage({ email: 'owner@example.test', name: 'Owner', token: 'a'.repeat(43) });
    expect(message.text).toContain(`${EMAIL_VERIFICATION_DEFAULT_TTL_MS / 60000} minutes`);
  });

  it('keeps migration 024 idempotent and transaction-safe', async () => {
    const legacyDb = new DatabaseSync(':memory:');
    try {
      legacyDb.exec(SQLITE_SCHEMA);
      const adapter = new SqliteDatabaseAdapter(legacyDb);
      const migration = emailVerificationMigrations[0]!;
      await migration.up(adapter);
      await migration.up(adapter);
      expect(await adapter.queryOne('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'email_verification_tokens'])).toMatchObject({ name: 'email_verification_tokens' });
      expect((await adapter.query<{ name: string }>('PRAGMA table_info(users)')).some((column) => column.name === 'email_verified_at')).toBe(true);
    } finally {
      legacyDb.close();
    }
  });
});
