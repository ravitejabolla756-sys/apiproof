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
  const nowIso = now.toISOString();
  const legacyStaleThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const metrics = await db.queryOne<{
    pending_jobs: number | string;
    processing_jobs: number | string;
    completed_jobs: number | string;
    failed_jobs: number | string;
    total_scan_requests: number | string;
    last_processed_at: string | null;
    oldest_pending_at: string | null;
    retrying_jobs: number | string;
    stalled_processing_jobs: number | string;
    retry_exhausted_jobs: number | string;
  }>(`
    SELECT
      COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_jobs,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) AS processing_jobs,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_jobs,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_jobs,
      COUNT(*) AS total_scan_requests,
      MAX(CASE WHEN status IN ('completed', 'failed') THEN created_at END) AS last_processed_at,
      MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldest_pending_at,
      COUNT(CASE WHEN status IN ('pending', 'processing') AND attempt_count > 0 THEN 1 END) AS retrying_jobs,
      COUNT(CASE WHEN status = 'processing' AND (
        (lease_expires_at IS NOT NULL AND lease_expires_at < ?) OR
        (lease_expires_at IS NULL AND created_at < ?)
      ) THEN 1 END) AS stalled_processing_jobs,
      COUNT(CASE WHEN status IN ('pending', 'processing', 'failed') AND attempt_count >= 3 THEN 1 END) AS retry_exhausted_jobs
    FROM github_scan_requests
  `, [nowIso, legacyStaleThreshold]);
  const oldestPendingAt = metrics?.oldest_pending_at ?? null;
  const oldestPendingTime = oldestPendingAt ? Date.parse(oldestPendingAt) : Number.NaN;

  return {
    pendingJobs: Number(metrics?.pending_jobs ?? 0),
    processingJobs: Number(metrics?.processing_jobs ?? 0),
    completedJobs: Number(metrics?.completed_jobs ?? 0),
    failedJobs: Number(metrics?.failed_jobs ?? 0),
    totalScanRequests: Number(metrics?.total_scan_requests ?? 0),
    lastProcessedAt: metrics?.last_processed_at ?? null,
    oldestPendingAt,
    oldestPendingAgeMs: Number.isFinite(oldestPendingTime) ? Math.max(0, now.getTime() - oldestPendingTime) : null,
    retryingJobs: Number(metrics?.retrying_jobs ?? 0),
    stalledProcessingJobs: Number(metrics?.stalled_processing_jobs ?? 0),
    retryExhaustedJobs: Number(metrics?.retry_exhausted_jobs ?? 0),
  };
}
