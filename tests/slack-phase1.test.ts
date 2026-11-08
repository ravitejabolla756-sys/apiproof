import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type * as VerificationWorkerRegistry from '../apps/web/src/lib/server/verification-worker-registry.js';

const readiness = vi.hoisted(() => ({ ready: true }));
vi.mock('../apps/web/src/lib/server/verification-worker-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof VerificationWorkerRegistry>();
  return { ...actual, hasReadyVerificationWorker: vi.fn(async () => readiness.ready) };
});

import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import * as workspaceService from '../apps/web/src/lib/server/workspace-service.js';
import { createSlackAuthorizationUrl, consumeSlackOAuthState, saveSlackConnection } from '../apps/web/src/lib/server/slack-oauth.js';
import { decryptSlackToken, encryptSlackToken, verifySlackActionValue, verifySlackRequestSignature } from '../apps/web/src/lib/server/slack-security.js';
import { enqueueNewFindingNotifications, processOneSlackNotificationDelivery, queueSlackProposalOutcome } from '../apps/web/src/lib/server/slack-notifications.js';
import { acceptSlackAction, processOneSlackInteractionJob } from '../apps/web/src/lib/server/slack-interactions.js';
import { GET as getSlackConnection } from '../apps/web/src/app/api/slack/connection/route.js';
import { DELETE as deleteSlackConnection } from '../apps/web/src/app/api/slack/connection/route.js';
import { GET as slackCallback } from '../apps/web/src/app/api/slack/callback/route.js';
import { POST as slackInteraction } from '../apps/web/src/app/api/slack/interactions/route.js';

const DB_PATH = path.resolve('.tmp/test-slack-phase1.db');
const now = () => new Date().toISOString();

async function user(email: string) {
  const value = await createUserWithSession(email, 'Pass1234!', 'Slack Test');
  return { userId: value.user.id, workspace: await getDefaultWorkspaceForUser(value.user.id) };
}

async function createFinding(workspaceId: string, userId: string, name: string) {
  const db = getDatabase();
  const timestamp = now();
  const repoId = `repo_${crypto.randomBytes(8).toString('hex')}`;
  const scanId = `scn_${crypto.randomBytes(8).toString('hex')}`;
  const findingId = `fnd_${crypto.randomBytes(8).toString('hex')}`;
  await db.execute(`INSERT INTO repositories
    (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
    VALUES (?, ?, ?, 'acme', ?, ?, ?, 'main', 'connected', 'connected', 'active', ?)`,
  [repoId, workspaceId, userId, name, `acme/${name}`, String(crypto.randomInt(100000, 999999999)), timestamp]);
  await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at)
    VALUES (?, ?, ?, 'completed', 'github', ?, ?)`, [scanId, repoId, 'a'.repeat(40), timestamp, timestamp]);
  await db.execute(`INSERT INTO findings
    (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence,
     file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at)
    VALUES (?, ?, ?, ?, ?, 'Stripe', 'Breaking API change', 'Requires safe migration.', 'high', 0.9,
      'src/billing.ts', 12, 'subscriptions.create', 'open', 'breaking', '[]', '{}', ?)`,
  [findingId, scanId, repoId, `usage_${findingId}`, `change_${findingId}`, timestamp]);
  return { repoId, scanId, findingId };
}

async function connectSlack(workspaceId: string, userId: string) {
  await saveSlackConnection({ teamId: 'T123', teamName: 'Acme', installerSlackUserId: 'U123', accessToken: 'xoxb-secret-value' }, workspaceId, userId);
  return getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_connections WHERE workspace_id = ?', [workspaceId]);
}

describe('MY OWL Slack Phase 1', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APIPROOF_SECRET = 'slack-test-verifier-secret-at-least-32-chars';
    process.env.APIPROOF_DB_PATH = DB_PATH;
    process.env.APIPROOF_APP_URL = 'https://myowl.example.test';
    process.env.SLACK_CLIENT_ID = 'slack-client-id';
    process.env.SLACK_CLIENT_SECRET = 'slack-client-secret';
    process.env.SLACK_SIGNING_SECRET = 'slack-signing-secret';
    process.env.SLACK_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    readiness.ready = true;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('binds OAuth state to the authenticated user and consumes it exactly once', async () => {
    const { userId, workspace } = await user('oauth@example.test');
    const url = new URL(await createSlackAuthorizationUrl(userId));
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize');
    expect(url.searchParams.get('scope')).toBe('chat:write,im:write');
    expect(url.searchParams.has('user_scope')).toBe(false);
    expect(url.searchParams.get('redirect_uri')).toBe('https://myowl.example.test/api/slack/callback');
    const state = url.searchParams.get('state')!;
    expect(await consumeSlackOAuthState(state, 'another-user')).toBeNull();
    expect(await consumeSlackOAuthState(state, userId)).toEqual({ workspaceId: workspace.id });
    expect(await consumeSlackOAuthState(state, userId)).toBeNull();
  });

  it('completes OAuth without returning or persisting plaintext credentials', async () => {
    const { user, session } = await createUserWithSession('oauth-callback@example.test', 'Pass1234!', 'Callback User');
    const authUrl = new URL(await createSlackAuthorizationUrl(user.id));
    const state = authUrl.searchParams.get('state')!;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true, access_token: 'xoxb-private-token', token_type: 'bot', scope: 'chat:write,im:write',
      team: { id: 'T-OAUTH', name: 'OAuth Team' }, authed_user: { id: 'U-OAUTH' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const response = await slackCallback(new Request(`https://myowl.example.test/api/slack/callback?state=${encodeURIComponent(state)}&code=oauth-code`, {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    expect(response.headers.get('location')).toContain('slack=connected');
    expect(response.headers.get('location')).not.toContain('xoxb');
    const connection = await getDatabase().queryOne<Record<string, unknown>>('SELECT * FROM slack_connections WHERE workspace_id = ?',
      [(await getDefaultWorkspaceForUser(user.id)).id]);
    expect(connection).toBeTruthy();
    expect(connection?.installer_slack_user_id).toBe('U-OAUTH');
    expect(connection?.connected_by).toBe(user.id);
    expect(JSON.stringify(connection)).not.toContain('xoxb-private-token');
  });

  it('rejects a callback with forged state without exchanging credentials', async () => {
    const { user, session } = await createUserWithSession('oauth-forged@example.test', 'Pass1234!', 'Forged State');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await slackCallback(new Request('https://myowl.example.test/api/slack/callback?state=forged&code=any-code', {
      headers: { cookie: `apiproof_session=${session.id}` },
    }));
    expect(response.headers.get('location')).toContain('slack=error');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT id FROM slack_connections')).toBeUndefined();
    expect(await getDefaultWorkspaceForUser(user.id)).toBeTruthy();
  });

  it('rejects a callback after workspace membership is revoked before exchanging credentials', async () => {
    const account = await createUserWithSession('oauth-revoked-role@example.test', 'Pass1234!', 'Revoked Role');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    const authUrl = new URL(await createSlackAuthorizationUrl(account.user.id));
    const state = authUrl.searchParams.get('state')!;
    await getDatabase().execute(
      'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspace.id, account.user.id],
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await slackCallback(new Request(`https://myowl.example.test/api/slack/callback?state=${encodeURIComponent(state)}&code=oauth-code`, {
      headers: { cookie: `apiproof_session=${account.session.id}` },
    }));

    expect(response.headers.get('location')).toContain('slack=error');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDatabase().queryOne('SELECT id FROM slack_connections')).toBeUndefined();
  });

  it('returns only the authenticated workspace connection state from the status API', async () => {
    const a = await createUserWithSession('status-a@example.test', 'Pass1234!', 'Status A');
    const b = await createUserWithSession('status-b@example.test', 'Pass1234!', 'Status B');
    const workspaceA = await getDefaultWorkspaceForUser(a.user.id);
    const workspaceB = await getDefaultWorkspaceForUser(b.user.id);
    await connectSlack(workspaceA.id, a.user.id);
    const response = await getSlackConnection(new Request('https://myowl.example.test/api/slack/connection', {
      headers: { cookie: 'apiproof_session=missing-session' },
    }));
    expect(response.status).toBe(401);
    const ownResponse = await getSlackConnection(new Request('https://myowl.example.test/api/slack/connection', {
      headers: { cookie: `apiproof_session=${a.session.id}` },
    }));
    const statusBody = await ownResponse.json() as Record<string, unknown>;
    expect(statusBody).toMatchObject({ connected: true, teamName: 'Acme' });
    expect(statusBody.workspaceId).toBeUndefined();
    const otherResponse = await getSlackConnection(new Request('https://myowl.example.test/api/slack/connection', {
      headers: { cookie: `apiproof_session=${b.session.id}` },
    }));
    expect(await otherResponse.json()).toMatchObject({ connected: false });
    expect(workspaceB.id).not.toBe(workspaceA.id);
  });

  it('denies Slack status and disconnect for an unknown persisted workspace role', async () => {
    const account = await createUserWithSession('slack-unknown-role@example.test', 'Pass1234!', 'Unknown Role');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    await connectSlack(workspace.id, account.user.id);
    await getDatabase().execute(
      'UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?',
      ['future_role', workspace.id, account.user.id],
    );

    const headers = { cookie: `apiproof_session=${account.session.id}` };
    const statusResponse = await getSlackConnection(new Request('https://myowl.example.test/api/slack/connection', { headers }));
    expect(statusResponse.status).toBe(403);
    expect(statusResponse.headers.get('cache-control')).toContain('no-store');
    expect(await statusResponse.json()).toEqual({ error: 'Workspace access denied.' });

    const disconnectResponse = await deleteSlackConnection(new Request('https://myowl.example.test/api/slack/connection', {
      method: 'DELETE',
      headers: { ...headers, host: 'myowl.example.test', origin: 'https://myowl.example.test' },
    }));
    expect(disconnectResponse.status).toBe(403);
    expect(await disconnectResponse.json()).toEqual({ error: 'Workspace access denied.' });
    const connection = await getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM slack_connections WHERE workspace_id = ?',
      [workspace.id],
    );
    expect(connection?.status).toBe('active');
  });

  it('maps membership revocation between workspace resolution and disconnect to a generic denial', async () => {
    const account = await createUserWithSession('slack-disconnect-race@example.test', 'Pass1234!', 'Disconnect Race');
    const workspace = await getDefaultWorkspaceForUser(account.user.id);
    await connectSlack(workspace.id, account.user.id);
    vi.spyOn(workspaceService, 'requireWorkspaceMember').mockRejectedValueOnce(new Error('Workspace not found or access denied.'));

    const response = await deleteSlackConnection(new Request('https://myowl.example.test/api/slack/connection', {
      method: 'DELETE',
      headers: {
        cookie: `apiproof_session=${account.session.id}`,
        host: 'myowl.example.test',
        origin: 'https://myowl.example.test',
      },
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toEqual({ error: 'Workspace access denied.' });
    const connection = await getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM slack_connections WHERE workspace_id = ?',
      [workspace.id],
    );
    expect(connection?.status).toBe('active');
    expect(await getDatabase().queryOne(
      "SELECT id FROM activity_events WHERE user_id = ? AND type = 'slack_disconnected'",
      [account.user.id],
    )).toBeUndefined();
  });

  it('rejects malformed/expired OAuth state and requires encryption configuration', async () => {
    const { userId } = await user('oauth-expired@example.test');
    const url = new URL(await createSlackAuthorizationUrl(userId));
    await getDatabase().execute('UPDATE slack_oauth_states SET expires_at = ? WHERE state_hash = ?',
      [new Date(Date.now() - 1000).toISOString(), crypto.createHash('sha256').update(url.searchParams.get('state')!).digest('hex')]);
    expect(await consumeSlackOAuthState(url.searchParams.get('state')!, userId)).toBeNull();
    expect(await consumeSlackOAuthState('bad', userId)).toBeNull();
    delete process.env.SLACK_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptSlackToken('token')).toThrow('SLACK_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED');
  });

  it('encrypts Slack credentials at rest and scopes a connection to its MY OWL workspace', async () => {
    const a = await user('slack-a@example.test');
    const b = await user('slack-b@example.test');
    await connectSlack(a.workspace.id, a.userId);
    const row = await getDatabase().queryOne<Record<string, unknown>>('SELECT * FROM slack_connections WHERE workspace_id = ?', [a.workspace.id]);
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain('xoxb-secret-value');
    expect(decryptSlackToken({ ciphertext: String(row!.token_ciphertext), iv: String(row!.token_iv), authTag: String(row!.token_auth_tag) }))
      .toContain('xoxb-secret-value');
    expect(await getDatabase().queryOne('SELECT id FROM slack_connections WHERE workspace_id = ?', [b.workspace.id])).toBeUndefined();
    await expect(saveSlackConnection({ teamId: 'T123', teamName: 'Acme', installerSlackUserId: 'U123', accessToken: 'xoxb-other' }, a.workspace.id, b.userId))
      .rejects.toThrow();
  });

  it('creates one durable finding notification per newly actionable finding and workspace', async () => {
    const a = await user('notify@example.test');
    await connectSlack(a.workspace.id, a.userId);
    const finding = await createFinding(a.workspace.id, a.userId, 'billing');
    await enqueueNewFindingNotifications([finding.findingId]);
    await enqueueNewFindingNotifications([finding.findingId, finding.findingId]);
    const rows = await getDatabase().query<{ id: string; event_key: string }>(
      'SELECT id, event_key FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event_key).toContain(finding.findingId);
  });

  it('verifies Slack raw-body HMAC and rejects tampering, missing headers, and stale timestamps', () => {
    const rawBody = 'payload=%7B%22type%22%3A%22block_actions%22%7D';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
    expect(verifySlackRequestSignature({ rawBody, timestamp, signature })).toBe(true);
    expect(verifySlackRequestSignature({ rawBody: `${rawBody}x`, timestamp, signature })).toBe(false);
    expect(verifySlackRequestSignature({ rawBody, timestamp: null, signature })).toBe(false);
    expect(verifySlackRequestSignature({ rawBody, timestamp: '1', signature })).toBe(false);
  });

  it('acks signed interactions promptly and ignores client-supplied workspace identity', async () => {
    const { userId, workspace } = await user('route-action@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'route-action');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const value = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt: token!.expires_at });
    const payload = JSON.stringify({ type: 'block_actions', team: { id: 'T123' }, user: { id: 'U123' }, workspace_id: 'ws_attacker',
      actions: [{ action_id: 'MYOWL_CREATE_PR', value }] });
    const rawBody = new URLSearchParams({ payload }).toString();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
    const invalidSignature = await slackInteraction(new Request('https://myowl.example.test/api/slack/interactions', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': 'v0=invalid' }, body: rawBody,
    }));
    expect(invalidSignature.status).toBe(401);
    const response = await slackInteraction(new Request('https://myowl.example.test/api/slack/interactions', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature }, body: rawBody,
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({ response_type: 'ephemeral' });
    const job = await getDatabase().queryOne<{ workspace_id: string }>('SELECT workspace_id FROM slack_interaction_jobs');
    expect(job?.workspace_id).toBe(workspace.id);
    const oversized = await slackInteraction(new Request('https://myowl.example.test/api/slack/interactions', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `payload=${'x'.repeat(65 * 1024)}`,
    }));
    expect(oversized.status).toBe(200);
    expect(await oversized.json()).toMatchObject({ text: 'Slack request was too large.' });
  });

  it('rejects unknown/forged actions and refuses actions from a different Slack identity', async () => {
    const a = await user('action-owner@example.test');
    const b = await user('action-other@example.test');
    const finding = await createFinding(a.workspace.id, a.userId, 'actions');
    const connection = await connectSlack(a.workspace.id, a.userId);
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const value = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt });
    // Use the persisted action token's expiration so the server-side hash binding matches.
    const action = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    const validValue = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt: action!.expires_at });
    expect(verifySlackActionValue(value)?.action).toBe('create_pr');
    expect(verifySlackActionValue(`${value}x`)).toBeNull();
    const rejected = await acceptSlackAction({ requestHash: 'hash-wrong-user', actionId: 'MYOWL_CREATE_PR', actionValue: validValue, teamId: 'T123', slackUserId: 'U999' });
    expect(rejected.accepted).toBe(false);
    const mismatchedTeam = await acceptSlackAction({ requestHash: 'hash-wrong-team', actionId: 'MYOWL_CREATE_PR', actionValue: validValue, teamId: 'T999', slackUserId: 'U123' });
    expect(mismatchedTeam.accepted).toBe(false);
    const invalid = await acceptSlackAction({ requestHash: 'hash-invalid', actionId: 'UNKNOWN', actionValue: validValue, teamId: 'T123', slackUserId: 'U123' });
    expect(invalid.accepted).toBe(false);
    expect(await getDatabase().queryOne('SELECT id FROM slack_interaction_jobs')).toBeUndefined();
    expect(connection).toBeTruthy();
    expect(b.workspace.id).not.toBe(a.workspace.id);
  });

  it('queues Create PR only as an existing verification proposal job and deduplicates Slack retries', async () => {
    const { userId, workspace } = await user('action-queue@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'queue');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const actionValue = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt: token!.expires_at });
    const input = { requestHash: 'signed-slack-request-hash', actionId: 'MYOWL_CREATE_PR', actionValue, teamId: 'T123', slackUserId: 'U123' };
    const first = await acceptSlackAction(input);
    const retry = await acceptSlackAction(input);
    expect(first.accepted).toBe(true);
    expect(retry.accepted).toBe(true);
    expect(await getDatabase().queryOne('SELECT id FROM slack_interaction_jobs')).toBeTruthy();
    expect(await getDatabase().queryOne('SELECT id FROM migration_verification_jobs')).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM pull_requests')).toBeUndefined();
  });

  it('records dismissal per connecting user and notification without changing the finding', async () => {
    const { userId, workspace } = await user('dismiss@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'dismiss');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'dismiss'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const value = createSlackActionValue({ deliveryId: delivery!.id, action: 'dismiss', expiresAt: token!.expires_at });
    const result = await acceptSlackAction({ requestHash: 'dismiss-request', actionId: 'MYOWL_DISMISS', actionValue: value, teamId: 'T123', slackUserId: 'U123' });
    expect(result.accepted).toBe(true);
    const dismissal = await getDatabase().queryOne<{ user_id: string }>('SELECT user_id FROM slack_notification_dismissals WHERE delivery_id = ?', [delivery!.id]);
    const currentFinding = await getDatabase().queryOne<{ status: string }>('SELECT status FROM findings WHERE id = ?', [finding.findingId]);
    expect(dismissal?.user_id).toBe(userId);
    expect(currentFinding?.status).toBe('open');
  });

  it('rejects an action after its Slack connection has been revoked', async () => {
    const { userId, workspace } = await user('revoked-action@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'revoked-action');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'dismiss'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const value = createSlackActionValue({ deliveryId: delivery!.id, action: 'dismiss', expiresAt: token!.expires_at });
    await getDatabase().execute("UPDATE slack_connections SET status = 'revoked' WHERE workspace_id = ?", [workspace.id]);
    const result = await acceptSlackAction({ requestHash: 'revoked-action-request', actionId: 'MYOWL_DISMISS', actionValue: value, teamId: 'T123', slackUserId: 'U123' });
    expect(result.accepted).toBe(false);
    expect(await getDatabase().queryOne('SELECT id FROM slack_notification_dismissals')).toBeUndefined();
  });

  it('fails closed with worker unavailable and does not enqueue or produce fake success', async () => {
    readiness.ready = false;
    const { userId, workspace } = await user('worker-down@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'worker-down');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const actionValue = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt: token!.expires_at });
    const result = await acceptSlackAction({ requestHash: 'worker-unavailable', actionId: 'MYOWL_CREATE_PR', actionValue, teamId: 'T123', slackUserId: 'U123' });
    expect(result).toMatchObject({ accepted: false });
    expect(result.text).toContain('Verification worker unavailable');
    expect(await getDatabase().queryOne('SELECT id FROM slack_interaction_jobs')).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM pull_requests')).toBeUndefined();
  });

  it('processes accepted Slack actions through enqueueMigrationProposal, never direct PR creation', async () => {
    const { userId, workspace } = await user('worker-queue@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'worker-queue');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    await getDatabase().execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [delivery!.id]);
    const token = await getDatabase().queryOne<{ expires_at: string }>("SELECT expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    const { createSlackActionValue } = await import('../apps/web/src/lib/server/slack-security.js');
    const actionValue = createSlackActionValue({ deliveryId: delivery!.id, action: 'create_pr', expiresAt: token!.expires_at });
    await acceptSlackAction({ requestHash: 'worker-enqueue-job', actionId: 'MYOWL_CREATE_PR', actionValue, teamId: 'T123', slackUserId: 'U123' });
    const planning = await import('../apps/web/src/lib/server/planning-service.js');
    const proposalJobs = await import('../apps/web/src/lib/server/proposal-verification-jobs.js');
    const planningSpy = vi.spyOn(planning, 'generateMigrationForFinding').mockImplementation(async () => {
      await getDatabase().execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, plan_json, created_at)
        VALUES ('mig_slack_test', ?, ?, 'plan_slack_test', '{}', ?)`, [finding.findingId, finding.repoId, now()]);
      return { id: 'mig_slack_test' } as Awaited<ReturnType<typeof planning.generateMigrationForFinding>>;
    });
    const enqueueSpy = vi.spyOn(proposalJobs, 'enqueueMigrationProposal').mockResolvedValue({ jobId: 'vjob_slack_test', status: 'verification_in_progress' });
    expect(await processOneSlackInteractionJob('worker-test', true)).toBe(true);
    expect(planningSpy).toHaveBeenCalledWith(finding.findingId, userId);
    expect(enqueueSpy).toHaveBeenCalledWith('mig_slack_test', userId);
    expect(await getDatabase().queryOne('SELECT id FROM pull_requests')).toBeUndefined();
  });

  it('terminates permanent Slack authentication errors without changing scan persistence', async () => {
    const { userId, workspace } = await user('outbox@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'outbox');
    await enqueueNewFindingNotifications([finding.findingId]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })));
    // Invalid credentials are permanent; scan persistence remains independent of provider availability.
    await expect(processOneSlackNotificationDelivery('test-worker')).resolves.toBe(true);
    const row = await getDatabase().queryOne<{ status: string; error_category: string | null }>(
      'SELECT status, error_category FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    expect(row?.status).toBe('failed');
    expect(row?.error_category).toBe('SLACK_API_INVALID_AUTH');
  });

  it('does not deliver private finding data after the connecting user loses workspace membership', async () => {
    const { userId, workspace } = await user('removed-slack-member@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'private-after-removal');
    await enqueueNewFindingNotifications([finding.findingId]);
    await getDatabase().execute('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspace.id, userId]);
    const fetchMock = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(
      String(url).endsWith('/conversations.open')
        ? { ok: true, channel: { id: 'D-REMOVED' } }
        : { ok: true, channel: 'D-REMOVED', ts: '123.789' },
    ), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await processOneSlackNotificationDelivery('membership-review-worker');

    expect(fetchMock).not.toHaveBeenCalled();
    const row = await getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    expect(row?.status).not.toBe('delivered');
  });

  it('renders real finding data in a Slack DM and marks the outbox delivery complete', async () => {
    const { userId, workspace } = await user('delivery-success@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'real-message');
    await enqueueNewFindingNotifications([finding.findingId]);
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      sent.push({ url: String(url), body });
      return new Response(JSON.stringify(sent.length === 1
        ? { ok: true, channel: { id: 'D123' } }
        : { ok: true, channel: 'D123', ts: '123.456' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    expect(await processOneSlackNotificationDelivery('test-worker')).toBe(true);
    const row = await getDatabase().queryOne<{ status: string; slack_message_ts: string | null }>(
      'SELECT status, slack_message_ts FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    expect(row).toMatchObject({ status: 'delivered', slack_message_ts: '123.456' });
    const posted = sent[1]!.body;
    expect(posted.channel).toBe('D123');
    expect(JSON.stringify(posted.blocks)).toContain('Breaking change detected (HIGH)');
    expect(JSON.stringify(posted.blocks)).toContain('acme/real-message');
    expect(JSON.stringify(posted.blocks)).toContain('src/billing.ts:12');
    expect(JSON.stringify(posted.blocks)).toContain('MYOWL_CREATE_PR');
    expect(String(sent[0]!.url)).toContain('conversations.open');
    expect(String(sent[1]!.url)).toContain('chat.postMessage');
  });

  it('queues idempotent proposal reconciliation without trusting a result URL as PR evidence', async () => {
    const { userId, workspace } = await user('proposal-result@example.test');
    await connectSlack(workspace.id, userId);
    const finding = await createFinding(workspace.id, userId, 'proposal-result');
    await enqueueNewFindingNotifications([finding.findingId]);
    const delivery = await getDatabase().queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [finding.findingId]);
    const actionToken = await getDatabase().queryOne<{ id: string }>("SELECT id FROM slack_action_tokens WHERE delivery_id = ? AND action = 'create_pr'", [delivery!.id]);
    await getDatabase().execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, plan_json, created_at)
      VALUES ('mig_proposal_result', ?, ?, 'plan_result', '{}', ?)`, [finding.findingId, finding.repoId, now()]);
    await getDatabase().execute(`INSERT INTO slack_interaction_jobs
      (id, request_hash, action_token_id, delivery_id, workspace_id, repository_id, finding_id, slack_connection_id,
       user_id, slack_user_id, team_id, action, status, migration_id, created_at, updated_at)
      SELECT 'sli_proposal_result', 'proposal-result-request', ?, ?, ?, ?, ?, id, ?, 'U123', 'T123', 'create_pr', 'completed', 'mig_proposal_result', ?, ?
      FROM slack_connections WHERE workspace_id = ?`,
    [actionToken!.id, delivery!.id, workspace.id, finding.repoId, finding.findingId, userId, now(), now(), workspace.id]);
    const input = { migrationId: 'mig_proposal_result', outcome: 'draft_pr_created' as const, proposalUrl: 'https://github.com/acme/proposal-result/pull/42' };
    await queueSlackProposalOutcome(input);
    await queueSlackProposalOutcome(input);
    const results = await getDatabase().query<{ result_state: string; result_url: string }>(
      "SELECT result_state, result_url FROM slack_notification_deliveries WHERE migration_id = 'mig_proposal_result'");
    expect(results).toEqual([{ result_state: 'proposal_reconciliation_pending', result_url: null }]);
    await expect(queueSlackProposalOutcome({ ...input, proposalUrl: 'https://attacker.example/pr/1' })).rejects.toThrow('SLACK_PROPOSAL_URL_INVALID');
  });
});
