import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as connectRepository } from '../apps/web/src/app/api/repositories/route.js';
import * as githubService from '../apps/web/src/lib/server/github.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const DB_PATH = path.resolve('.tmp/repository-connect-error-safety.db');

describe('repository connection API error safety', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_SECRET = 'repository-connect-error-safety-secret-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('hides unexpected persistence errors while retaining the stable internal error code', async () => {
    const account = await createUserWithSession('repository-connect-error@example.test', 'StrongPassword123!', 'Repository Connect Error');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    const now = new Date().toISOString();
    await getDatabase().execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `, ['installation_error_test', workspace.id, '123456', 'fixture-org', 'Organization', now, now]);
    vi.spyOn(githubService, 'fetchWorkspaceRepository').mockResolvedValue({
      id: '987654', name: 'fixture-repo', fullName: 'fixture-org/fixture-repo', owner: 'fixture-org', private: true, defaultBranch: 'main',
    });
    const secretMarker = 'AWS_SECRET_ACCESS_KEY:REPOSITORY_CONNECT_SECRET';
    vi.spyOn(getDatabase(), 'transaction').mockRejectedValue(new Error(secretMarker));

    const response = await connectRepository(new Request('https://apiproof.test/api/repositories', {
      method: 'POST',
      headers: { cookie: `apiproof_session=${account.session.id}`, 'content-type': 'application/json' },
      body: JSON.stringify({ githubRepositoryId: '987654' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to connect repository.', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain(secretMarker);
  });
});
