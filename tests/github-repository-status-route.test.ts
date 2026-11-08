import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET } from '../apps/web/src/app/api/github/repositories/status/route.js';
import { GET as repositoriesGet } from '../apps/web/src/app/api/github/repositories/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const DB_PATH = path.resolve('.tmp/github-repository-status-route.db');

describe('GET /api/github/repositories/status', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'repository-status-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('requires an authenticated session', async () => {
    const response = await GET(new Request('http://localhost/api/github/repositories/status'));
    expect(response.status).toBe(401);
  });

  it('returns active installation state from the authenticated workspace without querying GitHub', async () => {
    const { user, session } = await createUserWithSession('picker@example.com', 'Strong-password-1!', 'Picker User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `, ['ghi_picker', workspace.id, '9876543', 'fixture-org', 'Organization', now, now]);

    const response = await GET(new Request('http://localhost/api/github/repositories/status', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('returns disconnected for a user without an installation and denies another workspace', async () => {
    const first = await createUserWithSession('first@example.com', 'Strong-password-1!', 'First User');
    const second = await createUserWithSession('second@example.com', 'Strong-password-1!', 'Second User');
    const secondWorkspace = await getDefaultWorkspaceForUser(second.user.id);

    const ownResponse = await GET(new Request('http://localhost/api/github/repositories/status', {
      headers: { cookie: `apiproof_session=${first.session.id}` },
    }));
    expect(ownResponse.status).toBe(200);
    expect(await ownResponse.json()).toEqual({ connected: false });

    const foreignResponse = await GET(new Request(
      `http://localhost/api/github/repositories/status?workspaceId=${secondWorkspace.id}`,
      { headers: { cookie: `apiproof_session=${first.session.id}` } },
    ));
    expect(foreignResponse.status).toBe(404);
  });

  it('returns a typed error for malformed explicit workspace contexts', async () => {
    const account = await createUserWithSession('picker-context@example.com', 'Strong-password-1!', 'Picker Context');
    const response = await GET(new Request('http://localhost/api/github/repositories/status?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${account.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });

  it('repository picker returns a typed error for malformed explicit workspace contexts', async () => {
    const account = await createUserWithSession('picker-list-context@example.com', 'Strong-password-1!', 'Picker List Context');
    const response = await repositoriesGet(new Request('http://localhost/api/github/repositories?workspaceId=not%20safe', {
      headers: { cookie: `apiproof_session=${account.session.id}` },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_WORKSPACE_ID' });
  });
});
