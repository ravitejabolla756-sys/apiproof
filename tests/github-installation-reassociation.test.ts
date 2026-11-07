import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import {
  getDefaultWorkspaceForUser,
  createWorkspaceForUser,
  getWorkspaceGitHubInstallation,
} from '../apps/web/src/lib/server/workspace-service.js';
import { createGitHubInstallationState } from '../apps/web/src/lib/server/github.js';
import * as githubModule from '../apps/web/src/lib/server/github.js';
import { GET as callbackGet } from '../apps/web/src/app/api/github/callback/route.js';

interface CallbackSuccessData {
  success?: boolean;
  workspaceId?: string;
  installationId?: string;
  accountLogin?: string;
  accountType?: string;
  code?: string;
  error?: string;
}

interface CallbackErrorData {
  error?: string;
  code?: string;
}

const TEST_DB_PATH = path.resolve('.tmp/test-github-reassociation.db');

// Test RSA key pair
const { privateKey: TEST_PRIVATE_KEY_PEM } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const TEST_APP_ID = '4888527';
const TEST_INSTALLATION_ID = '160401452';

describe('GitHub Installation Reassociation Hardening', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'reassoc-test-secret-at-least-32-chars!';
    process.env.GITHUB_APP_ID = TEST_APP_ID;
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY_PEM;
    process.env.GITHUB_APP_SLUG = 'apiproof';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);

    // Mock verifyGitHubAppInstallation to return authoritative metadata
    vi.spyOn(githubModule, 'verifyGitHubAppInstallation').mockImplementation(async (instId) => {
      return {
        id: String(instId),
        appId: String(TEST_APP_ID),
        accountLogin: 'ravitejabolla756-sys',
        accountType: 'User',
      };
    });
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    vi.restoreAllMocks();
  });

  // TEST A: Same-workspace reconnect succeeds
  it('TEST A: Same-workspace reconnect succeeds', async () => {
    const { user, session } = await createUserWithSession('alice@example.com', 'Pass12345!', 'Alice');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const db = getDatabase();
    const now = new Date().toISOString();
    // Existing record in Workspace A with outdated account login
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_orig_a', ?, ?, 'old-login', 'User', 'active', ?, ?)
    `, [ws.id, TEST_INSTALLATION_ID, now, now]);

    const state = await createGitHubInstallationState(user.id, ws.id);

    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&setup_action=update&state=${state}`, {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as CallbackSuccessData;
    expect(data.success).toBe(true);
    expect(data.workspaceId).toBe(ws.id);
    expect(data.installationId).toBe(TEST_INSTALLATION_ID);

    // Verify record in DB is updated, not duplicated
    const record = await getWorkspaceGitHubInstallation(ws.id);
    expect(record).not.toBeNull();
    expect(record?.id).toBe('ghi_orig_a');
    expect(record?.accountLogin).toBe('ravitejabolla756-sys');
    expect(record?.status).toBe('active');

    const allRows = await db.query<{ id: string }>(`
      SELECT id FROM github_installations WHERE installation_id = ?
    `, [TEST_INSTALLATION_ID]);
    expect(allRows.length).toBe(1);
  });

  it('denies a callback for an unknown persisted workspace role before provider access', async () => {
    const { user, session } = await createUserWithSession('unknown-role@example.com', 'Pass12345!', 'Unknown Role');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const state = await createGitHubInstallationState(user.id, ws.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['owner-like', ws.id, user.id],
    );

    const response = await callbackGet(new Request(
      `http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`,
      { headers: { cookie: `apiproof_session=${session.id}` } },
    ));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(githubModule.verifyGitHubAppInstallation).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne(
      'SELECT id FROM github_installations WHERE installation_id = ?', [TEST_INSTALLATION_ID],
    )).toBeUndefined();
    expect(await getDatabase().queryOne<{ consumed_at: string | null }>(
      'SELECT consumed_at FROM github_installation_states WHERE state = ?', [state],
    )).toMatchObject({ consumed_at: null });
  });

  it('redirects HTML OAuth completion with a no-store response for cross-tab refresh', async () => {
    const { user, session } = await createUserWithSession('html-callback@example.com', 'Pass12345!', 'HTML Callback');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const state = await createGitHubInstallationState(user.id, ws.id);

    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: {
        accept: 'text/html',
        cookie: `apiproof_session=${session.id}`,
      },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard/settings?github=connected');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await getWorkspaceGitHubInstallation(ws.id)).not.toBeNull();
  });

  // TEST B: Same user owning both old and new workspaces can reassociate
  it('TEST B: Same user owning both old and new workspaces can reassociate', async () => {
    const { user, session } = await createUserWithSession('bob@example.com', 'Pass12345!', 'Bob');
    const wsOld = await getDefaultWorkspaceForUser(user.id);
    const wsNew = await createWorkspaceForUser(user.id, "Bob's Second Workspace");

    const db = getDatabase();
    const now = new Date().toISOString();
    // Initially installed in wsOld
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_bob_inst', ?, ?, 'ravitejabolla756-sys', 'User', 'active', ?, ?)
    `, [wsOld.id, TEST_INSTALLATION_ID, now, now]);

    // Bob initiates connection from wsNew
    const state = await createGitHubInstallationState(user.id, wsNew.id);

    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(200);

    const data = (await res.json()) as CallbackSuccessData;
    expect(data.success).toBe(true);
    expect(data.workspaceId).toBe(wsNew.id);

    // Old workspace no longer has the installation
    const oldInst = await getWorkspaceGitHubInstallation(wsOld.id);
    expect(oldInst).toBeNull();

    // New workspace now owns the installation
    const newInst = await getWorkspaceGitHubInstallation(wsNew.id);
    expect(newInst).not.toBeNull();
    expect(newInst?.id).toBe('ghi_bob_inst');
    expect(newInst?.workspaceId).toBe(wsNew.id);
    expect(newInst?.installationId).toBe(TEST_INSTALLATION_ID);
  });

  // TEST C: User who only owns target workspace cannot steal an installation owned by another workspace
  it('TEST C: User who only owns target workspace cannot steal an installation owned by another workspace', async () => {
    const { user: victimUser } = await createUserWithSession('victim@example.com', 'Pass12345!', 'Victim Owner');
    const victimWs = await getDefaultWorkspaceForUser(victimUser.id);

    const { user: attackerUser, session: attackerSession } = await createUserWithSession('attacker@example.com', 'Pass12345!', 'Attacker Owner');
    const attackerWs = await getDefaultWorkspaceForUser(attackerUser.id);

    const db = getDatabase();
    const now = new Date().toISOString();
    // Installation belongs to victim's workspace
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_victim_inst', ?, ?, 'victim-org', 'Organization', 'active', ?, ?)
    `, [victimWs.id, TEST_INSTALLATION_ID, now, now]);

    // Attacker generates state for attacker's workspace and calls callback with victim's installation ID
    const state = await createGitHubInstallationState(attackerUser.id, attackerWs.id);

    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${attackerSession.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(409);

    const data = (await res.json()) as CallbackErrorData;
    expect(data.code).toBe('INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE');
    expect(data.error).toBe('This GitHub installation is already associated with another workspace.');
  });

  // TEST D: Installation remains unchanged after rejected reassociation
  it('TEST D: Installation remains unchanged after rejected reassociation', async () => {
    const { user: victimUser } = await createUserWithSession('carol@example.com', 'Pass12345!', 'Carol');
    const victimWs = await getDefaultWorkspaceForUser(victimUser.id);

    const { user: outsiderUser, session: outsiderSession } = await createUserWithSession('outsider@example.com', 'Pass12345!', 'Outsider');
    const outsiderWs = await getDefaultWorkspaceForUser(outsiderUser.id);

    const db = getDatabase();
    const originalTime = '2026-09-01T12:00:00.000Z';
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_carol_target', ?, ?, 'carol-account', 'User', 'active', ?, ?)
    `, [victimWs.id, TEST_INSTALLATION_ID, originalTime, originalTime]);

    const state = await createGitHubInstallationState(outsiderUser.id, outsiderWs.id);

    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${outsiderSession.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(409);

    // Verify row was NOT modified in any way
    const row = await db.queryOne<{
      id: string;
      workspace_id: string;
      account_login: string;
      account_type: string;
      status: string;
      updated_at: string;
    }>(`
      SELECT id, workspace_id, account_login, account_type, status, updated_at
      FROM github_installations WHERE installation_id = ?
    `, [TEST_INSTALLATION_ID]);

    expect(row).toBeDefined();
    expect(row?.id).toBe('ghi_carol_target');
    expect(row?.workspace_id).toBe(victimWs.id);
    expect(row?.account_login).toBe('carol-account');
    expect(row?.account_type).toBe('User');
    expect(row?.status).toBe('active');
    expect(row?.updated_at).toBe(originalTime);

    // Outsider's workspace has zero installations
    const outsiderInst = await getWorkspaceGitHubInstallation(outsiderWs.id);
    expect(outsiderInst).toBeNull();
    const stateRow = await db.queryOne<{ consumed_at: number | null }>(
      'SELECT consumed_at FROM github_installation_states WHERE state = ?', [state]);
    expect(stateRow?.consumed_at).toBeNull();

    // An authorized server-side repair can now make the same callback
    // retryable; the callback itself never transfers ownership arbitrarily.
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wm_outsider_repaired', ?, ?, 'owner', ?)
    `, [victimWs.id, outsiderUser.id, new Date().toISOString()]);
    const retry = await callbackGet(req);
    expect(retry.status).toBe(200);
    expect((await retry.json() as CallbackSuccessData).workspaceId).toBe(outsiderWs.id);
  });

  // TEST E: Reassociation cannot create duplicate installation rows
  it('TEST E: Reassociation cannot create duplicate installation rows', async () => {
    const { user, session } = await createUserWithSession('dan@example.com', 'Pass12345!', 'Dan');
    const ws1 = await getDefaultWorkspaceForUser(user.id);
    const ws2 = await createWorkspaceForUser(user.id, 'Dan Team');

    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_dan_primary', ?, ?, 'dan-github', 'User', 'active', ?, ?)
    `, [ws1.id, TEST_INSTALLATION_ID, now, now]);

    // Initial check
    const countBefore = await db.queryOne<{ count: number }>(`
      SELECT count(*) as count FROM github_installations WHERE installation_id = ?
    `, [TEST_INSTALLATION_ID]);
    expect(Number(countBefore?.count)).toBe(1);

    // Reassociate to ws2
    const state = await createGitHubInstallationState(user.id, ws2.id);
    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${session.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(200);

    // Exactly 1 row must exist, with the preserved primary key ID
    const allRows = await db.query<{ id: string; workspace_id: string }>(`
      SELECT id, workspace_id FROM github_installations WHERE installation_id = ?
    `, [TEST_INSTALLATION_ID]);

    expect(allRows.length).toBe(1);
    expect(allRows[0]!.id).toBe('ghi_dan_primary');
    expect(allRows[0]!.workspace_id).toBe(ws2.id);
  });

  // TEST F: Existing pilot/developer workspace behavior is covered through ownership semantics, not a hard-coded workspace ID
  it('TEST F: Pilot/developer workspace transfer works through ownership semantics, not hard-coded workspace ID', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();

    // Setup pilot workspace (ws_pilot_developer is seeded by default in SQLite test DB)
    const pilotWsId = 'ws_pilot_developer';
    const existingWs = await db.queryOne<{ id: string }>('SELECT id FROM workspaces WHERE id = ?', [pilotWsId]);
    if (!existingWs) {
      await db.execute(`
        INSERT INTO workspaces (id, name, slug, created_at, updated_at)
        VALUES (?, 'Pilot Workspace', 'pilot-workspace', ?, ?)
      `, [pilotWsId, now, now]);
    }

    // Create User 1 who is owner of pilot workspace and creates a new workspace
    const { user: user1, session: session1 } = await createUserWithSession('pilot_owner@example.com', 'Pass12345!', 'Pilot Owner');
    const user1Ws = await getDefaultWorkspaceForUser(user1.id);

    // Add user1 as owner of ws_pilot_developer
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wm_pilot_user1', ?, ?, 'owner', ?)
    `, [pilotWsId, user1.id, now]);

    // Attach installation to ws_pilot_developer
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_pilot_legacy', ?, ?, 'pilot-dev', 'User', 'active', ?, ?)
    `, [pilotWsId, TEST_INSTALLATION_ID, now, now]);

    // Subcase 1: User 1 owns BOTH ws_pilot_developer and user1Ws -> reassociation succeeds!
    const state1 = await createGitHubInstallationState(user1.id, user1Ws.id);
    const req1 = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state1}`, {
      headers: { cookie: `apiproof_session=${session1.id}` },
    });

    const res1 = await callbackGet(req1);
    expect(res1.status).toBe(200);

    const data1 = (await res1.json()) as CallbackSuccessData;
    expect(data1.success).toBe(true);
    expect(data1.workspaceId).toBe(user1Ws.id);

    // Reset installation back to ws_pilot_developer for Subcase 2
    await db.execute(`
      UPDATE github_installations
      SET workspace_id = ?
      WHERE id = 'ghi_pilot_legacy'
    `, [pilotWsId]);

    // Subcase 2: User 2 is a separate user who owns target workspace but does NOT own ws_pilot_developer
    const { user: user2, session: session2 } = await createUserWithSession('unrelated@example.com', 'Pass12345!', 'Unrelated User');
    const user2Ws = await getDefaultWorkspaceForUser(user2.id);

    const state2 = await createGitHubInstallationState(user2.id, user2Ws.id);
    const req2 = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state2}`, {
      headers: { cookie: `apiproof_session=${session2.id}` },
    });

    // Subcase 2 must FAIL with 409 INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE
    // Demonstrates that ws_pilot_developer cannot be stolen by anyone who doesn't own it
    const res2 = await callbackGet(req2);
    expect(res2.status).toBe(409);

    const data2 = (await res2.json()) as CallbackErrorData;
    expect(data2.code).toBe('INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE');

    // Installation row still belongs to ws_pilot_developer
    const pilotInst = await getWorkspaceGitHubInstallation(pilotWsId);
    expect(pilotInst).not.toBeNull();
    expect(pilotInst?.id).toBe('ghi_pilot_legacy');
  });

  // TEST G: Non-owner member of target workspace cannot reassociate an existing installation (403)
  it('TEST G: Non-owner member of target workspace cannot reassociate an existing installation', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();

    const { user: ownerUser } = await createUserWithSession('owner_g@example.com', 'Pass12345!', 'Owner G');
    const wsTarget = await getDefaultWorkspaceForUser(ownerUser.id);

    const { user: memberUser, session: memberSession } = await createUserWithSession('member_g@example.com', 'Pass12345!', 'Member G');
    const wsOld = await getDefaultWorkspaceForUser(memberUser.id);

    // Member is added as 'member' (not 'owner') to wsTarget
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wm_g_target', ?, ?, 'member', ?)
    `, [wsTarget.id, memberUser.id, now]);

    // Installation is in wsOld (which memberUser owns)
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_g_inst', ?, ?, 'member-account', 'User', 'active', ?, ?)
    `, [wsOld.id, TEST_INSTALLATION_ID, now, now]);

    // Member tries to reassociate into wsTarget where they are only a 'member'
    const state = await createGitHubInstallationState(memberUser.id, wsTarget.id);
    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${memberSession.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(403);
    const data = (await res.json()) as CallbackErrorData;
    expect(data.code).toBe('FORBIDDEN');
    expect(data.error).toContain('workspace owner privileges');
  });

  // TEST H: Target workspace owner who is only a member of existing workspace cannot reassociate (409)
  it('TEST H: Target workspace owner who is only a member of existing workspace cannot reassociate', async () => {
    const db = getDatabase();
    const now = new Date().toISOString();

    const { user: oldOwner } = await createUserWithSession('old_owner_h@example.com', 'Pass12345!', 'Old Owner H');
    const wsOld = await getDefaultWorkspaceForUser(oldOwner.id);

    const { user: targetOwner, session: targetSession } = await createUserWithSession('target_owner_h@example.com', 'Pass12345!', 'Target Owner H');
    const wsTarget = await getDefaultWorkspaceForUser(targetOwner.id);

    // targetOwner is added to wsOld as 'member' (not 'owner')
    await db.execute(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
      VALUES ('wm_h_old', ?, ?, 'member', ?)
    `, [wsOld.id, targetOwner.id, now]);

    // Installation is attached to wsOld
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('ghi_h_inst', ?, ?, 'old-account', 'Organization', 'active', ?, ?)
    `, [wsOld.id, TEST_INSTALLATION_ID, now, now]);

    // targetOwner tries to reassociate to wsTarget
    const state = await createGitHubInstallationState(targetOwner.id, wsTarget.id);
    const req = new Request(`http://localhost/api/github/callback?installation_id=${TEST_INSTALLATION_ID}&state=${state}`, {
      headers: { cookie: `apiproof_session=${targetSession.id}` },
    });

    const res = await callbackGet(req);
    expect(res.status).toBe(409);
    const data = (await res.json()) as CallbackErrorData;
    expect(data.code).toBe('INSTALLATION_OWNED_BY_ANOTHER_WORKSPACE');
  });
});
