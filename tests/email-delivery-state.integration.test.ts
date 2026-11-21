import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { emailDeliveryErrorCategory, emailDeliveryRetryDelayMs, getEmailDelivery, requeueRetryableEmailDeliveries, sendTrackedEmail } from '../apps/web/src/lib/server/email-delivery-state.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-email-delivery-state-${process.pid}.db`);

describe('tracked email delivery', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const db = initDatabase(TEST_DB_PATH);
    db.exec(`CREATE TABLE email_deliveries (
      id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, template_key TEXT NOT NULL, template_version TEXT NOT NULL,
      recipient_user_id TEXT, workspace_id TEXT, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      error_category TEXT, next_attempt_at TEXT, claimed_by TEXT, lease_expires_at TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, delivered_at TEXT
    );`);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('deduplicates delivered events without storing message bodies or tokens', async () => {
    const account = await createUserWithSession('tracked@example.test', 'OriginalPassword123!', 'Tracked User');
    const send = vi.fn(async () => undefined);
    await expect(sendTrackedEmail({ eventKey: 'account:tracked:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id }, send)).resolves.toMatchObject({ status: 'delivered', attempt_count: 1 });
    await expect(sendTrackedEmail({ eventKey: 'account:tracked:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id }, send)).resolves.toMatchObject({ status: 'delivered', attempt_count: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await getDatabase().query<{ name: string }>('PRAGMA table_info(email_deliveries)')).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'html' }), expect.objectContaining({ name: 'token' })]));
  });

  it('redacts provider failures and bounds retry timing', async () => {
    const account = await createUserWithSession('failed@example.test', 'OriginalPassword123!', 'Failed User');
    const providerError = Object.assign(new Error('smtp secret must never be stored'), { code: 'SMTP_TEMPORARY_FAILURE' });
    await expect(sendTrackedEmail({ eventKey: 'account:failed:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id }, async () => { throw providerError; })).rejects.toBe(providerError);
    const row = await getEmailDelivery('account:failed:1');
    expect(row).toMatchObject({ status: 'failed', error_category: 'SMTP_TEMPORARY_FAILURE' });
    expect(row?.error_category).not.toContain('secret');
    expect(emailDeliveryRetryDelayMs(1)).toBe(1_000);
    expect(emailDeliveryRetryDelayMs(99)).toBe(60 * 60 * 1_000);
    await getDatabase().execute(`INSERT INTO email_deliveries (id, event_key, template_key, template_version, recipient_user_id, status, attempt_count, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'processing', 1, ?, ?, ?)`, ['eml_stale', 'account:stale:1', 'account.password_reset', 'v1', account.user.id, '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z']);
    await expect(requeueRetryableEmailDeliveries('2026-11-07T00:00:00.000Z')).resolves.toBe(0);
    expect(await getEmailDelivery('account:stale:1')).toMatchObject({ status: 'failed', error_category: 'EMAIL_DELIVERY_UNCERTAIN' });
  });

  it('uses a stable safe category when provider errors expose no code', () => {
    expect(emailDeliveryErrorCategory(new Error('secret smtp response'))).toBe('EMAIL_PROVIDER_FAILED');
  });

  it('does not claim an exhausted delivery and requeues only due retry records', async () => {
    const account = await createUserWithSession('exhausted@example.test', 'OriginalPassword123!', 'Exhausted User');
    const now = '2026-11-07T00:00:00.000Z';
    await getDatabase().execute(
      `INSERT INTO email_deliveries (id, event_key, template_key, template_version, recipient_user_id, status, attempt_count, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'failed', 5, ?, ?, ?)`,
      ['eml_exhausted', 'account:exhausted:1', 'account.password_reset', 'v1', account.user.id, now, now, now],
    );
    const send = vi.fn(async () => undefined);
    await expect(sendTrackedEmail({ eventKey: 'account:exhausted:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id }, send)).rejects.toThrow('EMAIL_DELIVERY_NOT_CLAIMED');
    expect(send).not.toHaveBeenCalled();
    await expect(requeueRetryableEmailDeliveries(now)).resolves.toBe(0);
    expect(await getEmailDelivery('account:exhausted:1')).toMatchObject({ status: 'failed', attempt_count: 5 });
  });

  it('fails closed when the approved email ledger migration is unavailable', async () => {
    const account = await createUserWithSession('unavailable@example.test', 'OriginalPassword123!', 'Unavailable User');
    await getDatabase().execute('DROP TABLE email_deliveries');
    await expect(sendTrackedEmail({ eventKey: 'account:unavailable:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id }, async () => undefined)).rejects.toMatchObject({ code: 'EMAIL_DELIVERY_UNAVAILABLE' });
  });
});
