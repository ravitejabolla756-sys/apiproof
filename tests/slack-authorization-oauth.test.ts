import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { acceptSlackAction, processOneSlackInteractionJob } from '../apps/web/src/lib/server/slack-interactions.js';
import { processOneSlackNotificationDelivery } from '../apps/web/src/lib/server/slack-notifications.js';
import { exchangeSlackOAuthCode, saveSlackConnection } from '../apps/web/src/lib/server/slack-oauth.js';
import { createSlackActionValue, decryptSlackToken, hashSlackOpaqueValue } from '../apps/web/src/lib/server/slack-security.js';
import { initializeSlackTest, cleanupSlackTest, slackFixture, slackAction, mockSlackSuccess, timestamp } from './slack-test-fixtures.js';

vi.mock('../apps/web/src/lib/server/verification-worker-registry.js', () => ({ hasReadyVerificationWorker: vi.fn(async () => true) }));
const dbPath = path.resolve('.tmp/test-slack-auth-oauth.db');
beforeEach(() => initializeSlackTest(dbPath));
afterEach(() => cleanupSlackTest(dbPath));

describe('Slack dispatch authorization', () => {
  it('delivers only for a current authorized member', async () => {
    const fixture = await slackFixture();
    const { fetchMock } = mockSlackSuccess();
    expect(await processOneSlackNotificationDelivery('auth-worker')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await getDatabase().queryOne('SELECT status FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId])).toEqual({ status: 'delivered' });
  });

  it.each(['membership', 'repository', 'connection', 'finding-workspace', 'repository-workspace'] as const)(
    'suppresses %s revocation/mismatch before ANY provider call', async (kind) => {
      const fixture = await slackFixture();
      const db = getDatabase();
      if (kind === 'membership') await db.execute('DELETE FROM workspace_members WHERE user_id = ? AND workspace_id = ?', [fixture.userId, fixture.workspaceId]);
      if (kind === 'repository') await db.execute("UPDATE repositories SET lifecycle = 'disconnected' WHERE id = ?", [fixture.repoId]);
      if (kind === 'connection') await db.execute("UPDATE slack_connections SET status = 'revoked' WHERE id = ?", [fixture.connectionId]);
      if (kind === 'finding-workspace' || kind === 'repository-workspace') {
        const other = await slackFixture('other-tenant');
        // Even a user who belongs to both tenants may not cross-bind a delivery to the other tenant.
        await db.execute("INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, 'member', ?)",
          [`member_${fixture.userId}`, other.workspaceId, fixture.userId, timestamp()]);
        if (kind === 'finding-workspace') await db.execute('UPDATE slack_notification_deliveries SET finding_id = ? WHERE id = ?', [other.findingId, fixture.deliveryId]);
        else await db.execute('UPDATE repositories SET workspace_id = ? WHERE id = ?', [other.workspaceId, fixture.repoId]);
        await db.execute("UPDATE slack_notification_deliveries SET status = 'failed' WHERE id = ?", [other.deliveryId]);
      }
      const { fetchMock } = mockSlackSuccess();
      expect(await processOneSlackNotificationDelivery('auth-worker')).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await db.queryOne('SELECT status, error_category FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId]))
        .toEqual({ status: 'failed', error_category: 'SLACK_DELIVERY_UNAUTHORIZED' });
      expect(await processOneSlackNotificationDelivery('auth-worker')).toBe(false);
    },
  );

  it('revalidates membership again after opening the DM and before posting private content', async () => {
    const fixture = await slackFixture();
    const fetchMock = vi.fn(async () => {
      await getDatabase().execute('DELETE FROM workspace_members WHERE user_id = ? AND workspace_id = ?', [fixture.userId, fixture.workspaceId]);
      return new Response(JSON.stringify({ ok: true, channel: { id: 'D123' } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await processOneSlackNotificationDelivery('auth-worker');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0])).not.toContain('Private source detail');
    expect(await getDatabase().queryOne('SELECT status FROM slack_notification_deliveries WHERE id = ?', [fixture.deliveryId])).toEqual({ status: 'failed' });
  });
});

describe('Slack action capabilities', () => {
  it.each(['expired', 'consumed', 'membership', 'finding-workspace', 'repository-workspace'] as const)(
    'rejects %s without queuing verification or consuming another capability', async (kind) => {
      const fixture = await slackFixture();
      const action = await slackAction(fixture);
      const db = getDatabase();
      if (kind === 'expired') {
        const expiresAt = new Date(Date.now() - 1000).toISOString();
        action.actionValue = createSlackActionValue({ deliveryId: fixture.deliveryId, action: 'create_pr', expiresAt });
        await db.execute('UPDATE slack_action_tokens SET token_hash = ?, expires_at = ? WHERE id = ?', [hashSlackOpaqueValue(action.actionValue), expiresAt, action.tokenId]);
      }
      if (kind === 'consumed') await db.execute('UPDATE slack_action_tokens SET consumed_at = ? WHERE id = ?', [timestamp(), action.tokenId]);
      if (kind === 'membership') await db.execute('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [fixture.workspaceId, fixture.userId]);
      if (kind.endsWith('-workspace')) {
        const other = await slackFixture('foreign-action');
        if (kind === 'finding-workspace') await db.execute('UPDATE slack_notification_deliveries SET finding_id = ? WHERE id = ?', [other.findingId, fixture.deliveryId]);
        else await db.execute('UPDATE repositories SET workspace_id = ? WHERE id = ?', [other.workspaceId, fixture.repoId]);
      }
      expect(await acceptSlackAction(action)).toMatchObject({ accepted: false });
      expect(await db.queryOne('SELECT id FROM slack_interaction_jobs')).toBeUndefined();
      expect(await db.queryOne('SELECT id FROM migration_verification_jobs')).toBeUndefined();
      expect(await db.queryOne('SELECT id FROM pull_requests')).toBeUndefined();
    },
  );

  it('checks revoked membership again when the durable interaction executes', async () => {
    const fixture = await slackFixture();
    expect(await acceptSlackAction(await slackAction(fixture))).toMatchObject({ accepted: true });
    await getDatabase().execute('DELETE FROM workspace_members WHERE user_id = ? AND workspace_id = ?', [fixture.userId, fixture.workspaceId]);
    expect(await processOneSlackInteractionJob('interaction-worker', true)).toBe(true);
    expect(await getDatabase().queryOne('SELECT status FROM slack_interaction_jobs')).toEqual({ status: 'failed' });
    expect(await getDatabase().queryOne('SELECT id FROM migration_verification_jobs')).toBeUndefined();
    expect(await getDatabase().queryOne('SELECT id FROM pull_requests')).toBeUndefined();
    const { fetchMock } = mockSlackSuccess();
    await processOneSlackNotificationDelivery('auth-worker');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Bot-only installation OAuth', () => {
  const response = {
    ok: true, token_type: 'bot', scope: 'chat:write,im:write', access_token: 'xoxb-bot-only',
    team: { id: 'T123', name: 'Team' }, authed_user: { id: 'U123', access_token: 'xoxp-user-private', refresh_token: 'user-refresh', expires_in: 1 },
  };
  function oauthResult(value: unknown) { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(value)))); }

  it('uses authed_user.id but never uses or persists user credential fields as bot credentials', async () => {
    const fixture = await slackFixture();
    oauthResult(response);
    const result = await exchangeSlackOAuthCode('valid-code');
    expect(result.installerSlackUserId).toBe('U123');
    expect(result.accessToken).toBe('xoxb-bot-only');
    expect(result.refreshToken).toBeUndefined();
    expect(result.expiresAt).toBeUndefined();
    await saveSlackConnection(result, fixture.workspaceId, fixture.userId);
    const row = (await getDatabase().queryOne<{ token_ciphertext: string; token_iv: string; token_auth_tag: string }>('SELECT * FROM slack_connections WHERE id = ?', [fixture.connectionId]))!;
    expect(JSON.parse(decryptSlackToken({ ciphertext: row.token_ciphertext, iv: row.token_iv, authTag: row.token_auth_tag }))).toEqual({ accessToken: 'xoxb-bot-only' });
  });

  it('uses only top-level bot refresh/expiry when token rotation is enabled', async () => {
    oauthResult({ ...response, refresh_token: 'bot-refresh', expires_in: 3600 });
    const result = await exchangeSlackOAuthCode('valid-code');
    expect(result.refreshToken).toBe('bot-refresh');
    expect(Date.parse(result.expiresAt!)).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it.each([
    { ...response, token_type: 'user' }, { ...response, authed_user: {} }, { ...response, authed_user: { id: 42 } },
    { ...response, access_token: 'xoxp-not-a-bot' }, { ...response, scope: 'chat:write' },
    { ...response, expires_in: 3600 }, { ...response, expires_in: -1, refresh_token: 'bot-refresh' },
  ])('fails closed on an invalid bot installation response %#', async (value) => {
    oauthResult(value);
    await expect(exchangeSlackOAuthCode('invalid-response')).rejects.toThrow(/SLACK_OAUTH_RESPONSE_INVALID|SLACK_REQUIRED_BOT_SCOPES_MISSING/);
    expect(await getDatabase().queryOne('SELECT id FROM slack_connections')).toBeUndefined();
  });
});
