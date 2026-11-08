import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET } from '../apps/web/src/app/api/github/repositories/status/route.js';
import { GET as getGitHubInstallUrl } from '../apps/web/src/app/api/github/install/route.js';
import { GET as getGitHubRepositories } from '../apps/web/src/app/api/github/repositories/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { resetRateLimits } from '../apps/web/src/lib/server/rate-limit.js';

const DB_PATH = path.resolve('.tmp/github-repository-status-route.db');

describe('GET /api/github/repositories/status', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'repository-status-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    resetRateLimits();
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
    expect(foreignResponse.status).toBe(403);
  });

  it('fails closed for an unknown persisted default-workspace role', async () => {
    const { user, session } = await createUserWithSession('unknown-role@example.com', 'Strong-password-1!', 'Unknown Role');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, user.id],
    );

    const response = await GET(new Request('http://localhost/api/github/repositories/status', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Workspace access denied.' });
  });

  it('denies GitHub installation and repository access for an unknown default-workspace role', async () => {
    const { user, session } = await createUserWithSession('github-unknown-role@example.com', 'Strong-password-1!', 'Unknown Role');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, user.id],
    );
    const request = () => new Request('http://localhost/api/github/repositories', {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const installResponse = await getGitHubInstallUrl(new Request('http://localhost/api/github/install', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    const repositoriesResponse = await getGitHubRepositories(request());

    expect(installResponse.status).toBe(403);
    expect(await installResponse.json()).toEqual({ error: 'Workspace access denied.', code: 'FORBIDDEN' });
    expect(repositoriesResponse.status).toBe(403);
    expect(repositoriesResponse.headers.get('cache-control')).toContain('no-store');
    expect(await repositoriesResponse.json()).toEqual({ error: 'Workspace access denied.', code: 'FORBIDDEN' });
  });

  it('bounds GitHub installation-state creation per user without contacting GitHub', async () => {
    const { user, session } = await createUserWithSession('github-install-limit@example.com', 'Strong-password-1!', 'Install Limit');
    const request = () => getGitHubInstallUrl(new Request('http://localhost/api/github/install', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));

    const firstTen = await Promise.all(Array.from({ length: 10 }, request));
    expect(firstTen.every((response) => response.status === 200)).toBe(true);
    expect(firstTen[0]?.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    const denied = await request();
    expect(denied.status).toBe(429);
    expect(denied.headers.get('retry-after')).toBeTruthy();

    const states = await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM github_installation_states WHERE user_id = ?',
      [user.id],
    );
    expect(Number(states?.count)).toBe(10);
  });

  it('returns a generic non-cacheable error and creates no state when install signing configuration is invalid', async () => {
    const { user, session } = await createUserWithSession('github-install-config@example.com', 'Strong-password-1!', 'Install Config');
    const originalSecret = process.env.APIPROOF_SECRET;
    const originalAuthSecret = process.env.AUTH_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.APIPROOF_SECRET;
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      const response = await getGitHubInstallUrl(new Request('http://localhost/api/github/install', {
        headers: { cookie: `apiproof_session=${session.id}` },
      }));

      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
      expect(await response.json()).toEqual({
        error: 'GitHub installation could not be started.',
        code: 'INTERNAL_ERROR',
      });
      const states = await getDatabase().queryOne<{ count: number }>(
        'SELECT COUNT(*) AS count FROM github_installation_states WHERE user_id = ?',
        [user.id],
      );
      expect(Number(states?.count)).toBe(0);
    } finally {
      if (originalSecret === undefined) delete process.env.APIPROOF_SECRET;
      else process.env.APIPROOF_SECRET = originalSecret;
      if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = originalAuthSecret;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
