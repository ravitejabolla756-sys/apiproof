import { getDatabase } from './db/index.js';
import { createGitHubProposal } from './proposal-service.js';
import { logger } from './logger.js';
import { withSqliteClaimLock } from './scan-worker-state.js';
import { publishVerificationWorkerHeartbeat } from './verification-worker-registry.js';
import { probeDockerVerificationRuntime } from './verification-worker-runtime.js';
import { processOneSlackInteractionJob } from './slack-interactions.js';
import { processOneSlackNotificationDelivery } from './slack-notifications.js';
import { processOneSlackProviderChangeDelivery } from './slack-provider-change-notifications.js';
import { processOneSlackScanFailureDelivery } from './slack-scan-failure-notifications.js';
import { safelyReconcileSlackTerminalOutcomes } from './slack-outcomes.js';
import { processRepositoryRescans } from './repository-rescan-worker.js';

const JOB_LEASE_MS = 15 * 60_000;
const RETRYABLE = new Set(['GITHUB_NETWORK', 'GITHUB_RATE_LIMIT', 'GITHUB_UNAVAILABLE']);

export interface VerificationJob {
  id: string;
  migration_id: string;
  workspace_id: string;
  repository_id: string;
  requested_by: string;
  baseline_sha: string;
  attempt_count: number;
}

async function claimNextJob(workerId: string): Promise<VerificationJob | undefined> {
  const db = getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + JOB_LEASE_MS).toISOString();
  const claim = async () => db.transaction(async (tx) => {
    await tx.execute(`
      UPDATE migration_verification_jobs SET status = 'pending', claimed_by = NULL, lease_expires_at = NULL
      WHERE status = 'processing' AND lease_expires_at < ? AND attempt_count < 3
    `, [nowIso]);
    await tx.execute(`
      UPDATE migration_verification_jobs SET status = 'failed', claimed_by = NULL, lease_expires_at = NULL,
        error_category = 'WORKER_LEASE_EXPIRED', error_message = 'Verification worker lease expired repeatedly.', updated_at = ?
      WHERE status = 'processing' AND lease_expires_at < ? AND attempt_count >= 3
    `, [nowIso, nowIso]);
    await tx.execute(`
      UPDATE migrations SET status = 'verification_failed'
      WHERE id IN (SELECT migration_id FROM migration_verification_jobs WHERE status = 'failed' AND error_category = 'WORKER_LEASE_EXPIRED')
        AND status <> 'pr_created'
    `);
    const job = await tx.queryOne<VerificationJob>(db.engine === 'postgres'
      ? `SELECT id, migration_id, workspace_id, repository_id, requested_by, baseline_sha, attempt_count
         FROM migration_verification_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`
      : `SELECT id, migration_id, workspace_id, repository_id, requested_by, baseline_sha, attempt_count
         FROM migration_verification_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1`);
    if (!job) return undefined;
    await tx.execute(`UPDATE migration_verification_jobs SET status = 'processing', claimed_by = ?, lease_expires_at = ?,
      attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'pending'`,
    [workerId, leaseUntil, nowIso, job.id]);
    return { ...job, attempt_count: job.attempt_count + 1 };
  });
  return db.engine === 'postgres' ? claim() : withSqliteClaimLock(claim);
}

function failureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Docker exit unavailable|Docker CLI unavailable|VERIFICATION_DOCKER_.*UNAVAILABLE/.test(message)) return 'EXECUTION_UNAVAILABLE';
  const category = message.match(/[A-Z][A-Z0-9_]{3,}/)?.[0];
  return category ?? 'VERIFICATION_JOB_FAILED';
}

async function runClaimedJob(job: VerificationJob, workerId: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const leaseHeartbeat = setInterval(() => {
    const now = new Date();
    void db.execute(`UPDATE migration_verification_jobs SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'processing' AND claimed_by = ?`,
      [new Date(now.getTime() + JOB_LEASE_MS).toISOString(), now.toISOString(), job.id, workerId]).catch(() => undefined);
  }, Math.floor(JOB_LEASE_MS / 3));
  leaseHeartbeat.unref?.();
  try {
    const current = await db.queryOne<{ baseline_sha: string | null; scan_sha: string | null; scan_status: string | null; workspace_id: string; repository_id: string; finding_id: string; finding_repository_id: string }>(`
      SELECT m.baseline_sha, s.sha AS scan_sha, s.status AS scan_status, r.workspace_id, m.repository_id,
        f.id AS finding_id, f.repository_id AS finding_repository_id FROM migrations m
      JOIN repositories r ON r.id = m.repository_id
      JOIN findings f ON f.id = m.finding_id
      LEFT JOIN scans s ON s.id = f.scan_id WHERE m.id = ?
    `, [job.migration_id]);
    const currentBaseline = current?.baseline_sha?.trim() || current?.scan_sha?.trim();
    if (!current || !current.finding_id || current.workspace_id !== job.workspace_id || current.repository_id !== job.repository_id || current.finding_repository_id !== job.repository_id || current.scan_status !== 'completed' || currentBaseline !== job.baseline_sha || current.scan_sha !== job.baseline_sha) {
      throw new Error('VERIFICATION_JOB_IDENTITY_MISMATCH');
    }
    const result = await createGitHubProposal(job.migration_id, job.requested_by);
    await db.execute(`UPDATE migration_verification_jobs SET status = 'completed', result_json = ?, error_category = NULL,
      error_message = NULL, claimed_by = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND claimed_by = ?`,
    [JSON.stringify(result), now, job.id, workerId]);
  } catch (error) {
    const category = failureCategory(error);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
    const isUnavailable = category === 'EXECUTION_UNAVAILABLE';
    const canRetry = RETRYABLE.has(category) && job.attempt_count < 3;
    if (isUnavailable) {
      await db.execute("UPDATE migrations SET status = 'verification_unavailable' WHERE id = ? AND status <> 'pr_created'", [job.migration_id]);
    }
    await db.execute(`UPDATE migration_verification_jobs SET status = ?, error_category = ?, error_message = ?,
      claimed_by = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ? AND claimed_by = ?`,
    [isUnavailable ? 'execution_unavailable' : canRetry ? 'pending' : 'failed', category, message, new Date().toISOString(), job.id, workerId]);
    logger.error('migration_verification_job_failed', { jobId: job.id, migrationId: job.migration_id, attempt: job.attempt_count, category, status: isUnavailable ? 'execution_unavailable' : canRetry ? 'pending' : 'failed' });
  } finally {
    clearInterval(leaseHeartbeat);
  }
}

export async function processOneMigrationVerificationJob(workerId: string): Promise<boolean> {
  const job = await claimNextJob(workerId);
  if (!job) return false;
  await runClaimedJob(job, workerId);
  await safelyReconcileSlackTerminalOutcomes();
  return true;
}

export async function runVerificationWorker(options: { workerId: string; pollIntervalMs?: number; signal?: AbortSignal }): Promise<void> {
  const { workerId, signal } = options;
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(workerId)) throw new Error('VERIFICATION_WORKER_ID_INVALID');
  const interval = Math.max(1000, options.pollIntervalMs ?? 5000);
  let lastProbeAt = 0;
  let lastProbeError: unknown;
  let dockerReady = false;
  while (!signal?.aborted) {
    try {
      if (Date.now() - lastProbeAt >= 30_000) {
        try {
          await probeDockerVerificationRuntime();
          lastProbeError = undefined;
          dockerReady = true;
        } catch (error) {
          lastProbeError = error;
          dockerReady = false;
        }
        lastProbeAt = Date.now();
      }
      await publishVerificationWorkerHeartbeat(workerId, dockerReady, lastProbeError instanceof Error ? lastProbeError.message : undefined);
      let processed = false;
      await safelyReconcileSlackTerminalOutcomes();
      try { processed = await processOneSlackInteractionJob(workerId, dockerReady) || processed; }
      catch (error) { logger.warn('slack_interaction_dispatch_failed', { workerId, category: failureCategory(error) }); }
      try { processed = await processOneSlackNotificationDelivery(workerId) || processed; }
      catch (error) { logger.warn('slack_notification_dispatch_failed', { workerId, category: failureCategory(error) }); }
      try { processed = await processOneSlackProviderChangeDelivery(workerId) || processed; }
      catch (error) { logger.warn('slack_provider_change_dispatch_failed', { workerId, category: failureCategory(error) }); }
      try { processed = await processOneSlackScanFailureDelivery(workerId) || processed; }
      catch (error) { logger.warn('slack_scan_failure_dispatch_failed', { workerId, category: failureCategory(error) }); }
      // Approved provider rules and scheduled repository jobs are dispatched by
      // the same trusted worker as migration verification. The cron endpoint
      // remains the enqueue/fallback path, while this drain removes the
      // approval-to-rescan delay during normal operation.
      try {
        const rescans = await processRepositoryRescans({ batchSize: 1, timeoutMs: 50_000 });
        processed = (rescans.jobsClaimed > 0 || rescans.jobsQueued > 0) || processed;
      } catch (error) {
        // A rescan dispatch failure must not make the verification runtime look
        // unavailable. The durable queue retains the job for retry and the
        // scheduled route remains an operational fallback.
        logger.warn('repository_rescan_dispatch_failed', { workerId, category: failureCategory(error) });
      }
      if (dockerReady) {
        processed = await processOneMigrationVerificationJob(workerId) || processed;
      } else if (lastProbeError) {
        logger.warn('migration_verification_worker_docker_unavailable', { workerId, category: failureCategory(lastProbeError) });
      }
      if (!processed) await new Promise((resolve) => setTimeout(resolve, interval));
    } catch (error) {
      const category = failureCategory(error);
      await publishVerificationWorkerHeartbeat(workerId, false, category).catch(() => undefined);
      logger.error('migration_verification_worker_unavailable', { workerId, category });
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
