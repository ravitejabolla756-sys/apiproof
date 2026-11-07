import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession, createUserWithSession, verifyPassword } from '../apps/web/src/lib/server/auth.js';
import { GET as accountGet, PATCH as accountPatch } from '../apps/web/src/app/api/account/route.js';
import { POST as passwordPost } from '../apps/web/src/app/api/account/password/route.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-account-settings-${process.pid}.db`);

function request(url: string, sessionId: string, options: { method?: string; body?: unknown } = {}): Request {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: 'https://apiproof.test',
    host: 'apiproof.test',
    cookie: `apiproof_session=${sessionId}`,
  });
  const init: RequestInit = {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  return new Request(url, init);
}

describe('account settings', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'account-settings-test-secret-at-least-32-chars';
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(async () => {
    await closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
  });

  it('reads and updates only the authenticated account profile', async () => {
    const first = await createUserWithSession('first@example.test', 'OriginalPassword123!', 'First User');
    const second = await createUserWithSession('second@example.test', 'OriginalPassword123!', 'Second User');

    const getResponse = await accountGet(request('https://apiproof.test/api/account', first.session.id));
    expect(getResponse.status).toBe(200);
    expect((await getResponse.json() as { account: { email: string; name: string } }).account).toMatchObject({ email: 'first@example.test', name: 'First User' });

    const updateResponse = await accountPatch(request('https://apiproof.test/api/account', first.session.id, {
      method: 'PATCH',
      body: { name: 'Updated First' },
    }));
    expect(updateResponse.status).toBe(200);
    expect((await updateResponse.json() as { account: { name: string } }).account.name).toBe('Updated First');
    expect(await getDatabase().queryOne('SELECT name FROM users WHERE id = ?', [second.user.id])).toMatchObject({ name: 'Second User' });
  });

  it('changes the password, keeps the current session, and invalidates other sessions', async () => {
    const account = await createUserWithSession('owner@example.test', 'OriginalPassword123!', 'Owner');
    const secondSession = await createSession(account.user.id);

    const response = await passwordPost(request('https://apiproof.test/api/account/password', account.session.id, {
      body: { currentPassword: 'OriginalPassword123!', newPassword: 'NewSecurePassword123!' },
    }));
    expect(response.status).toBe(200);
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE id = ?', [account.session.id])).toBeTruthy();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE id = ?', [secondSession.id])).toBeUndefined();
    const row = await getDatabase().queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [account.user.id]);
    expect(row && verifyPassword('NewSecurePassword123!', row.password_hash)).toBe(true);
  });

  it('rejects a wrong current password without changing the credential', async () => {
    const account = await createUserWithSession('owner@example.test', 'OriginalPassword123!', 'Owner');
    const response = await passwordPost(request('https://apiproof.test/api/account/password', account.session.id, {
      body: { currentPassword: 'WrongPassword123!', newPassword: 'NewSecurePassword123!' },
    }));
    expect(response.status).toBe(400);
    expect((await response.json() as { code: string }).code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('does not offer password changes for an OAuth-only account', async () => {
    const account = await createUserWithSession('oauth@example.test', 'RandomInternalPassword123!', 'OAuth User');
    await getDatabase().execute(
      'INSERT INTO google_oauth_accounts (id, user_id, google_subject, google_email, google_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['goa_test', account.user.id, 'google-subject', account.user.email, account.user.name, new Date().toISOString(), new Date().toISOString()],
    );

    const getResponse = await accountGet(request('https://apiproof.test/api/account', account.session.id));
    expect((await getResponse.json() as { account: { hasLocalPassword: boolean; authProviders: string[] } }).account).toMatchObject({ hasLocalPassword: false, authProviders: ['google'] });

    const response = await passwordPost(request('https://apiproof.test/api/account/password', account.session.id, {
      body: { currentPassword: 'RandomInternalPassword123!', newPassword: 'NewSecurePassword123!' },
    }));
    expect(response.status).toBe(400);
    expect((await response.json() as { code: string }).code).toBe('OAUTH_ONLY_ACCOUNT');
  });

  it('rejects cross-site account mutations', async () => {
    const account = await createUserWithSession('csrf@example.test', 'OriginalPassword123!', 'CSRF User');
    const response = await accountPatch(new Request('https://apiproof.test/api/account', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
        host: 'apiproof.test',
        cookie: `apiproof_session=${account.session.id}`,
      },
      body: JSON.stringify({ name: 'Attacker' }),
    }));
    expect(response.status).toBe(403);
    expect((await response.json() as { code: string }).code).toBe('CSRF_REJECTED');
  });
});
