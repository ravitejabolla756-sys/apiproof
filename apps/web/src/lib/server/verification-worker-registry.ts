import { VERIFICATION_DOCKER_IMAGE } from '@apiproof/core';
import { getDatabase } from './db/index.js';

const HEARTBEAT_MAX_AGE_MS = 90_000;

export async function publishVerificationWorkerHeartbeat(workerId: string, ready: boolean, errorCategory?: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.execute(`
    INSERT INTO migration_verification_workers (worker_id, status, docker_image, last_seen_at, last_error_category)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(worker_id) DO UPDATE SET status = excluded.status, docker_image = excluded.docker_image,
      last_seen_at = excluded.last_seen_at, last_error_category = excluded.last_error_category
  `, [workerId, ready ? 'ready' : 'unavailable', VERIFICATION_DOCKER_IMAGE, now, errorCategory ?? null]);
}

export async function hasReadyVerificationWorker(): Promise<boolean> {
  const cutoff = new Date(Date.now() - HEARTBEAT_MAX_AGE_MS).toISOString();
  const row = await getDatabase().queryOne<{ worker_id: string }>(`
    SELECT worker_id FROM migration_verification_workers
    WHERE status = 'ready' AND docker_image = ? AND last_seen_at >= ?
    ORDER BY last_seen_at DESC LIMIT 1
  `, [VERIFICATION_DOCKER_IMAGE, cutoff]);
  return Boolean(row);
}
