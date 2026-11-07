import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import {
  emailDeliveryErrorCategory,
  emailDeliveryRetryDelayMs,
  getEmailDelivery,
  requeueRetryableEmailDeliveries,
  sendTrackedEmail,
} from '../apps/web/src/lib/server/email-delivery-state.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-email-delivery-state-${process.pid}.db`);

describe('tracked email delivery', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_LOCAL_SEED_PASSWORD = 'local-test-seed-password';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('records a delivered outcome without persisting message bodies or tokens', async () => {
    const account = await createUserWithSession('tracked@example.test', 'OriginalPassword123!', 'Tracked User');
    await expect(sendTrackedEmail({
      eventKey: 'account:tracked:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id,
    }, vi.fn(async () => undefined))).resolves.toMatchObject({ status: 'delivered', attempt_count: 1 });

    const row = await getEmailDelivery('account:tracked:1');
    expect(row).toMatchObject({ template_key: 'account.password_reset', template_version: 'v1', recipient_user_id: account.user.id, status: 'delivered' });
    expect(await getDatabase().query<{ name: string }>('PRAGMA table_info(email_deliveries)')).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'html' }),
      expect.objectContaining({ name: 'text' }),
      expect.objectContaining({ name: 'token' }),
    ]));
    await expect(sendTrackedEmail({
      eventKey: 'account:tracked:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id,
    }, vi.fn(async () => { throw new Error('must not resend'); }))).resolves.toMatchObject({ status: 'delivered', attempt_count: 1 });
  });

  it('records a redacted failure with bounded retry timing and requeues it', async () => {
    const account = await createUserWithSession('failed@example.test', 'OriginalPassword123!', 'Failed User');
    const providerError = Object.assign(new Error('smtp secret must never be stored'), { code: 'SMTP_TEMPORARY_FAILURE' });
    await expect(sendTrackedEmail({
      eventKey: 'account:failed:1', templateKey: 'account.password_reset', templateVersion: 'v1', recipientUserId: account.user.id,
    }, async () => { throw providerError; })).rejects.toBe(providerError);

    const row = await getEmailDelivery('account:failed:1');
    expect(row?.status).toBe('failed');
    expect(row?.error_category).toBe('SMTP_TEMPORARY_FAILURE');
    expect(row?.error_category).not.toContain('secret');
    expect(Date.parse(row!.next_attempt_at!)).toBeGreaterThan(Date.now());
    expect(emailDeliveryRetryDelayMs(1)).toBe(1_000);
    expect(emailDeliveryRetryDelayMs(99)).toBe(60 * 60 * 1_000);
    await getDatabase().execute(`INSERT INTO email_deliveries
      (id, event_key, template_key, template_version, recipient_user_id, status, attempt_count, lease_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'processing', 1, ?, ?, ?)`, [
      'eml_stale_claim', 'account:stale:1', 'account.password_reset', 'v1', account.user.id,
      '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z',
    ]);
    await expect(requeueRetryableEmailDeliveries('2026-11-07T00:00:00.000Z')).resolves.toBe(0);
    expect(await getEmailDelivery('account:stale:1')).toMatchObject({ status: 'failed', error_category: 'EMAIL_DELIVERY_UNCERTAIN' });
    await getDatabase().execute("UPDATE email_deliveries SET next_attempt_at = '2000-01-01T00:00:00.000Z' WHERE event_key = ?", ['account:failed:1']);
    await expect(requeueRetryableEmailDeliveries('2026-11-07T00:00:00.000Z')).resolves.toBe(1);
    expect((await getEmailDelivery('account:failed:1'))?.status).toBe('pending');
  });

  it('falls back to a stable category when provider errors expose no safe code', () => {
    expect(emailDeliveryErrorCategory(new Error('secret smtp response'))).toBe('EMAIL_PROVIDER_FAILED');
  });
});
