import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET, POST } from '../apps/web/src/app/api/repositories/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser, requireRepositoryAccess } from '../apps/web/src/lib/server/workspace-service.js';

const DB_PATH = path.resolve('.tmp/repositories-list-route.db');

describe('GET /api/repositories', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'repositories-list-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('rejects unauthenticated requests without cacheable workspace data', async () => {
    const response = await GET(new Request('http://localhost/api/repositories'));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('fails closed with a generic denial for an unknown persisted workspace role', async () => {
    const user = await createUserWithSession('unknown-role@example.test', 'Strong-password-1!', 'Unknown Role');
    const workspace = await getDefaultWorkspaceForUser(user.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, user.user.id],
    );

    const response = await GET(new Request('http://localhost/api/repositories', {
      headers: { cookie: `apiproof_session=${user.session.id}` },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Workspace access denied.', code: 'FORBIDDEN' });
  });

  it('returns only the authenticated user default workspace repositories and no global GitHub metadata', async () => {
    const ownerA = await createUserWithSession('workspace-a@example.test', 'Strong-password-1!', 'Workspace A');
    const ownerB = await createUserWithSession('workspace-b@example.test', 'Strong-password-1!', 'Workspace B');
    const workspaceA = await getDefaultWorkspaceForUser(ownerA.user.id);
    const workspaceB = await getDefaultWorkspaceForUser(ownerB.user.id);
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `, ['installation_a', workspaceA.id, '10001', 'workspace-a-org', 'Organization', now, now]);
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `, ['installation_b', workspaceB.id, '20002', 'workspace-b-org', 'Organization', now, now]);

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)
    `, ['repo_a', workspaceA.id, ownerA.user.id, 'workspace-a-org', 'private-a', 'workspace-a-org/private-a', '101', 'main', now]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'connected', 'active', ?)
    `, ['repo_b', workspaceB.id, ownerB.user.id, 'workspace-b-org', 'private-b', 'workspace-b-org/private-b', '202', 'trunk', now]);

    const response = await GET(new Request('http://localhost/api/repositories', {
      headers: { cookie: `apiproof_session=${ownerA.session.id}` },
    }));
    const body = await response.json() as {
      repositories: Array<{ id: string; full_name: string; github_repository_id: string }>;
      githubAppConnection?: unknown;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body.repositories).toHaveLength(1);
    expect(body.repositories[0]).toMatchObject({
      id: 'repo_a',
      full_name: 'workspace-a-org/private-a',
      github_repository_id: '101',
    });
    expect(JSON.stringify(body)).not.toContain('workspace-b-org');
    expect(JSON.stringify(body)).not.toContain('private-b');
    expect(JSON.stringify(body)).not.toContain('20002');
    expect(body).not.toHaveProperty('githubAppConnection');

    const { GET: getRepository, DELETE: deleteRepository } = await import('../apps/web/src/app/api/repositories/[id]/route.js');
    const foreignRepositoryResponse = await getRepository(
      new Request('http://localhost/api/repositories/repo_b', {
        headers: { cookie: `apiproof_session=${ownerA.session.id}` },
      }),
      { params: Promise.resolve({ id: 'repo_b' }) },
    );
    expect(foreignRepositoryResponse.status).toBe(404);

    const foreignRepositoryDelete = await deleteRepository(
      new Request('http://localhost/api/repositories/repo_b', {
        method: 'DELETE',
        headers: { cookie: `apiproof_session=${ownerA.session.id}` },
      }),
      { params: Promise.resolve({ id: 'repo_b' }) },
    );
    expect(foreignRepositoryDelete.status).toBe(404);
    const foreignRepository = await db.queryOne<{ id: string }>(
      'SELECT id FROM repositories WHERE id = ? AND workspace_id = ?',
      ['repo_b', workspaceB.id],
    );
    expect(foreignRepository?.id).toBe('repo_b');
  });

  it('rejects the legacy owner/name connection payload without creating a synthetic repository', async () => {
    const owner = await createUserWithSession('legacy-path@example.test', 'Strong-password-1!', 'Legacy Path');
    const before = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) as count FROM repositories');

    const response = await POST(new Request('http://localhost/api/repositories', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `apiproof_session=${owner.session.id}` },
      body: JSON.stringify({ owner: 'synthetic-org', name: 'synthetic-repo', defaultBranch: 'main' }),
    }));

    expect(response.status).toBe(400);
    expect((await response.json() as { code?: string }).code).toBe('AUTHORITATIVE_REPOSITORY_ID_REQUIRED');
    const after = await getDatabase().queryOne<{ count: number }>('SELECT COUNT(*) as count FROM repositories');
    expect(after?.count).toBe(before?.count ?? 0);
  });

  it('denies repository creation in a workspace where the authenticated user is not a member', async () => {
    const actor = await createUserWithSession('repo-actor@example.test', 'Strong-password-1!', 'Repository Actor');
    const otherUser = await createUserWithSession('repo-other@example.test', 'Strong-password-1!', 'Other Workspace');
    const foreignWorkspace = await getDefaultWorkspaceForUser(otherUser.user.id);

    const response = await POST(new Request('http://localhost/api/repositories', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${actor.session.id}`,
      },
      body: JSON.stringify({ githubRepositoryId: '12345', workspaceId: foreignWorkspace.id }),
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Workspace access denied.', code: 'FORBIDDEN' });
    const repositoryCount = await getDatabase().queryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM repositories WHERE workspace_id = ?',
      [foreignWorkspace.id],
    );
    expect(Number(repositoryCount?.count)).toBe(0);
  });

  it('does not promote an unscoped legacy repository into production workspace access', async () => {
    const owner = await createUserWithSession('legacy-access@example.test', 'Strong-password-1!', 'Legacy Access');
    await getDatabase().execute(`
      INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('legacy_unscoped', ?, 'old-org', 'old-repo', 'old-org/old-repo', 'old-1', 'main', 'connected', ?)
    `, [owner.user.id, new Date().toISOString()]);
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(requireRepositoryAccess('legacy_unscoped', owner.user.id)).rejects.toThrow('Legacy repository identity');
      const row = await getDatabase().queryOne<{ workspace_id: string | null }>('SELECT workspace_id FROM repositories WHERE id = ?', ['legacy_unscoped']);
      expect(row?.workspace_id).toBeNull();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
