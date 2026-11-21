import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET, PATCH } from '../apps/web/src/app/api/account/notifications/route.js';
import { createUserWithSession as createUserWithSessionBase } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-notification-route-${process.pid}.db`);

describe('notification preference route safety', () => {
  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'notification-route-test-secret-32-chars';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('rejects unauthenticated reads without revealing preference state', async () => {
    const response = await GET(new Request('https://apiproof.test/api/account/notifications'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });

  it('fails closed when migration 025 is not installed', async () => {
    const account = await createUserWithSessionBase('notifications-route@example.test', 'NotifyPassword123!', 'Notify Route');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), account.user.id]);
    const headers = { cookie: `apiproof_session=${account.session.id}` };
    const read = await GET(new Request('https://apiproof.test/api/account/notifications', { headers }));
    expect(read.status).toBe(503);
    await expect(read.json()).resolves.toMatchObject({ code: 'NOTIFICATION_PREFERENCES_UNAVAILABLE' });

    const write = await PATCH(new Request('https://apiproof.test/api/account/notifications', {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json', origin: 'https://apiproof.test', host: 'apiproof.test' },
      body: JSON.stringify({ updates: [{ category: 'findings', channel: 'slack', enabled: false }] }),
    }));
    expect(write.status).toBe(503);
    await expect(write.json()).resolves.toMatchObject({ code: 'NOTIFICATION_PREFERENCES_UNAVAILABLE' });
  });

  it('rejects state changes before reaching the unavailable schema boundary when CSRF is missing', async () => {
    const account = await createUserWithSessionBase('notifications-csrf@example.test', 'NotifyPassword123!', 'Notify CSRF');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), account.user.id]);
    const response = await PATCH(new Request('https://apiproof.test/api/account/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: `apiproof_session=${account.session.id}`, 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ updates: [] }),
    }));
    expect(response.status).toBe(403);
  });
});
