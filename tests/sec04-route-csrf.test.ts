import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { POST as checkoutPost } from '../apps/web/src/app/api/billing/checkout/route.js';
import { POST as portalPost } from '../apps/web/src/app/api/billing/portal/route.js';
import { GET as installGet } from '../apps/web/src/app/api/github/install/route.js';
import { DELETE as repositoryDelete } from '../apps/web/src/app/api/repositories/[id]/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const dbPath = path.resolve('.tmp/sec04-route-csrf.db');

function crossSiteHeaders(sessionId: string): Record<string, string> {
  return {
    cookie: `apiproof_session=${sessionId}`,
    origin: 'https://evil.example',
    host: 'apiproof.test',
    'content-type': 'application/json',
  };
}

describe('SEC-04 state-changing route CSRF boundary', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = dbPath;
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    initDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('rejects cross-site checkout and portal requests before billing work', async () => {
    const account = await createUserWithSession('sec04-billing@example.test', 'Strong-password-1!', 'Billing User');
    const headers = crossSiteHeaders(account.session.id);
    const checkout = await checkoutPost(new Request('https://apiproof.test/api/billing/checkout', { method: 'POST', headers, body: JSON.stringify({ planId: 'pro' }) }));
    const portal = await portalPost(new Request('https://apiproof.test/api/billing/portal', { method: 'POST', headers }));

    expect(checkout.status).toBe(403);
    expect(await checkout.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    expect(portal.status).toBe(403);
    expect(await portal.json()).toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('rejects cross-site repository deletion without deleting the workspace record', async () => {
    const account = await createUserWithSession('sec04-repository@example.test', 'Strong-password-1!', 'Repository User');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    const repositoryId = 'sec04-repository';
    await getDatabase().execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
      VALUES (?, ?, ?, 'owner', 'repo', 'owner/repo', 'sec04-github-id', 'main', 'connected', 'connected', 'active', ?)
    `, [repositoryId, workspace.id, account.user.id, new Date().toISOString()]);

    const response = await repositoryDelete(
      new Request(`https://apiproof.test/api/repositories/${repositoryId}`, { method: 'DELETE', headers: crossSiteHeaders(account.session.id) }),
      { params: Promise.resolve({ id: repositoryId }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    await expect(getDatabase().queryOne('SELECT id FROM repositories WHERE id = ?', [repositoryId])).resolves.toMatchObject({ id: repositoryId });
  });

  it('rejects cross-site GitHub installation initiation before state creation', async () => {
    const account = await createUserWithSession('sec04-github@example.test', 'Strong-password-1!', 'GitHub User');
    const response = await installGet(new Request('https://apiproof.test/api/github/install', { headers: crossSiteHeaders(account.session.id) }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    await expect(getDatabase().queryOne('SELECT state FROM github_installation_states WHERE user_id = ?', [account.user.id])).resolves.toBeUndefined();
  });
});
