import { getDatabase } from './db/index.js';
import { ensureScanWorkerSchema, withSqliteClaimLock } from './scan-worker-state.js';

export interface PendingScanRequest {
  id: string;
  workspace_id: string;
  repository_id: string;
  commit_sha: string;
  ref: string;
  status: string;
  delivery_id: string | null;
  created_at: string;
  attempt_count: number;
  claimed_at: string | null;
  lease_expires_at: string | null;
}

/**
 * Claims pending scan requests atomically and recovers only expired leases.
 * PostgreSQL uses row locks; SQLite uses the worker's process-local claim lock
 * around the equivalent transaction.
 */
export async function claimPendingJobs(limit: number): Promise<PendingScanRequest[]> {
  const db = getDatabase();
  await ensureScanWorkerSchema(db);
  const now = new Date();
  const nowIso = now.toISOString();
  const legacyStaleThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const leaseExpiry = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  if (db.engine === 'postgres') {
    return db.transaction(async (tx) => {
      await tx.execute(`
        UPDATE github_scan_requests
        SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL
        WHERE status = 'processing' AND (
          (lease_expires_at IS NOT NULL AND lease_expires_at < $1) OR
          (lease_expires_at IS NULL AND created_at < $2)
        )
      `, [nowIso, legacyStaleThreshold]);

      const rows = await tx.query<PendingScanRequest>(`
        SELECT id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at,
               attempt_count, claimed_at, lease_expires_at
        FROM github_scan_requests
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `, [limit]);

      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
      await tx.execute(
        `UPDATE github_scan_requests
         SET status = 'processing', claimed_at = $${ids.length + 1}, lease_expires_at = $${ids.length + 2},
             attempt_count = attempt_count + 1
         WHERE id IN (${placeholders})`,
        [...ids, nowIso, leaseExpiry],
      );

      return rows;
    });
  }

  return withSqliteClaimLock(() => db.transaction(async (tx) => {
    await tx.execute(`
      UPDATE github_scan_requests
      SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL
      WHERE status = 'processing' AND (
        (lease_expires_at IS NOT NULL AND lease_expires_at < ?) OR
        (lease_expires_at IS NULL AND created_at < ?)
      )
    `, [nowIso, legacyStaleThreshold]);

    const rows = await tx.query<PendingScanRequest>(`
      SELECT id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at,
             attempt_count, claimed_at, lease_expires_at
      FROM github_scan_requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `, [limit]);

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    await tx.execute(
      `UPDATE github_scan_requests
       SET status = 'processing', claimed_at = ?, lease_expires_at = ?, attempt_count = attempt_count + 1
       WHERE id IN (${placeholders})`,
      [nowIso, leaseExpiry, ...ids],
    );

    return rows;
  }));
}
