import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import { requireSlackFindingAuthorization } from './slack-authorization.js';
import { withSqliteClaimLock } from './scan-worker-state.js';
import { verifySlackActionValue, hashSlackOpaqueValue } from './slack-security.js';
import { hasReadyVerificationWorker } from './verification-worker-registry.js';
import { generateMigrationForFinding } from './planning-service.js';
import { enqueueMigrationProposal } from './proposal-verification-jobs.js';
import { safelyReconcileSlackTerminalOutcomes } from './slack-outcomes.js';
import { isRetryableSlackFailure, slackErrorCategory, slackRetryAt } from './slack-retry.js';
import { logger } from './logger.js';
import { assertCurrentWorkspaceMembership } from './workspace-service.js';

const INTERACTION_LEASE_MS = 2 * 60_000;
const MAX_ATTEMPTS = 3;

export interface SlackActionRequest {
  requestHash: string;
  actionId: string;
  actionValue: string;
  teamId: string;
  slackUserId: string;
}

export interface SlackActionAck { accepted: boolean; text: string }

export async function acceptSlackAction(input: SlackActionRequest): Promise<SlackActionAck> {
  const db = getDatabase();
  const previouslyAccepted = await db.queryOne<{ id: string }>(
    'SELECT id FROM slack_interaction_jobs WHERE request_hash = ?', [input.requestHash],
  );
  if (previouslyAccepted) return { accepted: true, text: 'This request was already received. MY OWL will send an update when it finishes.' };
  const action = verifySlackActionValue(input.actionValue);
  const actionFromId = input.actionId === 'MYOWL_CREATE_PR' ? 'create_pr' : input.actionId === 'MYOWL_DISMISS' ? 'dismiss' : null;
  if (!action || !actionFromId || action.action !== actionFromId) return { accepted: false, text: 'This MY OWL action is invalid or has expired.' };
  const tokenHash = hashSlackOpaqueValue(input.actionValue);
  const tokenRow = await db.queryOne<{
    id: string; delivery_id: string; workspace_id: string; finding_id: string; action: string; expires_at: string; consumed_at: string | null;
    repository_id: string; connection_id: string; team_id: string; installer_slack_user_id: string; connected_by: string; connection_status: string;
    delivery_status: string; finding_status: string;
  }>(`
    SELECT at.id, at.delivery_id, at.workspace_id, at.finding_id, at.action, at.expires_at, at.consumed_at,
      d.repository_id, d.slack_connection_id AS connection_id, d.status AS delivery_status,
      sc.team_id, sc.installer_slack_user_id, sc.connected_by, sc.status AS connection_status, f.status AS finding_status
    FROM slack_action_tokens at
    JOIN slack_notification_deliveries d ON d.id = at.delivery_id AND d.workspace_id = at.workspace_id AND d.finding_id = at.finding_id
    JOIN slack_connections sc ON sc.id = d.slack_connection_id AND sc.workspace_id = d.workspace_id
    JOIN findings f ON f.id = d.finding_id AND f.repository_id = d.repository_id
    JOIN repositories r ON r.id = f.repository_id AND r.workspace_id = d.workspace_id AND r.lifecycle = 'active'
    WHERE at.token_hash = ? AND at.delivery_id = ? AND at.action = ?`,
  [tokenHash, action.deliveryId, action.action]);
  if (!tokenRow || tokenRow.connection_status !== 'active' || tokenRow.delivery_status !== 'delivered'
    || tokenRow.finding_status !== 'open' || tokenRow.team_id !== input.teamId
    || tokenRow.installer_slack_user_id !== input.slackUserId || tokenRow.expires_at !== action.expiresAt
    || tokenRow.consumed_at || Date.parse(tokenRow.expires_at) <= Date.now()) {
    return { accepted: false, text: 'This finding action is no longer available.' };
  }

  try {
    const access = await requireSlackFindingAuthorization({ slack_connection_id: tokenRow.connection_id, ...tokenRow });
    if (access.connection.connected_by !== tokenRow.connected_by) {
      return { accepted: false, text: 'This finding is not available to the connected MY OWL workspace.' };
    }
  } catch {
    return { accepted: false, text: 'This finding is not available to the connected MY OWL workspace.' };
  }

  if (action.action === 'create_pr' && !await hasReadyVerificationWorker()) {
    return { accepted: false, text: 'Verification worker unavailable. No Draft PR was created. Try again when secure verification is online.' };
  }

  const now = new Date().toISOString();
  if (action.action === 'dismiss') {
    const result = await db.transaction(async (tx) => {
      const consumed = await tx.execute(`UPDATE slack_action_tokens SET consumed_at = ?
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`, [now, tokenRow.id, now]);
      if (consumed.changes !== 1) return false;
      await tx.execute(`INSERT INTO slack_notification_dismissals (id, delivery_id, user_id, created_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(delivery_id, user_id) DO NOTHING`,
      [`sldm_${crypto.randomBytes(12).toString('hex')}`, tokenRow.delivery_id, tokenRow.connected_by, now]);
      await tx.execute(`INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, 'slack_finding_dismissed', 'Finding Alert Dismissed', 'Dismissed this Slack finding alert for the connected user only.', ?)`,
      [`act_${crypto.randomBytes(10).toString('hex')}`, tokenRow.connected_by, tokenRow.repository_id, now]);
      return true;
    });
    return { accepted: result, text: result ? 'Finding alert dismissed for your connected MY OWL account.' : 'This finding alert was already handled.' };
  }

  const requestHash = input.requestHash;
  try {
    await db.transaction(async (tx) => {
      const consumed = await tx.execute(`UPDATE slack_action_tokens SET consumed_at = ?
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ?`, [now, tokenRow.id, now]);
      if (consumed.changes !== 1) throw new Error('SLACK_ACTION_ALREADY_HANDLED');
      await tx.execute(`INSERT INTO slack_interaction_jobs
        (id, request_hash, action_token_id, delivery_id, workspace_id, repository_id, finding_id, slack_connection_id,
         user_id, slack_user_id, team_id, action, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'create_pr', 'pending', ?, ?)` ,
      [`sli_${crypto.randomBytes(12).toString('hex')}`, requestHash, tokenRow.id, tokenRow.delivery_id, tokenRow.workspace_id,
        tokenRow.repository_id, tokenRow.finding_id, tokenRow.connection_id, tokenRow.connected_by, input.slackUserId, input.teamId, now, now]);
    });
  } catch (error) {
    const duplicate = await db.queryOne<{ id: string }>('SELECT id FROM slack_interaction_jobs WHERE request_hash = ?', [requestHash]);
    if (duplicate) return { accepted: true, text: 'This request was already received. MY OWL will send an update when it finishes.' };
    return { accepted: false, text: error instanceof Error && error.message === 'SLACK_ACTION_ALREADY_HANDLED'
      ? 'This finding action was already handled.' : 'MY OWL could not queue this action. No Draft PR was created.' };
  }
  return { accepted: true, text: 'Request received. Secure verification is starting; MY OWL will message you with the result.' };
}

interface InteractionJob {
  id: string;
  delivery_id: string;
  workspace_id: string;
  repository_id: string;
  finding_id: string;
  slack_connection_id: string;
  user_id: string;
  slack_user_id: string;
  team_id: string;
  action: string;
  attempt_count: number;
}

async function claimInteraction(workerId: string): Promise<InteractionJob | undefined> {
  const db = getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const lease = new Date(now.getTime() + INTERACTION_LEASE_MS).toISOString();
  const claim = async () => db.transaction(async (tx) => {
    await tx.execute(`UPDATE slack_interaction_jobs SET status = 'failed', error_category = 'SLACK_ATTEMPTS_EXHAUSTED',
      updated_at = ? WHERE status = 'pending' AND attempt_count >= ?`, [nowIso, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_interaction_jobs SET status = 'pending', next_attempt_at = ?, claimed_by = NULL, lease_expires_at = NULL
      WHERE status = 'processing' AND lease_expires_at < ? AND attempt_count < ?`, [slackRetryAt(1), nowIso, MAX_ATTEMPTS]);
    await tx.execute(`UPDATE slack_interaction_jobs SET status = 'failed', error_category = 'INTERACTION_LEASE_EXPIRED',
      claimed_by = NULL, lease_expires_at = NULL, updated_at = ? WHERE status = 'processing' AND lease_expires_at < ? AND attempt_count >= ?`, [nowIso, nowIso, MAX_ATTEMPTS]);
    const selection = `SELECT * FROM slack_interaction_jobs WHERE status = 'pending' AND attempt_count < ?
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at LIMIT 1`;
    const row = await tx.queryOne<InteractionJob>(db.engine === 'postgres' ? selection + ' FOR UPDATE SKIP LOCKED' : selection, [MAX_ATTEMPTS, nowIso]);
    if (!row) return undefined;
    const claimed = await tx.execute(`UPDATE slack_interaction_jobs SET status = 'processing', claimed_by = ?, lease_expires_at = ?,
      attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'pending'`, [workerId, lease, nowIso, row.id]);
    return claimed.changes === 1 ? { ...row, attempt_count: row.attempt_count + 1 } : undefined;
  });
  return db.engine === 'postgres' ? claim() : withSqliteClaimLock(claim);
}

async function recordJob(job: InteractionJob, workerId: string, fields: { status: 'completed' | 'failed' | 'pending'; migrationId?: string; category?: string }): Promise<void> {
  const result = await getDatabase().execute(`UPDATE slack_interaction_jobs SET status = ?, migration_id = COALESCE(?, migration_id), error_category = ?,
    next_attempt_at = ?, claimed_by = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND claimed_by = ? AND status = 'processing'`,
  [fields.status, fields.migrationId ?? null, fields.category ?? null, fields.status === 'pending' ? slackRetryAt(job.attempt_count) : null,
    new Date().toISOString(), job.id, workerId]);
  if (result.changes !== 1) throw new Error('SLACK_INTERACTION_LEASE_LOST');
}

async function bindMigrationToInteraction(job: InteractionJob, workerId: string, migrationId: string): Promise<void> {
  const result = await getDatabase().execute(`UPDATE slack_interaction_jobs SET migration_id = ?, updated_at = ?
    WHERE id = ? AND claimed_by = ? AND status = 'processing'`, [migrationId, new Date().toISOString(), job.id, workerId]);
  if (result.changes !== 1) throw new Error('SLACK_INTERACTION_LEASE_LOST');
}

export async function processOneSlackInteractionJob(workerId: string, dockerReady: boolean): Promise<boolean> {
  const job = await claimInteraction(workerId);
  if (!job) return false;
  let migrationId: string | undefined;
  const heartbeat = setInterval(() => {
    void getDatabase().execute(`UPDATE slack_interaction_jobs SET lease_expires_at = ? WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
      [new Date(Date.now() + INTERACTION_LEASE_MS).toISOString(), job.id, workerId]).catch(() => undefined);
  }, Math.floor(INTERACTION_LEASE_MS / 3));
  heartbeat.unref?.();
  try {
    const db = getDatabase();
    await assertCurrentWorkspaceMembership(job.user_id, job.workspace_id);
    const { connection: identity } = await requireSlackFindingAuthorization(job);
    if (identity.connected_by !== job.user_id || identity.team_id !== job.team_id || identity.installer_slack_user_id !== job.slack_user_id) {
      throw new Error('SLACK_ACTION_CONNECTION_MISMATCH');
    }
    if (job.action !== 'create_pr') throw new Error('SLACK_ACTION_UNSUPPORTED');
    if (!dockerReady || !await hasReadyVerificationWorker()) {
      await recordJob(job, workerId, { status: 'completed', category: 'VERIFICATION_EXECUTION_UNAVAILABLE' });
      return true;
    }
    let migration = await db.queryOne<{ id: string }>(`SELECT id FROM migrations WHERE finding_id = ? AND repository_id = ? ORDER BY created_at DESC LIMIT 1`, [job.finding_id, job.repository_id]);
    if (!migration) {
      const created = await generateMigrationForFinding(job.finding_id, job.user_id);
      migration = { id: created.id };
    }
    migrationId = migration.id;
    await bindMigrationToInteraction(job, workerId, migrationId);
    const proposal = await enqueueMigrationProposal(migrationId, job.user_id);
    if (proposal.status === 'execution_unavailable') {
      await recordJob(job, workerId, { status: 'completed', migrationId, category: 'VERIFICATION_EXECUTION_UNAVAILABLE' });
      return true;
    }
    await recordJob(job, workerId, { status: 'completed', migrationId,
      ...(proposal.status === 'completed' ? { category: 'SLACK_PROPOSAL_COMPLETED' } : {}) });
  } catch (error) {
    const category = slackErrorCategory(error);
    const retry = job.attempt_count < MAX_ATTEMPTS && isRetryableSlackFailure(error);
    await recordJob(job, workerId, { status: retry ? 'pending' : 'failed', ...(migrationId ? { migrationId } : {}), category });
    logger.warn('slack_interaction_job_failed', { interactionJobId: job.id, workspaceId: job.workspace_id, category });
  } finally {
    clearInterval(heartbeat);
    await safelyReconcileSlackTerminalOutcomes();
  }
  return true;
}
