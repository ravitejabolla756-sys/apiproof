import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getNotificationPreferences, updateNotificationPreferences } from '../apps/web/src/lib/server/notification-preferences-service.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-notification-preferences-${process.pid}.db`);

describe('notification preferences', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'notification-preferences-test-secret-32-chars';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('returns complete server-owned defaults with required security controls', async () => {
    const account = await createUserWithSession('notifications@example.test', 'NotifyPassword123!', 'Notify User');
    const preferences = await getNotificationPreferences(account.user.id);
    expect(preferences).toHaveLength(12);
    expect(preferences.find((item) => item.category === 'security' && item.channel === 'email')).toMatchObject({ enabled: true, required: true });
    expect(preferences.find((item) => item.category === 'findings' && item.channel === 'email')).toMatchObject({ enabled: false, deliveryAvailable: false });
  });

  it('persists optional changes and rejects disabling required categories', async () => {
    const account = await createUserWithSession('notifications@example.test', 'NotifyPassword123!', 'Notify User');
    const updated = await updateNotificationPreferences(account.user.id, [
      { category: 'findings', channel: 'slack', enabled: false },
      { category: 'weekly_digest', channel: 'slack', enabled: true },
    ]);
    expect(updated.find((item) => item.category === 'findings' && item.channel === 'slack')?.enabled).toBe(false);
    expect(updated.find((item) => item.category === 'weekly_digest' && item.channel === 'slack')?.enabled).toBe(true);
    await expect(updateNotificationPreferences(account.user.id, [{ category: 'security', channel: 'email', enabled: false }]))
      .rejects.toThrow('cannot be disabled');
  });

  it('does not allow cross-category or cross-channel values', async () => {
    const account = await createUserWithSession('notifications@example.test', 'NotifyPassword123!', 'Notify User');
    await expect(updateNotificationPreferences(account.user.id, [{ category: 'unknown' as 'findings', channel: 'email', enabled: true }]))
      .rejects.toThrow('Invalid notification preference');
  });
});
