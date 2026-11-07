import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GET } from '../apps/web/src/app/api/overview/route.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';

const DB_PATH = path.resolve('.tmp/overview-role-route.db');

describe('GET /api/overview workspace authorization', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'overview-role-test-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('returns a generic denial before dashboard data is loaded for an unknown persisted role', async () => {
    const account = await createUserWithSession('overview-unknown-role@example.test', 'Strong-password-1!', 'Unknown Role');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, account.user.id],
    );

    const response = await GET(new Request('http://localhost/api/overview', {
      headers: { cookie: `apiproof_session=${account.session.id}` },
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Workspace access denied.', code: 'FORBIDDEN' });
  });
});
