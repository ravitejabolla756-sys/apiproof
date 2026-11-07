import { getDatabase } from './db/index.js';

export interface ScanWorkerMetrics {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalScanRequests: number;
  lastProcessedAt: string | null;
  oldestPendingAt: string | null;
  oldestPendingAgeMs: number | null;
  retryingJobs: number;
  stalledProcessingJobs: number;
  retryExhaustedJobs: number;
}

/**
 * Returns tenant-neutral queue metrics for monitoring and worker health.
 * Stalled legacy rows use the same five-minute stale threshold as worker recovery.
 */
export async function getScanWorkerMetrics(now = new Date()): Promise<ScanWorkerMetrics> {
  const db = getDatabase();
  const counts = await db.query<{ status: string; count: number | string }>(`
    SELECT status, COUNT(*) as count FROM github_scan_requests GROUP BY status
  `);

  const map: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  let total = 0;
  for (const row of counts) {
    const count = Number(row.count);
    map[row.status] = count;
    total += count;
  }

  const lastJob = await db.queryOne<{ created_at: string }>(`
    SELECT created_at FROM github_scan_requests
    WHERE status IN ('completed', 'failed')
    ORDER BY created_at DESC LIMIT 1
  `);
  const nowIso = now.toISOString();
  const legacyStaleThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const queueHealth = await db.queryOne<{
    oldest_pending_at: string | null;
    retrying_jobs: number | string;
    stalled_processing_jobs: number | string;
    retry_exhausted_jobs: number | string;
  }>(`
    SELECT
      MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldest_pending_at,
      COUNT(CASE WHEN status IN ('pending', 'processing') AND attempt_count > 0 THEN 1 END) AS retrying_jobs,
      COUNT(CASE WHEN status = 'processing' AND (
        (lease_expires_at IS NOT NULL AND lease_expires_at < ?) OR
        (lease_expires_at IS NULL AND created_at < ?)
      ) THEN 1 END) AS stalled_processing_jobs,
      COUNT(CASE WHEN status IN ('pending', 'processing', 'failed') AND attempt_count >= 3 THEN 1 END) AS retry_exhausted_jobs
    FROM github_scan_requests
  `, [nowIso, legacyStaleThreshold]);
  const oldestPendingAt = queueHealth?.oldest_pending_at ?? null;
  const oldestPendingTime = oldestPendingAt ? Date.parse(oldestPendingAt) : Number.NaN;

  return {
    pendingJobs: map.pending ?? 0,
    processingJobs: map.processing ?? 0,
    completedJobs: map.completed ?? 0,
    failedJobs: map.failed ?? 0,
    totalScanRequests: total,
    lastProcessedAt: lastJob?.created_at ?? null,
    oldestPendingAt,
    oldestPendingAgeMs: Number.isFinite(oldestPendingTime) ? Math.max(0, now.getTime() - oldestPendingTime) : null,
    retryingJobs: Number(queueHealth?.retrying_jobs ?? 0),
    stalledProcessingJobs: Number(queueHealth?.stalled_processing_jobs ?? 0),
    retryExhaustedJobs: Number(queueHealth?.retry_exhausted_jobs ?? 0),
  };
}
