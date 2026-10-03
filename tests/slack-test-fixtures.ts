import crypto from 'node:crypto';
import fs from 'node:fs';
import { vi } from 'vitest';
import { FakeGitHubWriteTransport } from '@apiproof/core';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { saveSlackConnection } from '../apps/web/src/lib/server/slack-oauth.js';
import { enqueueNewFindingNotifications } from '../apps/web/src/lib/server/slack-notifications.js';
import { createSlackActionValue } from '../apps/web/src/lib/server/slack-security.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';

export const timestamp = () => new Date().toISOString();

export function initializeSlackTest(path: string): void {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APIPROOF_SECRET', 'slack-regression-test-only-verifier-secret');
  vi.stubEnv('APIPROOF_DB_PATH', path);
  vi.stubEnv('APIPROOF_APP_URL', 'https://myowl.example.test');
  vi.stubEnv('SLACK_CLIENT_ID', 'test-client');
  vi.stubEnv('SLACK_CLIENT_SECRET', 'test-secret');
  vi.stubEnv('SLACK_TOKEN_ENCRYPTION_KEY', crypto.randomBytes(32).toString('base64'));
  vi.stubEnv('APIPROOF_ENABLE_LIVE_GITHUB_WRITE', 'false');
  if (fs.existsSync(path)) fs.unlinkSync(path);
  initDatabase(path);
}

export async function cleanupSlackTest(path: string): Promise<void> {
  await closeDatabase();
  if (fs.existsSync(path)) fs.unlinkSync(path);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
}

export async function slackFixture(name = 'slack-fixture', realScan = false) {
  const db = getDatabase();
  const { user } = await createUserWithSession(`${crypto.randomBytes(8).toString('hex')}@example.test`, 'Pass1234!', 'Slack User');
  const workspace = await getDefaultWorkspaceForUser(user.id);
  await saveSlackConnection({ teamId: 'T123', teamName: 'Team', installerSlackUserId: 'U123', accessToken: 'xoxb-test-only' }, workspace.id, user.id);
  const connection = (await db.queryOne<{ id: string }>('SELECT id FROM slack_connections WHERE workspace_id = ?', [workspace.id]))!;
  const repoId = `repo_${crypto.randomBytes(8).toString('hex')}`;
  const owner = realScan ? 'ravitejabolla756-sys' : 'acme';
  const repoName = realScan ? 'apiproof-github-fixture' : name;
  await db.execute(`INSERT INTO repositories
    (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'main', 'connected', 'connected', 'active', ?)`,
  [repoId, workspace.id, user.id, owner, repoName, `${owner}/${repoName}`, realScan ? '1363070568' : String(crypto.randomInt(100000, 999999999)), timestamp()]);
  let findingId: string;
  let baselineSha = 'a'.repeat(40);
  if (realScan) {
    const scan = await runRepositoryScan(repoId, user.id); // Dedicated NODE_ENV=test fixture provider, never a production fallback.
    baselineSha = scan.sha;
    findingId = (await db.queryOne<{ id: string }>('SELECT id FROM findings WHERE repository_id = ?', [repoId]))!.id;
  } else {
    const scanId = `scn_${crypto.randomBytes(8).toString('hex')}`;
    findingId = `fnd_${crypto.randomBytes(8).toString('hex')}`;
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at)
      VALUES (?, ?, ?, 'completed', 'github', ?, ?)`, [scanId, repoId, baselineSha, timestamp(), timestamp()]);
    await db.execute(`INSERT INTO findings
      (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence,
       file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at)
      VALUES (?, ?, ?, ?, 'stripe-subscription-coupon-removed', 'Stripe', 'Private finding', 'Private source detail', 'high', 0.9,
        'src/billing.ts', 12, 'subscriptions.create', 'open', 'breaking', '[]', '[]', ?)`,
    [findingId, scanId, repoId, `usage_${findingId}`, timestamp()]);
  }
  await enqueueNewFindingNotifications([findingId]);
  const deliveryId = (await db.queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE finding_id = ?', [findingId]))!.id;
  const binding = { workspace_id: workspace.id, repository_id: repoId, finding_id: findingId, slack_connection_id: connection.id };
  return { userId: user.id, workspaceId: workspace.id, repoId, findingId, deliveryId, connectionId: connection.id, baselineSha, binding };
}

export async function slackAction(fixture: Awaited<ReturnType<typeof slackFixture>>, action: 'create_pr' | 'dismiss' = 'create_pr') {
  const db = getDatabase();
  await db.execute("UPDATE slack_notification_deliveries SET status = 'delivered' WHERE id = ?", [fixture.deliveryId]);
  const token = (await db.queryOne<{ id: string; expires_at: string }>('SELECT id, expires_at FROM slack_action_tokens WHERE delivery_id = ? AND action = ?', [fixture.deliveryId, action]))!;
  return { requestHash: crypto.randomBytes(16).toString('hex'), actionId: action === 'create_pr' ? 'MYOWL_CREATE_PR' : 'MYOWL_DISMISS',
    actionValue: createSlackActionValue({ deliveryId: fixture.deliveryId, action, expiresAt: token.expires_at }),
    teamId: 'T123', slackUserId: 'U123', tokenId: token.id };
}

export async function linkedSlackMigration(realProposal = false) {
  const fixture = await slackFixture('proposal', realProposal);
  const db = getDatabase();
  const action = await slackAction(fixture);
  let migrationId: string;
  if (realProposal) migrationId = (await generateMigrationForFinding(fixture.findingId, fixture.userId)).id;
  else {
    migrationId = `mig_${crypto.randomBytes(8).toString('hex')}`;
    await db.execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, plan_json, baseline_sha, created_at)
      VALUES (?, ?, ?, ?, '{}', ?, ?)`, [migrationId, fixture.findingId, fixture.repoId, `plan_${migrationId}`, fixture.baselineSha, timestamp()]);
  }
  const interactionId = `sli_${crypto.randomBytes(8).toString('hex')}`;
  await db.execute(`INSERT INTO slack_interaction_jobs
    (id, request_hash, action_token_id, delivery_id, workspace_id, repository_id, finding_id, slack_connection_id,
     user_id, slack_user_id, team_id, action, status, migration_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'U123', 'T123', 'create_pr', 'completed', ?, ?, ?)`,
  [interactionId, action.requestHash, action.tokenId, fixture.deliveryId, fixture.workspaceId, fixture.repoId, fixture.findingId,
    fixture.connectionId, fixture.userId, migrationId, timestamp(), timestamp()]);
  // External GitHub writes are explicitly test-only; all planner, verification evidence and persistence rules run normally.
  const proposal = realProposal ? await createGitHubProposal(migrationId, fixture.userId,
    new FakeGitHubWriteTransport('ravitejabolla756-sys', 'apiproof-github-fixture', 'main', fixture.baselineSha)) : null;
  return { ...fixture, migrationId, interactionId, proposal, binding: { ...fixture.binding, migration_id: migrationId } };
}

export function mockSlackSuccess() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(String(url).endsWith('/conversations.open')
      ? { ok: true, channel: { id: 'D123' } } : { ok: true, channel: 'D123', ts: '123.456' }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
