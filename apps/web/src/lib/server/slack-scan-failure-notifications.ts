import crypto from 'node:crypto';
import type { DatabaseAdapter } from './db/types.js';
import { getDatabase } from './db/index.js';
import { logger } from './logger.js';
import { withSqliteClaimLock } from './scan-worker-state.js';
import { isNotificationPreferenceEnabled } from './notification-preferences-service.js';
import { requireRepositoryAccess, requireWorkspaceMember } from './workspace-service.js';
import { isRetryableSlackFailure, SlackApiFailure, slackErrorCategory, slackRetryAt } from './slack-retry.js';
import { sendSlackDmMessage, type SlackMessageConnection } from './slack-notifications.js';
import { isProductionRuntime } from './runtime-mode.js';

const DELIVERY_LEASE_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;

interface ScanFailureDelivery {
  id: string;
  event_key: string;
  workspace_id: string;
  repository_id: string;
  scan_request_id: string;
  slack_connection_id: string;
  failure_category: string;
  status: string;
  attempt_count: number;
}

interface ScanFailureTarget {
  scan_request_id: string;
  workspace_id: string;
  repository_id: string;
  connection_id: string;
  connected_by: string;
}

/**
 * Enqueues one safe, idempotent Slack event for a terminal scan failure.
 * Transient scan retries remain silent until the scan is actually terminal.
 */
export async function enqueueScanFailureNotification(
  scanRequestId: string,
  transaction?: DatabaseAdapter,
): Promise<number> {
  const db = transaction ?? getDatabase();
  const target = await db.queryOne<ScanFailureTarget>(`
    SELECT sr.id AS scan_request_id, sr.workspace_id, sr.repository_id,
           sc.id AS connection_id, sc.connected_by
    FROM github_scan_requests sr
    JOIN repositories r ON r.id = sr.repository_id
      AND r.workspace_id = sr.workspace_id AND r.lifecycle = 'active'
    JOIN slack_connections sc ON sc.workspace_id = sr.workspace_id AND sc.status = 'active'
    WHERE sr.id = ? AND sr.status = 'failed'
  `, [scanRequestId]);
  if (!target || !(await isNotificationPreferenceEnabled(target.connected_by, 'scan_failure', 'slack', db))) return 0;

  const now = new Date().toISOString();
  const failure = await db.queryOne<{ category: string | null }>(
    'SELECT last_error_category AS category FROM github_scan_requests WHERE id = ?', [scanRequestId],
  );
  const eventKey = `${target.workspace_id}:${target.scan_request_id}:scan-failure`;
  const result = await db.execute(`
    INSERT INTO slack_scan_failure_deliveries
      (id, event_key, workspace_id, repository_id, scan_request_id, slack_connection_id,
       failure_category, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(event_key) DO NOTHING
  `, [
    `slsf_${crypto.randomBytes(12).toString('hex')}`,
    eventKey,
    target.workspace_id,
    target.repository_id,
    target.scan_request_id,
    target.connection_id,
    failure?.category || 'SCAN_FAILED',
    now,
    now,
  ]);
  return result.changes;
}

function appUrl(pathname: string): string {
  const base = process.env.APIPROOF_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) throw new Error('APIPROOF_APP_URL_NOT_CONFIGURED');
  const url = new URL(pathname, base);
  if (isProductionRuntime() && url.protocol !== 'https:') throw new Error('SLACK_SCAN_FAILURE_URL_HTTPS_REQUIRED');
  return url.toString();
}

function failureBlocks(input: { repositoryName: string; failureCategory: string; scanUrl: string }): unknown[] {
  return [{
    type: 'section',
    text: {
      type: 'plain_text',
      text: `Scan failed\nRepository: ${input.repositoryName}\nCategory: ${input.failureCategory}`.slice(0, 2900),
      emoji: true,
    },
  }, {
    type: 'actions',
    elements: [{
      type: 'button',
      action_id: 'MYOWL_VIEW_SCAN_FAILURE',
      text: { type: 'plain_text', text: 'Review scan' },
      url: input.scanUrl,
    }],
  }];
}

function safeRepositoryName(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
}

function safeFailureCategory(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80) || 'SCAN_FAILED';
}

async function postScanFailureDelivery(row: ScanFailureDelivery, workerId: string): Promise<void> {
  const db = getDatabase();
  const source = await db.queryOne<{ full_name: string; lifecycle: string }>(`
    SELECT r.full_name, r.lifecycle FROM repositories r
    WHERE r.id = ? AND r.workspace_id = ?
  `, [row.repository_id, row.workspace_id]);
  const connection = await db.queryOne<SlackMessageConnection>(`
    SELECT id, workspace_id, team_id, installer_slack_user_id, token_ciphertext, token_iv,
           token_auth_tag, updated_at, status
    FROM slack_connections WHERE id = ? AND workspace_id = ? AND status = 'active'
  `, [row.slack_connection_id, row.workspace_id]);
  const recipient = await db.queryOne<{ connected_by: string }>(
    'SELECT connected_by FROM slack_connections WHERE id = ? AND workspace_id = ?', [row.slack_connection_id, row.workspace_id],
  );
  if (!source || source.lifecycle !== 'active') throw new Error('SLACK_SCAN_FAILURE_REPOSITORY_UNAVAILABLE');
  if (!connection || !recipient) throw new Error('SLACK_CONNECTION_INACTIVE');

  try {
    await requireWorkspaceMember(recipient.connected_by, row.workspace_id);
    await requireRepositoryAccess(row.repository_id, recipient.connected_by);
  } catch (error) {
    if (error instanceof Error && /not found or access denied|access denied/.test(error.message)) {
      throw new Error('SLACK_DELIVERY_UNAUTHORIZED', { cause: error });
    }
    throw error;
  }
  if (!(await isNotificationPreferenceEnabled(recipient.connected_by, 'scan_failure', 'slack', db))) {
    throw new Error('SLACK_NOTIFICATION_SUPPRESSED');
  }

  const intent = await db.execute(`UPDATE slack_scan_failure_deliveries
    SET post_started_at = ?, lease_expires_at = ?
    WHERE id = ? AND status = 'processing' AND claimed_by = ? AND lease_expires_at > ?`,
  [new Date().toISOString(), new Date(Date.now() + DELIVERY_LEASE_MS).toISOString(), row.id, workerId, new Date().toISOString()]);
  if (intent.changes !== 1) throw new Error('SLACK_SCAN_FAILURE_LEASE_LOST');

  const scanUrl = appUrl(`/dashboard/repositories/${encodeURIComponent(row.repository_id)}`);
  const repositoryName = safeRepositoryName(source.full_name);
  const failureCategory = safeFailureCategory(row.failure_category);
  // Re-read authorization immediately before provider I/O. Queued events can
  // outlive membership, repository access, connection ownership, or opt-out
  // changes made after the event was created.
  const current = await db.queryOne<SlackMessageConnection & { connected_by: string }>(`
    SELECT id, workspace_id, team_id, installer_slack_user_id, token_ciphertext, token_iv,
           token_auth_tag, updated_at, status, connected_by
    FROM slack_connections WHERE id = ? AND workspace_id = ? AND status = 'active'
  `, [row.slack_connection_id, row.workspace_id]);
  if (!current || current.connected_by !== recipient.connected_by) throw new Error('SLACK_DELIVERY_UNAUTHORIZED');
  await requireWorkspaceMember(current.connected_by, row.workspace_id);
  await requireRepositoryAccess(row.repository_id, current.connected_by);
  if (!(await isNotificationPreferenceEnabled(current.connected_by, 'scan_failure', 'slack', db))) {
    throw new Error('SLACK_NOTIFICATION_SUPPRESSED');
  }
  const posted = await sendSlackDmMessage({
    connection: current,
    eventKey: row.event_key,
    text: `Scan failed for ${repositoryName}. Category: ${failureCategory}. Review the scan in MY OWL.`,
    blocks: failureBlocks({ repositoryName, failureCategory, scanUrl }),
  });
  const updated = await db.execute(`UPDATE slack_scan_failure_deliveries
    SET status = 'delivered', slack_channel_id = ?, slack_message_ts = ?, delivered_at = ?,
        updated_at = ?, claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL,
        error_category = NULL, next_attempt_at = NULL
    WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
  [posted.channel, posted.ts, new Date().toISOString(), new Date().toISOString(), row.id, workerId]);
  if (updated.changes !== 1) throw new SlackApiFailure('SLACK_SCAN_FAILURE_LEASE_LOST');
}

export async function processOneSlackScanFailureDelivery(workerId: string): Promise<boolean> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const lease = new Date(Date.now() + DELIVERY_LEASE_MS).toISOString();
  const claim = async () => db.transaction(async (tx) => {
    await tx.execute(`UPDATE slack_scan_failure_deliveries SET status = 'failed', error_category = 'SLACK_ATTEMPTS_EXHAUSTED', updated_at = ? WHERE status = 'pending' AND attempt_count >= ?`, [now, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_scan_failure_deliveries SET status = 'failed', claimed_by = NULL, lease_expires_at = NULL, updated_at = ?, error_category = 'SLACK_DELIVERY_UNCERTAIN' WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NOT NULL`, [now, now]);
    await tx.execute(`UPDATE slack_scan_failure_deliveries SET status = 'pending', claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL, next_attempt_at = ? WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NULL AND attempt_count < ?`, [slackRetryAt(1), now, MAX_ATTEMPTS]);
    const selection = `SELECT d.* FROM slack_scan_failure_deliveries d
      WHERE d.status = 'pending' AND d.attempt_count < ? AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?)
      AND NOT EXISTS (SELECT 1 FROM slack_connections sc WHERE sc.id = d.slack_connection_id AND sc.rate_limit_until > ?)
      ORDER BY d.created_at LIMIT 1`;
    const row = await tx.queryOne<ScanFailureDelivery>(db.engine === 'postgres' ? `${selection} FOR UPDATE SKIP LOCKED` : selection, [MAX_ATTEMPTS, now, now]);
    if (!row) return undefined;
    const claimed = await tx.execute(`UPDATE slack_scan_failure_deliveries SET status = 'processing', claimed_by = ?, lease_expires_at = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'pending'`, [workerId, lease, now, row.id]);
    return claimed.changes === 1 ? { ...row, attempt_count: row.attempt_count + 1 } : undefined;
  });
  const row = db.engine === 'postgres' ? await claim() : await withSqliteClaimLock(claim);
  if (!row) return false;
  try {
    await postScanFailureDelivery(row, workerId);
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
    await db.execute(`UPDATE slack_scan_failure_deliveries SET status = ?, error_category = ?, next_attempt_at = ?, claimed_by = NULL, lease_expires_at = NULL, post_started_at = NULL, updated_at = ? WHERE id = ? AND status = 'processing' AND claimed_by = ?`, [terminal ? 'failed' : 'pending', category, nextAttempt, new Date().toISOString(), row.id, workerId]);
    logger.warn('slack_scan_failure_delivery_failed', { workspaceId: row.workspace_id, deliveryId: row.id, attempt: row.attempt_count, category });
  }
  return true;
}
