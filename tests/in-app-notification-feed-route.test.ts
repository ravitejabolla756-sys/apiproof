import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { GET as feedRoute } from '../apps/web/src/app/api/account/notifications/feed/route.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-in-app-notification-feed-${process.pid}.db`);

describe('authenticated in-app notification feed boundary', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'in-app-notification-feed-test-secret-at-least-32-characters';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('rejects unauthenticated feed access without exposing a projection', async () => {
    const response = await feedRoute(new Request('https://apiproof.test/api/account/notifications/feed'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('returns the authenticated schema-unavailable contract without fabricated events', async () => {
    const { session } = await createUserWithSession('notifications-feed@example.test', 'OriginalPassword123!', 'Notifications Feed');
    const response = await feedRoute(new Request('https://apiproof.test/api/account/notifications/feed', { headers: { cookie: `apiproof_session=${session.id}` } }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ notifications: [], status: 'unavailable', code: 'IN_APP_NOTIFICATIONS_SCHEMA_PENDING' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
