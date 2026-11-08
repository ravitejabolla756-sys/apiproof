import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { processPendingGitHubScans } from './scan-worker.js';
import { createWorkspaceGitHubSourceControlProvider } from './github.js';

type RescanJob = {
  id: string;
  workspace_id: string;
  repository_id: string;
  reason: string;
  status: string;
  attempt_count: number;
  scan_request_id: string | null;
};

const LEASE_MS = 10 * 60 * 1000;
const NIGHTLY_REASON = 'nightly_rescan';
const PROVIDER_SOURCE_CHANGE_REASON = 'provider_source_changed';

/**
 * Re-queues existing approved rules when an authoritative provider source
 * changes. This is intentionally separate from candidate approval: the new
 * source evidence still remains review-only, while already-approved rules can
 * safely be re-evaluated against repositories known to use that provider.
 */
export async function enqueueProviderSourceChangeRescans(
  tx: DatabaseAdapter,
  providerId: string,
  now: string,
): Promise<number> {
  const targets = await tx.query<{ repository_id: string; workspace_id: string; rule_candidate_id: string }>(`
    SELECT DISTINCT r.id AS repository_id, r.workspace_id, c.id AS rule_candidate_id
    FROM repositories r
    JOIN repository_provider_usage usage
      ON usage.repository_id = r.id
     AND usage.workspace_id = r.workspace_id
     AND usage.provider_id = ?
    JOIN provider_rule_candidates c
      ON c.provider_id = usage.provider_id
     AND c.status = 'approved'
     AND (c.workspace_id IS NULL OR c.workspace_id = r.workspace_id)
    WHERE r.lifecycle = 'active'
      AND r.status IN ('connected', 'healthy', 'affected')
  `, [providerId]);

  let queued = 0;
  for (const target of targets) {
    const existing = await tx.queryOne<{ id: string; status: string }>(`
      SELECT id, status
      FROM provider_rescan_jobs
      WHERE repository_id = ? AND rule_candidate_id = ?
    `, [target.repository_id, target.rule_candidate_id]);
    if (existing) {
      if (!['completed', 'failed'].includes(existing.status)) continue;
      const updated = await tx.execute(`
        UPDATE provider_rescan_jobs
        SET reason = ?, status = 'pending', attempt_count = 0, scan_request_id = NULL,
            claimed_at = NULL, lease_expires_at = NULL,
            last_error_code = NULL, last_error_message = NULL, updated_at = ?
        WHERE id = ? AND status IN ('completed', 'failed')
      `, [PROVIDER_SOURCE_CHANGE_REASON, now, existing.id]);
      queued += updated.changes;
      continue;
    }
    const inserted = await tx.execute(`
      INSERT INTO provider_rescan_jobs
        (id, workspace_id, repository_id, rule_candidate_id, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [`prs_${crypto.randomBytes(12).toString('hex')}`, target.workspace_id, target.repository_id, target.rule_candidate_id, PROVIDER_SOURCE_CHANGE_REASON, now, now]);
    queued += inserted.changes;
  }
  return queued;
}

/**
 * Ensures a provider source update still triggers a full repository scan when
 * there is no approved database-backed rule to fan out. Static reviewed rules
 * are evaluated by the normal multi-provider scan, so this job deliberately
 * uses the repository-level queue instead of inventing a candidate rule.
 * Repositories already covered by an approved-rule job are excluded to avoid
 * duplicate work for the same source update.
 */
export async function enqueueRepositoryProviderSourceChangeRescans(
  tx: DatabaseAdapter,
  providerId: string,
  now: string,
): Promise<number> {
  const targets = await tx.query<{ repository_id: string; workspace_id: string }>(`
    SELECT DISTINCT r.id AS repository_id, r.workspace_id
    FROM repositories r
    JOIN repository_provider_usage usage
      ON usage.repository_id = r.id
     AND usage.workspace_id = r.workspace_id
     AND usage.provider_id = ?
    WHERE r.lifecycle = 'active'
      AND r.status IN ('connected', 'healthy', 'affected')
      AND NOT EXISTS (
        SELECT 1
        FROM provider_rule_candidates c
        WHERE c.provider_id = usage.provider_id
          AND c.status = 'approved'
          AND (c.workspace_id IS NULL OR c.workspace_id = r.workspace_id)
      )
  `, [providerId]);

  let queued = 0;
  for (const target of targets) {
    const existing = await tx.queryOne<{ id: string; status: string }>(`
      SELECT id, status
      FROM repository_rescan_jobs
      WHERE repository_id = ? AND reason = ?
    `, [target.repository_id, PROVIDER_SOURCE_CHANGE_REASON]);
    if (existing) {
      if (!['completed', 'failed'].includes(existing.status)) continue;
      const updated = await tx.execute(`
        UPDATE repository_rescan_jobs
        SET status = 'pending', attempt_count = 0, scan_request_id = NULL,
            claimed_at = NULL, lease_expires_at = NULL,
            last_error_code = NULL, last_error_message = NULL, updated_at = ?
        WHERE id = ? AND status IN ('completed', 'failed')
      `, [now, existing.id]);
      queued += updated.changes;
      continue;
    }
    const inserted = await tx.execute(`
      INSERT INTO repository_rescan_jobs
        (id, workspace_id, repository_id, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`rrj_${crypto.randomBytes(12).toString('hex')}`, target.workspace_id, target.repository_id, PROVIDER_SOURCE_CHANGE_REASON, now, now]);
    queued += inserted.changes;
  }
  return queued;
}

export async function enqueueNightlyRescans(now = new Date()): Promise<number> {
  const db = getDatabase();
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const repositories = await db.query<{ id: string; workspace_id: string }>(`
    SELECT id, workspace_id
    FROM repositories
    WHERE lifecycle = 'active' AND status IN ('connected', 'healthy', 'affected')
      AND (last_scan_at IS NULL OR last_scan_at < ?)
  `, [cutoff]);
  let queued = 0;
  for (const repository of repositories) {
    const existing = await db.queryOne<{ status: string }>(
      'SELECT status FROM repository_rescan_jobs WHERE repository_id = ? AND reason = ?',
      [repository.id, NIGHTLY_REASON],
    );
    if (existing && !['completed', 'failed'].includes(existing.status)) continue;
    if (existing) {
      await db.execute(`
        UPDATE repository_rescan_jobs
        SET status = 'pending', last_error_code = NULL, last_error_message = NULL, updated_at = ?
        WHERE repository_id = ? AND reason = ?
      `, [now.toISOString(), repository.id, NIGHTLY_REASON]);
      queued += 1;
      continue;
    }
    const result = await db.execute(`
      INSERT INTO repository_rescan_jobs (id, workspace_id, repository_id, reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`rrj_${crypto.randomBytes(12).toString('hex')}`, repository.workspace_id, repository.id, NIGHTLY_REASON, now.toISOString(), now.toISOString()]);
    queued += result.changes;
  }
  return queued;
}

async function claimJobs(limit: number, options: { includeScheduled: boolean; includeProviderChanges: boolean }, now = new Date()): Promise<RescanJob[]> {
  const db = getDatabase();
  const nowIso = now.toISOString();
  const lease = new Date(now.getTime() + LEASE_MS).toISOString();
  return db.transaction(async (tx) => {
    await tx.execute(`
      UPDATE repository_rescan_jobs
      SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?
    `, [nowIso, nowIso]);
    const reasons = [
      ...(options.includeScheduled ? [NIGHTLY_REASON] : []),
      ...(options.includeProviderChanges ? [PROVIDER_SOURCE_CHANGE_REASON] : []),
    ];
    if (reasons.length === 0) return [];
    const placeholders = reasons.map(() => '?').join(', ');
    const jobs = await tx.query<RescanJob>(`
      SELECT id, workspace_id, repository_id, reason, status, attempt_count, scan_request_id
      FROM repository_rescan_jobs
      WHERE status = 'pending' AND reason IN (${placeholders})
      ORDER BY created_at ASC
      LIMIT ?
    `, [...reasons, limit]);
    if (jobs.length === 0) return [];
    const jobPlaceholders = jobs.map(() => '?').join(', ');
    await tx.execute(`
      UPDATE repository_rescan_jobs
      SET status = 'processing', claimed_at = ?, lease_expires_at = ?, attempt_count = attempt_count + 1, updated_at = ?
      WHERE id IN (${jobPlaceholders})
    `, [nowIso, lease, nowIso, ...jobs.map((job) => job.id)]);
    return jobs;
  });
}

async function resolveCurrentHeadSha(repositoryId: string, workspaceId: string): Promise<string | undefined> {
  const db = getDatabase();
  const repository = await db.queryOne<{ id: string; github_repository_id: string; owner: string; name: string }>(`
    SELECT id, github_repository_id, owner, name FROM repositories
    WHERE id = ? AND workspace_id = ? AND lifecycle = 'active'
  `, [repositoryId, workspaceId]);
  const installation = await db.queryOne<{ installation_id: string }>(`
    SELECT installation_id FROM github_installations
    WHERE workspace_id = ? AND status = 'active'
    ORDER BY updated_at DESC LIMIT 1
  `, [workspaceId]);
  if (!repository || !installation) return undefined;
  const provider = createWorkspaceGitHubSourceControlProvider({
    installationId: installation.installation_id,
    repositoryId: repository.github_repository_id,
    owner: repository.owner,
    repository: repository.name,
  });
  const head = await provider.getDefaultBranch();
  if (!/^[a-f0-9]{40,64}$/i.test(head.sha)) throw new Error('INVALID_REMOTE_HEAD_SHA');
  return head.sha;
}

async function enqueueScanForRepository(tx: DatabaseAdapter, job: RescanJob, now: string, targetSha?: string): Promise<string> {
  const repository = await tx.queryOne<{ id: string; workspace_id: string; default_branch: string }>(`
    SELECT id, workspace_id, default_branch FROM repositories
    WHERE id = ? AND workspace_id = ? AND lifecycle = 'active'
  `, [job.repository_id, job.workspace_id]);
  if (!repository) throw new Error('REPOSITORY_NOT_FOUND');
  const latestScan = await tx.queryOne<{ sha: string }>(`
    SELECT sha FROM scans WHERE repository_id = ? AND status = 'completed' ORDER BY completed_at DESC, started_at DESC LIMIT 1
  `, [repository.id]);
  if (!latestScan?.sha) throw new Error('NO_COMPLETED_SCAN_BASELINE');
  const scanSha = targetSha ?? latestScan.sha;
  const existing = await tx.queryOne<{ id: string }>(`
    SELECT id FROM github_scan_requests WHERE repository_id = ? AND commit_sha = ?
  `, [repository.id, scanSha]);
  const scanRequestId = existing?.id ?? `req_${crypto.randomBytes(12).toString('hex')}`;
  const triggeredBy = job.reason === NIGHTLY_REASON
    ? 'scheduled'
    : job.reason === PROVIDER_SOURCE_CHANGE_REASON
      ? 'provider_change'
      : 'new_rule';
  const ruleCandidateId = 'rule_candidate_id' in job ? (job as RescanJob & { rule_candidate_id: string }).rule_candidate_id : null;
  if (existing) {
    await tx.execute(`
      UPDATE github_scan_requests
      SET status = CASE WHEN status IN ('completed', 'failed') THEN 'pending' ELSE status END,
          claimed_at = NULL, lease_expires_at = NULL, last_error_category = NULL, last_error_message = NULL
      WHERE id = ?
      `, [scanRequestId]);
    await tx.execute(`UPDATE scans SET status = 'pending', error_message = NULL, triggered_by = ?, rule_candidate_id = ?, triggered_at = ? WHERE repository_id = ? AND sha = ? AND status IN ('completed', 'failed')`, [triggeredBy, ruleCandidateId, now, repository.id, scanSha]);
  } else {
    await tx.execute(`
      INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [scanRequestId, repository.workspace_id, repository.id, scanSha, `refs/heads/${repository.default_branch}`, now]);
    await tx.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, triggered_by, rule_candidate_id, triggered_at, started_at)
      VALUES (?, ?, ?, 'pending', 'multi-provider', ?, ?, ?, ?)
    `, [`scn_${crypto.randomBytes(12).toString('hex')}`, repository.id, scanSha, triggeredBy, ruleCandidateId, now, now]);
  }
  return scanRequestId;
}

async function processApprovedRuleRescans(limit: number): Promise<{ queued: number; failed: number }> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute(`
    UPDATE provider_rescan_jobs
    SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL, updated_at = ?
    WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?
  `, [now, now]);
  const jobs = await db.query<RescanJob & { rule_candidate_id: string }>(`
    SELECT id, workspace_id, repository_id, reason, status, attempt_count, scan_request_id, rule_candidate_id
    FROM provider_rescan_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `, [limit]);
  let queued = 0;
  let failed = 0;
  for (const job of jobs) {
    const claimed = await db.execute(`
      UPDATE provider_rescan_jobs
      SET status = 'processing', attempt_count = attempt_count + 1, claimed_at = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `, [now, new Date(Date.now() + LEASE_MS).toISOString(), now, job.id]);
    if (claimed.changes !== 1) continue;
    try {
      const targetSha = await resolveCurrentHeadSha(job.repository_id, job.workspace_id);
      const scanRequestId = await db.transaction((tx) => enqueueScanForRepository(tx, job, now, targetSha));
      await db.execute(`
        UPDATE provider_rescan_jobs
        SET status = 'queued', scan_request_id = ?, claimed_at = NULL, lease_expires_at = NULL, updated_at = ?, last_error_code = NULL, last_error_message = NULL
        WHERE id = ? AND status = 'processing'
      `, [scanRequestId, now, job.id]);
      queued += 1;
    } catch (error) {
      const errorCode = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message : 'RESCAN_QUEUE_FAILED';
      await db.execute(`
        UPDATE provider_rescan_jobs
        SET status = CASE WHEN attempt_count >= 5 THEN 'failed' ELSE 'pending' END,
            last_error_code = ?, last_error_message = ?, updated_at = ?
        WHERE id = ?
      `, [errorCode, 'Rescan queue processing failed.', now, job.id]);
      failed += 1;
    }
  }
  return { queued, failed };
}

async function reconcileApprovedRuleRescans(): Promise<void> {
  const db = getDatabase();
  await db.execute(`
    UPDATE provider_rescan_jobs
    SET status = CASE WHEN r.status = 'completed' THEN 'completed' WHEN r.status = 'failed' THEN 'failed' ELSE provider_rescan_jobs.status END,
        last_error_code = CASE WHEN r.status = 'failed' THEN r.last_error_category ELSE NULL END,
        last_error_message = CASE WHEN r.status = 'failed' THEN r.last_error_message ELSE NULL END,
        updated_at = ?
    FROM github_scan_requests r
    WHERE provider_rescan_jobs.scan_request_id = r.id AND provider_rescan_jobs.status = 'queued'
  `, [new Date().toISOString()]).catch(async () => {
    // SQLite has no UPDATE ... FROM. Keep the portable path explicit.
    const queued = await db.query<{ id: string; scan_request_id: string }>('SELECT id, scan_request_id FROM provider_rescan_jobs WHERE status = \'queued\' AND scan_request_id IS NOT NULL');
    for (const job of queued) {
      const request = await db.queryOne<{ status: string; last_error_category: string | null; last_error_message: string | null }>('SELECT status, last_error_category, last_error_message FROM github_scan_requests WHERE id = ?', [job.scan_request_id]);
      if (request?.status === 'completed' || request?.status === 'failed') {
        await db.execute(`UPDATE provider_rescan_jobs SET status = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE id = ?`, [request.status, request.last_error_category, request.last_error_message, new Date().toISOString(), job.id]);
      }
    }
  });
}

async function reconcileScheduledRescans(): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const update = async (job: { id: string; scan_request_id: string }) => {
    const request = await db.queryOne<{ status: string; last_error_category: string | null; last_error_message: string | null }>(
      'SELECT status, last_error_category, last_error_message FROM github_scan_requests WHERE id = ?',
      [job.scan_request_id],
    );
    if (request?.status === 'completed' || request?.status === 'failed') {
      await db.execute(`UPDATE repository_rescan_jobs SET status = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE id = ? AND status = 'queued'`, [request.status, request.last_error_category, request.last_error_message, now, job.id]);
    }
  };
  const queued = await db.query<{ id: string; scan_request_id: string }>("SELECT id, scan_request_id FROM repository_rescan_jobs WHERE status = 'queued' AND scan_request_id IS NOT NULL");
  for (const job of queued) await update(job);
}

export async function processRepositoryRescans(options: { batchSize?: number; timeoutMs?: number; includeScheduled?: boolean } = {}): Promise<{ jobsClaimed: number; jobsQueued: number; jobsFailed: number; scanWorker?: unknown }> {
  const approved = await processApprovedRuleRescans(Math.min(options.batchSize ?? 10, 25));
  const jobs = await claimJobs(Math.min(options.batchSize ?? 10, 25), {
    includeScheduled: options.includeScheduled !== false,
    includeProviderChanges: true,
  });
  let jobsQueued = 0;
  let jobsFailed = 0;
  const db = getDatabase();
  const now = new Date().toISOString();
  for (const job of jobs) {
    try {
      const targetSha = await resolveCurrentHeadSha(job.repository_id, job.workspace_id);
      const scanRequestId = await db.transaction((tx) => enqueueScanForRepository(tx, job, now, targetSha));
      await db.execute(`
        UPDATE repository_rescan_jobs
        SET status = 'queued', scan_request_id = ?, claimed_at = NULL, lease_expires_at = NULL, updated_at = ?, last_error_code = NULL, last_error_message = NULL
        WHERE id = ?
      `, [scanRequestId, now, job.id]);
      jobsQueued += 1;
    } catch (error) {
      const errorCode = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message : 'RESCAN_QUEUE_FAILED';
      await db.execute(`
        UPDATE repository_rescan_jobs
        SET status = CASE WHEN attempt_count >= 5 THEN 'failed' ELSE 'pending' END,
            claimed_at = NULL, lease_expires_at = NULL, last_error_code = ?, last_error_message = ?, updated_at = ?
        WHERE id = ?
      `, [errorCode, 'Rescan queue processing failed.', now, job.id]);
      jobsFailed += 1;
    }
  }
  let scanWorker: unknown;
  const totalQueued = jobsQueued + approved.queued;
  if (totalQueued > 0) {
    scanWorker = await processPendingGitHubScans({ batchSize: Math.min(totalQueued, 10), timeoutMs: Math.min(options.timeoutMs ?? 50_000, 50_000) });
  }
  await reconcileApprovedRuleRescans();
  await reconcileScheduledRescans();
  return { jobsClaimed: jobs.length + approved.queued + approved.failed, jobsQueued: jobsQueued + approved.queued, jobsFailed: jobsFailed + approved.failed, scanWorker };
}

