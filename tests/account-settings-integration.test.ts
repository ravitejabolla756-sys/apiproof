import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createSession, createUserWithSession, verifyPassword } from '../apps/web/src/lib/server/auth.js';
import { GET as accountGet, PATCH as accountPatch } from '../apps/web/src/app/api/account/route.js';
import { POST as passwordPost } from '../apps/web/src/app/api/account/password/route.js';

const dbPath = path.resolve('.tmp/account-settings-integration.db');
const request = (url: string, sessionId?: string, init: RequestInit = {}) => new Request(url, {
  ...init,
  headers: new Headers({ origin: 'https://apiproof.test', host: 'apiproof.test', ...(sessionId ? { cookie: `apiproof_session=${sessionId}` } : {}), ...(init.headers ?? {}) }),
});

describe('account settings integration', () => {
  beforeEach(async () => { process.env.NODE_ENV = 'test'; process.env.APIPROOF_DB_PATH = dbPath; process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true'; if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); initDatabase(dbPath); });
  afterEach(async () => { await closeDatabase(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); delete process.env.APIPROOF_DB_PATH; delete process.env.APIPROOF_SKIP_DEFAULT_SEED; });

  it('requires authentication and updates only the authenticated profile', async () => {
    expect((await accountGet(request('https://apiproof.test/api/account'))).status).toBe(401);
    const first = await createUserWithSession('first@example.test', 'OriginalPassword123!', 'First User');
    const second = await createUserWithSession('second@example.test', 'OriginalPassword123!', 'Second User');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), first.user.id]);
    expect((await accountGet(request('https://apiproof.test/api/account', first.session.id))).status).toBe(200);
    const response = await accountPatch(request('https://apiproof.test/api/account', first.session.id, { method: 'PATCH', body: JSON.stringify({ name: 'Updated First' }) }));
    expect(response.status).toBe(200);
    expect(await getDatabase().queryOne('SELECT name FROM users WHERE id = ?', [second.user.id])).toMatchObject({ name: 'Second User' });
  });

  it('enforces CSRF on profile mutation', async () => {
    const account = await createUserWithSession('csrf@example.test', 'OriginalPassword123!', 'CSRF User');
    const response = await accountPatch(new Request('https://apiproof.test/api/account', { method: 'PATCH', headers: { origin: 'https://attacker.example', host: 'apiproof.test', cookie: `apiproof_session=${account.session.id}` }, body: JSON.stringify({ name: 'Attacker' }) }));
    expect(response.status).toBe(403);
    expect((await response.json() as { code: string }).code).toBe('CSRF_REJECTED');
  });

  it('changes the password while preserving the current session only', async () => {
    const account = await createUserWithSession('password@example.test', 'OriginalPassword123!', 'Password User');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), account.user.id]);
    const secondSession = await createSession(account.user.id);
    const response = await passwordPost(request('https://apiproof.test/api/account/password', account.session.id, { method: 'POST', body: JSON.stringify({ currentPassword: 'OriginalPassword123!', newPassword: 'NewSecurePassword123!' }) }));
    expect(response.status).toBe(200);
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE id = ?', [account.session.id])).toBeTruthy();
    expect(await getDatabase().queryOne('SELECT id FROM sessions WHERE id = ?', [secondSession.id])).toBeUndefined();
    const row = await getDatabase().queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [account.user.id]);
    expect(row && verifyPassword('NewSecurePassword123!', row.password_hash)).toBe(true);
  });

  it('rejects unverified account mutations using server state', async () => {
    const account = await createUserWithSession('unverified-account@example.test', 'OriginalPassword123!', 'Unverified User');
    const response = await accountPatch(request('https://apiproof.test/api/account', account.session.id, { method: 'PATCH', body: JSON.stringify({ name: 'Should Not Change' }) }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
    expect(await getDatabase().queryOne('SELECT name FROM users WHERE id = ?', [account.user.id])).toMatchObject({ name: 'Unverified User' });
  });
});
