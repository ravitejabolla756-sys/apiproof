import crypto from 'node:crypto';
import type { DatabaseAdapter } from './db/types.js';
import { getDatabase } from './db/index.js';
import { logger } from './logger.js';
import { withSqliteClaimLock } from './scan-worker-state.js';
import { isRetryableSlackFailure, SlackApiFailure, slackErrorCategory, slackRetryAt } from './slack-retry.js';
import { sendSlackDmMessage, type SlackMessageConnection } from './slack-notifications.js';

const DELIVERY_LEASE_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;

type ProviderChangeDelivery = {
  id: string;
  event_key: string;
  workspace_id: string;
  changelog_entry_id: string;
  slack_connection_id: string;
  status: string;
  attempt_count: number;
};

/**
 * Creates one idempotent Slack outbox row per affected workspace. A workspace
 * is eligible only when an active repository-provider usage record proves that
 * it actually uses the provider; merely connecting Slack never creates noise.
 */
export async function enqueueProviderChangeSlackNotifications(
  changelogEntryIds: readonly string[],
  transaction?: DatabaseAdapter,
): Promise<number> {
  const ids = [...new Set(changelogEntryIds)].filter(Boolean);
  if (ids.length === 0) return 0;
  const db = transaction ?? getDatabase();
  const now = new Date().toISOString();
  let inserted = 0;
  for (const entryId of ids) {
    const targets = await db.query<{ workspace_id: string; connection_id: string }>(`
      SELECT DISTINCT r.workspace_id, sc.id AS connection_id
      FROM provider_changelog_entries e
      JOIN repository_provider_usage u ON u.provider_id = e.provider_id
      JOIN repositories r ON r.id = u.repository_id AND r.workspace_id = u.workspace_id AND r.lifecycle = 'active'
      JOIN slack_connections sc ON sc.workspace_id = r.workspace_id AND sc.status = 'active'
      WHERE e.id = ?
    `, [entryId]);
    for (const target of targets) {
      const eventKey = `${target.workspace_id}:${entryId}:provider-change`;
      const result = await db.execute(`
        INSERT INTO slack_provider_change_deliveries
          (id, event_key, workspace_id, changelog_entry_id, slack_connection_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT(event_key) DO NOTHING
      `, [`slpc_${crypto.randomBytes(12).toString('hex')}`, eventKey, target.workspace_id, entryId, target.connection_id, now, now]);
      inserted += result.changes;
    }
  }
  return inserted;
}

function providerChangeBlocks(row: { provider_id: string; title: string; description: string; source_url: string }): unknown[] {
  return [
    { type: 'section', text: { type: 'plain_text', text: `Provider change detected: ${row.provider_id}\n${row.title}\n${row.description}`.slice(0, 2900), emoji: true } },
    { type: 'actions', elements: [{ type: 'button', action_id: 'MYOWL_VIEW_PROVIDER_SOURCE', text: { type: 'plain_text', text: 'Open Official Source' }, url: row.source_url }] },
  ];
}

async function postProviderChangeDelivery(row: ProviderChangeDelivery, workerId: string): Promise<void> {
  const db = getDatabase();
  const source = await db.queryOne<{ provider_id: string; title: string; description: string; source_url: string }>(`
    SELECT provider_id, title, description, source_url FROM provider_changelog_entries WHERE id = ?
  `, [row.changelog_entry_id]);
  const connection = await db.queryOne<SlackMessageConnection>(`
    SELECT id, workspace_id, connected_by, team_id, installer_slack_user_id, token_ciphertext, token_iv,
           token_auth_tag, updated_at, status
    FROM slack_connections WHERE id = ? AND workspace_id = ? AND status = 'active'
  `, [row.slack_connection_id, row.workspace_id]);
  if (!source) throw new Error('SLACK_PROVIDER_CHANGE_SOURCE_MISSING');
  if (!connection) throw new Error('SLACK_CONNECTION_INACTIVE');
  const ownerMembership = await db.queryOne<{ id: string }>(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [connection.workspace_id, connection.connected_by],
  );
  if (!ownerMembership) throw new Error('SLACK_CONNECTION_OWNER_REVOKED');

  const intent = await db.execute(`UPDATE slack_provider_change_deliveries
    SET post_started_at = ?, lease_expires_at = ?
    WHERE id = ? AND status = 'processing' AND claimed_by = ? AND lease_expires_at > ?`,
  [new Date().toISOString(), new Date(Date.now() + DELIVERY_LEASE_MS).toISOString(), row.id, workerId, new Date().toISOString()]);
  if (intent.changes !== 1) throw new Error('SLACK_PROVIDER_CHANGE_LEASE_LOST');

  const posted = await sendSlackDmMessage({
    connection,
    eventKey: row.event_key,
    text: `Provider change detected for ${source.provider_id}: ${source.title}. A review candidate was created; no production rule was activated.`,
    blocks: providerChangeBlocks(source),
  });
  const updated = await db.execute(`UPDATE slack_provider_change_deliveries
    SET status = 'delivered', slack_channel_id = ?, slack_message_ts = ?, delivered_at = ?,
        updated_at = ?, claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL,
        error_category = NULL, next_attempt_at = NULL
    WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
  [posted.channel, posted.ts, new Date().toISOString(), new Date().toISOString(), row.id, workerId]);
  if (updated.changes !== 1) throw new SlackApiFailure('SLACK_PROVIDER_CHANGE_LEASE_LOST');
}

export async function processOneSlackProviderChangeDelivery(workerId: string): Promise<boolean> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const lease = new Date(Date.now() + DELIVERY_LEASE_MS).toISOString();
  const claim = async () => db.transaction(async (tx) => {
    await tx.execute(`UPDATE slack_provider_change_deliveries SET status = 'failed', error_category = 'SLACK_ATTEMPTS_EXHAUSTED', updated_at = ? WHERE status = 'pending' AND attempt_count >= ?`, [now, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_provider_change_deliveries SET status = 'failed', claimed_by = NULL, lease_expires_at = NULL, updated_at = ?, error_category = 'SLACK_DELIVERY_UNCERTAIN' WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NOT NULL`, [now, now]);
    await tx.execute(`UPDATE slack_provider_change_deliveries SET status = 'pending', claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL, next_attempt_at = ? WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NULL AND attempt_count < ?`, [slackRetryAt(1), now, MAX_ATTEMPTS]);
    const row = await tx.queryOne<ProviderChangeDelivery>(`SELECT d.* FROM slack_provider_change_deliveries d
      WHERE d.status = 'pending' AND d.attempt_count < ? AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?)
      AND NOT EXISTS (SELECT 1 FROM slack_connections sc WHERE sc.id = d.slack_connection_id AND sc.rate_limit_until > ?)
      ORDER BY d.created_at LIMIT 1`, [MAX_ATTEMPTS, now, now]);
    if (!row) return undefined;
    const claimed = await tx.execute(`UPDATE slack_provider_change_deliveries SET status = 'processing', claimed_by = ?, lease_expires_at = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'pending'`, [workerId, lease, now, row.id]);
    return claimed.changes === 1 ? { ...row, attempt_count: row.attempt_count + 1 } : undefined;
  });
  const row = db.engine === 'postgres' ? await claim() : await withSqliteClaimLock(claim);
  if (!row) return false;
  try {
    await postProviderChangeDelivery(row, workerId);
  } catch (error) {
    const code = slackErrorCategory(error);
    if (error instanceof SlackApiFailure && (code === 'SLACK_HTTP_429' || /RATELIMITED|RATE_LIMITED/.test(code))) {
      const cooldown = slackRetryAt(row.attempt_count, error.retryAfterMs);
      await db.execute(`UPDATE slack_connections SET rate_limit_until = ? WHERE id = ? AND workspace_id = ?
        AND (rate_limit_until IS NULL OR rate_limit_until < ?)`, [cooldown, row.slack_connection_id, row.workspace_id, cooldown]);
    }
    const uncertain = /^(SLACK_NETWORK_FAILED|SLACK_RESPONSE_INVALID|SLACK_MESSAGE_RESULT_INVALID|SLACK_HTTP_5\d\d|SLACK_API_(INTERNAL_ERROR|FATAL_ERROR|SERVICE_UNAVAILABLE))$/.test(code);
    const terminal = row.attempt_count >= MAX_ATTEMPTS || !isRetryableSlackFailure(error) || uncertain;
    const nextAttempt = terminal ? null : slackRetryAt(row.attempt_count, error instanceof SlackApiFailure ? error.retryAfterMs : 0);
    const category = uncertain ? 'SLACK_DELIVERY_UNCERTAIN' : code;
    await db.execute(`UPDATE slack_provider_change_deliveries SET status = ?, error_category = ?, next_attempt_at = ?, claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL, updated_at = ? WHERE id = ? AND status = 'processing' AND claimed_by = ?`, [terminal ? 'failed' : 'pending', category, nextAttempt, new Date().toISOString(), row.id, workerId]);
    logger.warn('slack_provider_change_delivery_failed', { workspaceId: row.workspace_id, deliveryId: row.id, attempt: row.attempt_count, category });
  }
  return true;
}
