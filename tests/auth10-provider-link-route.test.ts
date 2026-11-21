import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { GET as githubInstallGet } from '../apps/web/src/app/api/github/install/route.js';
import * as verifiedUserPolicy from '../apps/web/src/lib/server/verified-user-policy.js';

const DB_PATH = path.resolve('.tmp/test-auth10-provider-link-route.db');

function request(sessionId: string): NextRequest {
  return new NextRequest('http://localhost/api/github/install', {
    headers: {
      cookie: `apiproof_session=${sessionId}`,
      origin: 'http://localhost',
      host: 'localhost',
    },
  });
}

describe('AUTH-10 provider-link route enforcement', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_SECRET = 'auth10-route-test-secret-minimum-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.APIPROOF_SKIP_DEFAULT_SEED = 'true';
    process.env.GITHUB_APP_SLUG = 'apiproof';
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    delete process.env.APIPROOF_DB_PATH;
    delete process.env.APIPROOF_SKIP_DEFAULT_SEED;
    delete process.env.APIPROOF_SECRET;
    delete process.env.GITHUB_APP_SLUG;
  });

  it('fails closed when verification schema is unavailable', async () => {
    vi.spyOn(verifiedUserPolicy, 'loadVerifiedUserPolicy').mockResolvedValue({
      action: 'provider_link',
      verificationStateAvailable: false,
    });
    const { session } = await createUserWithSession('route-unavailable@example.test', 'Pass12345!', 'Route Unavailable');
    const response = await githubInstallGet(request(session.id));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'VERIFICATION_STATE_UNAVAILABLE' });
  });

  it('rejects provider linking for a server-known unverified user', async () => {
    const { session } = await createUserWithSession('route-unverified@example.test', 'Pass12345!', 'Route Unverified');
    const response = await githubInstallGet(request(session.id));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
  });

  it('allows provider linking only after server-side verification', async () => {
    const { user, session } = await createUserWithSession('route-verified@example.test', 'Pass12345!', 'Route Verified');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    const response = await githubInstallGet(request(session.id));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ url: expect.stringContaining('https://github.com/apps/apiproof/') });
  });
});
