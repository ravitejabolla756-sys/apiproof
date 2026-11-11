import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { emailVerificationMigrations } from '../apps/web/src/lib/server/db/email-verification-migration.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import {
  buildEmailVerificationMessage,
  requestEmailVerification,
  verifyEmail,
} from '../apps/web/src/lib/server/email-verification.js';
import { getSmtpConfiguration } from '../apps/web/src/lib/server/email-delivery.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-email-verification-integration-${process.pid}.db`);
const environmentKeys = ['NODE_ENV', 'APIPROOF_DB_PATH', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'APIPROOF_APP_URL'];
const savedEnvironment = new Map<string, string | undefined>();

describe('AUTH-05 email verification integration slice', () => {
  beforeEach(async () => {
    for (const key of environmentKeys) {
      savedEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
    await emailVerificationMigrations[0]!.up(getDatabase());
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const key of environmentKeys) {
      const value = savedEnvironment.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
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

  it('rejects incomplete or credential-bearing production configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASSWORD = 'test-only-secret';
    process.env.EMAIL_FROM = 'MY OWL <no-reply@example.test>';
    process.env.APIPROOF_APP_URL = 'http://apiproof.test';
    expect(getSmtpConfiguration()).toBeNull();
    process.env.APIPROOF_APP_URL = 'https://user:password@apiproof.test';
    expect(getSmtpConfiguration()).toBeNull();
  });

  it('stores only a digest, escapes the message, and verifies once with a fake transport', async () => {
    configureMail();
    const account = await createUserWithSession('auth05@example.test', 'OriginalPassword123!', 'Auth 05 <Owner>');
    let token = '';
    await expect(requestEmailVerification(account.user.id, async (message) => { token = message.token; })).resolves.toBe('sent');

    const row = await getDatabase().queryOne<{ token_hash: string; used_at: string | null }>(
      'SELECT token_hash, used_at FROM email_verification_tokens WHERE user_id = ?', [account.user.id],
    );
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row?.token_hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(row?.token_hash).not.toBe(token);
    expect((buildEmailVerificationMessage({ email: account.user.email, name: '<script>alert(1)</script>', token: 'a'.repeat(43) })).html)
      .not.toContain('<script>');
    await expect(verifyEmail(token)).resolves.toBe('verified');
    await expect(verifyEmail(token)).resolves.toBe('invalid');
  });

  it('invalidates an older token and removes failed-delivery reservations', async () => {
    configureMail();
    const account = await createUserWithSession('auth05-resend@example.test', 'OriginalPassword123!', 'Auth 05 Resend');
    let firstToken = '';
    let secondToken = '';
    await requestEmailVerification(account.user.id, async (message) => { firstToken = message.token; });
    await requestEmailVerification(account.user.id, async (message) => { secondToken = message.token; });
    expect(await verifyEmail(firstToken)).toBe('invalid');
    expect(await verifyEmail(secondToken)).toBe('verified');

    const failed = await createUserWithSession('auth05-failure@example.test', 'OriginalPassword123!', 'Auth 05 Failure');
    await expect(requestEmailVerification(failed.user.id, async () => { throw new Error('smtp failure'); }))
      .rejects.toThrow('EMAIL_VERIFICATION_DELIVERY_FAILED');
    expect(await getDatabase().query('SELECT id FROM email_verification_tokens WHERE user_id = ?', [failed.user.id])).toHaveLength(0);
  });
});
