import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as authPost } from '../apps/web/src/app/api/auth/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { emailVerificationMigrations } from '../apps/web/src/lib/server/db/email-verification-migration.js';
import { requestEmailVerification } from '../apps/web/src/lib/server/email-verification.js';

const DB_PATH = path.resolve('.tmp/test-email-verification-route.db');

function request(body: Record<string, unknown>, sessionId?: string): Request {
  return new Request('https://apiproof.test/api/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://apiproof.test',
      host: 'apiproof.test',
      ...(sessionId ? { cookie: `apiproof_session=${sessionId}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('email verification auth route', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_SECRET = 'email-verification-route-secret-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
    await emailVerificationMigrations[0]!.up(getDatabase());
    await getDatabase().execute(`CREATE TABLE email_deliveries (
      id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, template_key TEXT NOT NULL, template_version TEXT NOT NULL,
      recipient_user_id TEXT, workspace_id TEXT, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      error_category TEXT, next_attempt_at TEXT, claimed_by TEXT, lease_expires_at TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, delivered_at TEXT
    )`);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    delete process.env.APIPROOF_SECRET;
    delete process.env.APIPROOF_DB_PATH;
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('verifies an issued token once through the authenticated API boundary', async () => {
    const account = await createUserWithSession('verify-route@example.test', 'Password123!', 'Verify Route');
    process.env.SMTP_HOST = 'smtp.fixture.test';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_USER = 'fixture-user';
    process.env.SMTP_PASSWORD = 'fixture-password';
    process.env.EMAIL_FROM = 'no-reply@fixture.test';
    process.env.NEXT_PUBLIC_APP_URL = 'https://apiproof.test';
    let token = '';
    await requestEmailVerification(account.user.id, async (message) => { token = message.token; });
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const verified = await authPost(request({ action: 'verify_email', token }));
    const verifiedBody = await verified.json();
    expect({ status: verified.status, body: verifiedBody }).toMatchObject({ status: 200, body: { success: true, code: 'EMAIL_VERIFIED' } });

    const replay = await authPost(request({ action: 'verify_email', token }));
    expect(replay.status).toBe(400);
    await expect(replay.json()).resolves.toMatchObject({ code: 'INVALID_EMAIL_VERIFICATION_TOKEN' });
  });

  it('returns unavailable instead of sending when the email provider is not configured', async () => {
    const account = await createUserWithSession('resend-route@example.test', 'Password123!', 'Resend Route');
    const response = await authPost(request({ action: 'resend_verification' }, account.session.id));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'EMAIL_VERIFICATION_UNAVAILABLE' });
    expect(await getDatabase().query('SELECT id FROM email_verification_tokens WHERE user_id = ?', [account.user.id])).toHaveLength(0);
  });

  it('rejects malformed verification tokens before database lookup', async () => {
    const response = await authPost(request({ action: 'verify_email', token: 'not-a-token' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_REQUEST_PAYLOAD' });
  });
});
