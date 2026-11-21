import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../apps/web/src/app/api/provider-rules/seed/route.js';
import { AUTH_COOKIE_NAME, createUserWithSession as createUserWithSessionBase } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';

const TEST_DB_PATH = path.resolve('.tmp/test-provider-review-queue-route.db');

describe('provider review queue bootstrap route', () => {
  async function createUserWithSession(email: string, password: string, name: string) {
    const result = await createUserWithSessionBase(email, password, name);
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), result.user.id]);
    return result;
  }

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('requires an authenticated owner and rejects cross-site mutations', async () => {
    const unauthenticated = await POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    }));
    expect(unauthenticated.status).toBe(403);
    expect(await unauthenticated.json()).toMatchObject({ code: 'CSRF_REJECTED' });

    const authenticated = await POST(new Request('https://myowl.example/api/provider-rules/seed', { method: 'POST' }));
    expect(authenticated.status).toBe(401);
    expect(await authenticated.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('seeds the official queue through the owner session and is idempotent', async () => {
    const { session } = await createUserWithSession('queue-owner@example.com', 'Pass1234!', 'Queue Owner');
    const request = () => POST(new Request('https://myowl.example/api/provider-rules/seed', {
      method: 'POST',
      headers: { cookie: `${AUTH_COOKIE_NAME}=${session.id}` },
    }));

    const first = await request();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, candidates: 50, safety: expect.stringContaining('needs_review') });

    const second = await request();
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, candidates: 0, skippedExisting: 50 });
  });
});
