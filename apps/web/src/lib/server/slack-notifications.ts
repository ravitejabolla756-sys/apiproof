import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { decryptSlackToken, encryptSlackToken, createSlackActionValue, type EncryptedSlackToken, getSlackOAuthConfig } from './slack-security.js';
import { logger } from './logger.js';
import { withSqliteClaimLock } from './scan-worker-state.js';
import { requireSlackFindingAuthorization } from './slack-authorization.js';
import { requireAuthoritativeSlackDraftPr } from './slack-outcomes.js';
import { slackApi, SlackApiFailure, slackErrorCategory, slackRetryAt, isRetryableSlackFailure } from './slack-retry.js';
export { queueSlackInteractionOutcome, queueSlackProposalOutcome } from './slack-outcomes.js';

const DELIVERY_LEASE_MS = 2 * 60_000;
const MAX_ATTEMPTS = 5;
const ACTION_TTL_MS = 30 * 24 * 60 * 60_000;

interface DeliveryRow {
  id: string;
  event_key: string;
  workspace_id: string;
  repository_id: string;
  finding_id: string;
  migration_id: string | null;
  slack_connection_id: string;
  event_type: 'breaking_finding' | 'proposal_result';
  result_state: string | null;
  result_url: string | null;
  status: string;
  attempt_count: number;
}

export async function enqueueNewFindingNotifications(findingIds: string[], transaction?: DatabaseAdapter): Promise<void> {
  if (findingIds.length === 0) return;
  const db = transaction ?? getDatabase();
  const now = new Date().toISOString();
  for (const findingId of [...new Set(findingIds)]) {
    const row = await db.queryOne<{ finding_id: string; repository_id: string; workspace_id: string; status: string; connection_id: string }>(`
      SELECT f.id AS finding_id, f.repository_id, r.workspace_id, f.status, sc.id AS connection_id
      FROM findings f JOIN repositories r ON r.id = f.repository_id
      JOIN slack_connections sc ON sc.workspace_id = r.workspace_id AND sc.status = 'active'
      WHERE f.id = ? AND r.lifecycle = 'active'
    `, [findingId]);
    if (!row || row.status !== 'open') continue;
    const id = `sld_${crypto.randomBytes(12).toString('hex')}`;
    const eventKey = `${row.workspace_id}:${row.finding_id}:breaking-finding`;
    await db.execute(`INSERT INTO slack_notification_deliveries
      (id, event_key, workspace_id, repository_id, finding_id, slack_connection_id, event_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'breaking_finding', 'pending', ?, ?)
      ON CONFLICT(event_key) DO NOTHING`, [id, eventKey, row.workspace_id, row.repository_id, row.finding_id, row.connection_id, now, now]);
    const delivery = await db.queryOne<{ id: string }>('SELECT id FROM slack_notification_deliveries WHERE event_key = ?', [eventKey]);
    if (!delivery) continue;
    const expiresAt = new Date(Date.now() + ACTION_TTL_MS).toISOString();
    for (const action of ['create_pr', 'dismiss'] as const) {
      const actionValue = createSlackActionValue({ deliveryId: delivery.id, action, expiresAt });
      await db.execute(`INSERT INTO slack_action_tokens (id, token_hash, delivery_id, workspace_id, finding_id, action, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(delivery_id, action) DO NOTHING`,
      [`sla_${crypto.randomBytes(12).toString('hex')}`, crypto.createHash('sha256').update(actionValue).digest('hex'), delivery.id, row.workspace_id, findingId, action, expiresAt, now]);
    }
  }
}

function findingBlocks(row: Record<string, unknown>, createPrValue: string, dismissValue: string): unknown[] {
  const detailsUrl = findingUrl(String(row.finding_id));
  const severity = String(row.severity ?? 'unknown').toUpperCase();
  const provider = String(row.provider ?? 'API');
  const location = `${String(row.file_path)}:${String(row.line_number)}`;
  const text = [
    `Breaking change detected (${severity})`,
    `${provider}: ${String(row.title)}`,
    `Repository: ${String(row.full_name)}`,
    `Location: ${location}`,
    String(row.description ?? ''),
  ].filter(Boolean).join('\n');
  return [
    { type: 'section', text: { type: 'plain_text', text: text.slice(0, 2900), emoji: true } },
    { type: 'actions', elements: [
      { type: 'button', action_id: 'MYOWL_CREATE_PR', text: { type: 'plain_text', text: 'Create Draft PR' }, value: createPrValue, style: 'primary' },
      { type: 'button', action_id: 'MYOWL_VIEW_DETAILS', text: { type: 'plain_text', text: 'View Details' }, url: detailsUrl },
      { type: 'button', action_id: 'MYOWL_DISMISS', text: { type: 'plain_text', text: 'Dismiss' }, value: dismissValue, style: 'danger' },
    ] },
  ];
}

function findingUrl(findingId: string): string {
  const base = process.env.APIPROOF_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) throw new Error('APIPROOF_APP_URL_NOT_CONFIGURED');
  const url = new URL(`/dashboard/findings/${encodeURIComponent(findingId)}`, base);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('SLACK_FINDING_URL_HTTPS_REQUIRED');
  return url.toString();
}

async function postDelivery(row: DeliveryRow, workerId: string): Promise<void> {
  const db = getDatabase();
  const { connection, finding, repository } = await requireSlackFindingAuthorization(row);
  let text: string;
  let blocks: unknown[] | undefined;
  let resultUrl: string | null = null;
  let resultState = row.result_state;
  if (row.event_type === 'breaking_finding') {
    if (finding.status !== 'open') throw new Error('SLACK_FINDING_NO_LONGER_AVAILABLE');
    const actions = await db.query<{ action: string; token_hash: string; expires_at: string }>(`SELECT action, token_hash, expires_at
      FROM slack_action_tokens WHERE delivery_id = ? AND consumed_at IS NULL AND expires_at > ?`, [row.id, new Date().toISOString()]);
    const byAction = new Map(actions.map((action) => [action.action, action]));
    const create = byAction.get('create_pr');
    const dismiss = byAction.get('dismiss');
    if (!create || !dismiss) throw new Error('SLACK_ACTION_TOKEN_UNAVAILABLE');
    const createPrValue = createSlackActionValue({ deliveryId: row.id, action: 'create_pr', expiresAt: create.expires_at });
    const dismissValue = createSlackActionValue({ deliveryId: row.id, action: 'dismiss', expiresAt: dismiss.expires_at });
    if (crypto.createHash('sha256').update(createPrValue).digest('hex') !== create.token_hash
      || crypto.createHash('sha256').update(dismissValue).digest('hex') !== dismiss.token_hash) throw new Error('SLACK_ACTION_TOKEN_UNAVAILABLE');
    blocks = findingBlocks({ ...finding, finding_id: finding.id, full_name: repository.full_name }, createPrValue, dismissValue);
    text = `Breaking ${finding.severity.toUpperCase()} change in ${repository.full_name}: ${finding.title}`;
  } else if (row.result_state === 'draft_pr_created' || row.result_state === 'proposal_reconciliation_pending') {
    resultUrl = await requireAuthoritativeSlackDraftPr(row);
    resultState = 'draft_pr_created';
    text = 'Draft PR created.';
    blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `<${resultUrl}|Open the Draft PR>` } }];
  } else {
    if (!['execution_unavailable', 'verification_failed'].includes(row.result_state ?? '')) throw new Error('SLACK_OUTCOME_INVALID');
    // A failed earlier attempt must not claim that no PR exists after a later attempt succeeds.
    if (row.migration_id && await db.queryOne('SELECT id FROM pull_requests WHERE migration_id = ?', [row.migration_id])) {
      throw new Error('SLACK_OUTCOME_SUPERSEDED');
    }
    text = row.result_state === 'execution_unavailable'
      ? 'Verification worker unavailable. No Draft PR was created.'
      : 'Draft PR could not be created. Verification did not pass.';
  }
  let credential = parseSlackCredential(decryptSlackToken({ ciphertext: connection.token_ciphertext, iv: connection.token_iv, authTag: connection.token_auth_tag } satisfies EncryptedSlackToken));
  if (credential.expiresAt && Date.parse(credential.expiresAt) <= Date.now() + 60_000) credential = await refreshSlackCredential(connection, credential);
  // Re-check after async preparation/refresh, before disclosing anything to Slack.
  const assertRecipient = async () => {
    const current = await requireSlackFindingAuthorization(row);
    if (current.connection.connected_by !== connection.connected_by || current.connection.team_id !== connection.team_id
      || current.connection.installer_slack_user_id !== connection.installer_slack_user_id
      || (row.event_type === 'breaking_finding' && current.finding.status !== 'open')) throw new Error('SLACK_DELIVERY_UNAUTHORIZED');
  };
  await assertRecipient();
  const opened = await slackApi<{ channel?: { id?: string } }>(credential.accessToken, 'conversations.open', { users: connection.installer_slack_user_id, return_im: true });
  const channel = opened.channel?.id;
  if (!channel) throw new Error('SLACK_DM_UNAVAILABLE');
  await assertRecipient();
  if (resultState === 'draft_pr_created') await requireAuthoritativeSlackDraftPr(row);
  const digest = crypto.createHash('sha256').update(row.event_key).digest();
  const clientMsgId = `${digest.subarray(0, 4).toString('hex')}-${digest.subarray(4, 6).toString('hex')}-5${digest.subarray(6, 8).toString('hex').slice(1)}-a${digest.subarray(8, 10).toString('hex').slice(1)}-${digest.subarray(10, 16).toString('hex')}`;
  // Persist the send intent BEFORE external I/O; lease recovery must not blindly resend an uncertain post.
  const intent = await db.execute(`UPDATE slack_notification_deliveries SET post_started_at = ?, slack_channel_id = ?
    WHERE id = ? AND status = 'processing' AND claimed_by = ? AND lease_expires_at > ?`,
  [new Date().toISOString(), channel, row.id, workerId, new Date().toISOString()]);
  if (intent.changes !== 1) throw new Error('SLACK_DELIVERY_LEASE_LOST');
  let posted: { channel?: string; ts?: string };
  try {
    posted = await slackApi(credential.accessToken, 'chat.postMessage', {
      channel, text, blocks, client_msg_id: clientMsgId, unfurl_links: false, unfurl_media: false,
    });
    if (posted.channel !== channel || !posted.ts) throw new Error('SLACK_MESSAGE_RESULT_INVALID');
  } catch (error) {
    const code = slackErrorCategory(error);
    if (/^(SLACK_NETWORK_FAILED|SLACK_RESPONSE_INVALID|SLACK_MESSAGE_RESULT_INVALID|SLACK_HTTP_5\d\d|SLACK_API_(INTERNAL_ERROR|FATAL_ERROR|SERVICE_UNAVAILABLE))$/.test(code)) {
      throw new SlackApiFailure('SLACK_DELIVERY_UNCERTAIN');
    }
    await db.execute(`UPDATE slack_notification_deliveries SET post_started_at = NULL WHERE id = ? AND status = 'processing' AND claimed_by = ?`, [row.id, workerId]);
    throw error;
  }
  try {
    const updated = await db.execute(`UPDATE slack_notification_deliveries SET status = 'delivered', slack_channel_id = ?, slack_message_ts = ?,
      delivered_at = ?, updated_at = ?, claimed_by = NULL, lease_expires_at = NULL, error_category = NULL,
      result_state = ?, result_url = ?, next_attempt_at = NULL
      WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
    [posted.channel, posted.ts, new Date().toISOString(), new Date().toISOString(), resultState, resultUrl, row.id, workerId]);
    if (updated.changes !== 1) throw new Error('SLACK_DELIVERY_LEASE_LOST');
  } catch { throw new SlackApiFailure('SLACK_DELIVERY_UNCERTAIN'); }
}

interface SlackCredential { accessToken: string; refreshToken?: string; expiresAt?: string }

function parseSlackCredential(serialized: string): SlackCredential {
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('SLACK_TOKEN_ENVELOPE_INVALID'); }
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).accessToken !== 'string') {
    throw new Error('SLACK_TOKEN_ENVELOPE_INVALID');
  }
  return value as SlackCredential;
}

async function refreshSlackCredential(
  connection: { id: string; token_ciphertext: string; token_iv: string; token_auth_tag: string; updated_at: string },
  current: SlackCredential,
): Promise<SlackCredential> {
  if (!current.refreshToken) throw new Error('SLACK_ACCESS_TOKEN_EXPIRED');
  const config = getSlackOAuthConfig();
  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  let response: Response;
  try {
    response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST', headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new SlackApiFailure('SLACK_NETWORK_FAILED', true); }
  if (!response.ok) {
    const seconds = Number(response.headers.get('Retry-After'));
    throw new SlackApiFailure(`SLACK_HTTP_${response.status}`, response.status === 429 || response.status >= 500,
      Number.isFinite(seconds) && seconds > 0 && seconds <= 31_536_000 ? seconds * 1000 : 0);
  }
  const result = await response.json() as { ok?: boolean; access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!result.ok || typeof result.access_token !== 'string' || !/^(xoxb-|xoxe\.xoxb-)/.test(result.access_token)
    || !result.refresh_token || !Number.isSafeInteger(result.expires_in) || !result.expires_in || result.expires_in <= 0 || result.expires_in > 31_536_000) {
    throw new Error('SLACK_TOKEN_REFRESH_INVALID');
  }
  const refreshed: SlackCredential = {
    accessToken: result.access_token,
    ...(result.refresh_token ? { refreshToken: result.refresh_token } : {}),
    ...(typeof result.expires_in === 'number' && result.expires_in > 0 ? { expiresAt: new Date(Date.now() + result.expires_in * 1000).toISOString() } : {}),
  };
  const encrypted = encryptSlackToken(JSON.stringify(refreshed));
  const db = getDatabase();
  const updated = await db.execute(`UPDATE slack_connections SET token_ciphertext = ?, token_iv = ?, token_auth_tag = ?, updated_at = ?
    WHERE id = ? AND updated_at = ? AND status = 'active'`, [encrypted.ciphertext, encrypted.iv, encrypted.authTag, new Date().toISOString(), connection.id, connection.updated_at]);
  if (updated.changes === 1) return refreshed;
  const latest = await db.queryOne<{ token_ciphertext: string; token_iv: string; token_auth_tag: string; status: string }>(
    'SELECT token_ciphertext, token_iv, token_auth_tag, status FROM slack_connections WHERE id = ?', [connection.id]);
  if (!latest || latest.status !== 'active') throw new Error('SLACK_CONNECTION_INACTIVE');
  return parseSlackCredential(decryptSlackToken({ ciphertext: latest.token_ciphertext, iv: latest.token_iv, authTag: latest.token_auth_tag }));
}

export async function processOneSlackNotificationDelivery(workerId: string): Promise<boolean> {
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  const lease = new Date(Date.now() + DELIVERY_LEASE_MS).toISOString();
  const claim = async () => db.transaction(async (tx) => {
    await tx.execute(`UPDATE slack_notification_deliveries SET status = 'failed', error_category = 'SLACK_ATTEMPTS_EXHAUSTED',
      updated_at = ? WHERE status = 'pending' AND attempt_count >= ?`, [nowIso, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_notification_deliveries SET status = 'failed', error_category = 'SLACK_DELIVERY_UNCERTAIN',
      claimed_by = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NOT NULL`, [nowIso, nowIso]);
    await tx.execute(`UPDATE slack_notification_deliveries SET status = 'pending', next_attempt_at = ?, claimed_by = NULL, lease_expires_at = NULL
      WHERE status = 'processing' AND lease_expires_at < ? AND post_started_at IS NULL AND attempt_count < ?`, [slackRetryAt(1), nowIso, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_notification_deliveries SET status = 'failed', claimed_by = NULL, lease_expires_at = NULL,
      error_category = 'DELIVERY_LEASE_EXPIRED', updated_at = ? WHERE status = 'processing' AND lease_expires_at < ? AND attempt_count >= ?`, [nowIso, nowIso, MAX_ATTEMPTS]);
    const selection = `SELECT d.* FROM slack_notification_deliveries d
      WHERE d.status = 'pending' AND d.attempt_count < ? AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= ?)
      AND NOT EXISTS (SELECT 1 FROM slack_connections sc WHERE sc.id = d.slack_connection_id AND sc.rate_limit_until > ?)
      ORDER BY d.created_at LIMIT 1`;
    const row = await tx.queryOne<DeliveryRow>(db.engine === 'postgres' ? selection + ' FOR UPDATE SKIP LOCKED' : selection, [MAX_ATTEMPTS, nowIso, nowIso]);
    if (!row) return undefined;
    const claimed = await tx.execute(`UPDATE slack_notification_deliveries SET status = 'processing', claimed_by = ?, lease_expires_at = ?,
      attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'pending'`, [workerId, lease, nowIso, row.id]);
    return claimed.changes === 1 ? { ...row, attempt_count: row.attempt_count + 1 } : undefined;
  });
  const row = db.engine === 'postgres' ? await claim() : await withSqliteClaimLock(claim);
  if (!row) return false;
  try { await postDelivery(row, workerId); }
  catch (error) {
    const code = slackErrorCategory(error);
    const terminal = row.attempt_count >= MAX_ATTEMPTS || !isRetryableSlackFailure(error);
    const nextAttempt = terminal ? null : slackRetryAt(row.attempt_count, error instanceof SlackApiFailure ? error.retryAfterMs : 0);
    if (error instanceof SlackApiFailure && (code === 'SLACK_HTTP_429' || /RATELIMITED|RATE_LIMITED/.test(code))) {
      const cooldown = nextAttempt ?? slackRetryAt(row.attempt_count, error.retryAfterMs);
      await db.execute(`UPDATE slack_connections SET rate_limit_until = ? WHERE id = ? AND workspace_id = ?
        AND (rate_limit_until IS NULL OR rate_limit_until < ?)`, [cooldown, row.slack_connection_id, row.workspace_id, cooldown]);
    }
    await db.execute(`UPDATE slack_notification_deliveries SET status = ?, error_category = ?, next_attempt_at = ?, claimed_by = NULL,
      lease_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
    [terminal ? 'failed' : 'pending', code, nextAttempt, new Date().toISOString(), row.id, workerId]);
    logger.warn('slack_notification_delivery_failed', { workspaceId: row.workspace_id, deliveryId: row.id, attempt: row.attempt_count, category: code });
  }
  return true;
}
