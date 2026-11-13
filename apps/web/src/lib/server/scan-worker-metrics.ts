import { getDatabase } from './db/index.js';
import { ensureScanWorkerSchema } from './scan-worker-state.js';

export interface ScanWorkerMetrics {
  pendingJobs: number;
  processingJobs: number;
  stalledJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalScanRequests: number;
  lastProcessedAt: string | null;
}

/** Returns aggregate queue health without exposing workspace-specific data. */
export async function getScanWorkerMetrics(): Promise<ScanWorkerMetrics> {
  const db = getDatabase();
  await ensureScanWorkerSchema(db);
  const counts = await db.query<{ status: string; count: number | string }>(`
    SELECT status, COUNT(*) as count FROM github_scan_requests GROUP BY status
  `);
  const map: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0 };
  let total = 0;
  for (const row of counts) {
    const count = Number(row.count);
    map[row.status] = count;
    total += count;
  }
  const lastJob = await db.queryOne<{ created_at: string }>(`
    SELECT created_at FROM github_scan_requests WHERE status IN ('completed', 'failed') ORDER BY created_at DESC LIMIT 1
  `);
  const stalled = await db.queryOne<{ count: number | string }>(`
    SELECT COUNT(*) AS count FROM github_scan_requests
    WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?
  `, [new Date().toISOString()]);
  return {
    pendingJobs: map.pending ?? 0,
    processingJobs: map.processing ?? 0,
    stalledJobs: Number(stalled?.count ?? 0),
    completedJobs: map.completed ?? 0,
    failedJobs: map.failed ?? 0,
    totalScanRequests: total,
    lastProcessedAt: lastJob?.created_at ?? null,
  };
}
