import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { emailVerificationMigrations } from '../apps/web/src/lib/server/db/email-verification-migration.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { requestTrackedEmailVerification } from '../apps/web/src/lib/server/email-verification-notification.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-email-verification-notification-${process.pid}.db`);
const environmentKeys = ['NODE_ENV', 'APIPROOF_DB_PATH', 'APIPROOF_LOCAL_SEED_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM', 'APIPROOF_APP_URL'];
const savedEnvironment = new Map<string, string | undefined>();

async function installEmailLedger() {
  await getDatabase().execute(`
    CREATE TABLE email_deliveries (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      template_key TEXT NOT NULL,
      template_version TEXT NOT NULL,
      recipient_user_id TEXT,
      workspace_id TEXT,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_category TEXT,
      next_attempt_at TEXT,
      claimed_by TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      delivered_at TEXT
    )
  `);
  await getDatabase().execute('CREATE UNIQUE INDEX email_deliveries_event_key ON email_deliveries(event_key)');
}

describe('email verification notification integration', () => {
  beforeEach(async () => {
    for (const key of environmentKeys) {
      savedEnvironment.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_LOCAL_SEED_PASSWORD = 'Not02FixtureSeedPassword123!';
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'mailer@example.test';
    process.env.SMTP_PASSWORD = 'test-only-secret';
    process.env.EMAIL_FROM = 'MY OWL <no-reply@example.test>';
    process.env.APIPROOF_APP_URL = 'https://apiproof.test';
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

  it('records a delivered verification notification without persisting the token', async () => {
    await installEmailLedger();
    const account = await createUserWithSession('not02@example.test', 'OriginalPassword123!', 'Notification Owner');
    const messages: string[] = [];

    await expect(requestTrackedEmailVerification(account.user.id, async (message) => {
      messages.push(message.text);
    })).resolves.toBe('sent');

    const delivery = await getDatabase().queryOne<Record<string, string>>('SELECT * FROM email_deliveries');
    expect(delivery).toMatchObject({
      template_key: 'auth.email_verification',
      template_version: 'v1',
      recipient_user_id: account.user.id,
      status: 'delivered',
    });
    expect(delivery?.event_key).not.toContain(messages[0]);
    expect(messages[0]).toContain('Verify your MY OWL email address');
    expect(delivery?.event_key).not.toContain('OriginalPassword123!');
  });

  it('fails closed and removes the token reservation when the delivery ledger is unavailable', async () => {
    const account = await createUserWithSession('not02-unavailable@example.test', 'OriginalPassword123!', 'Unavailable Owner');

    await expect(requestTrackedEmailVerification(account.user.id, async () => undefined))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    expect(await getDatabase().query('SELECT id FROM email_verification_tokens WHERE user_id = ?', [account.user.id])).toHaveLength(0);
  });
});
