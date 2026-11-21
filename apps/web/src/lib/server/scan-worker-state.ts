import type { DatabaseAdapter } from './db/types.js';
import { logger } from './logger.js';

export const SCAN_WORKER_MAX_ATTEMPTS = 3;
export const RETRYABLE_SCAN_FAILURES: ReadonlySet<string> = new Set(['GITHUB_RATE_LIMIT', 'GITHUB_UNAVAILABLE', 'GITHUB_NETWORK']);

export interface ScanWorkerJobState {
  id: string;
  repository_id: string;
  commit_sha: string;
  attempt_count: number;
}

export async function ensureScanWorkerSchema(db: DatabaseAdapter): Promise<void> {
  const columns: Array<[string, string]> = [
    ['attempt_count', "INTEGER NOT NULL DEFAULT 0"],
    ['claimed_at', 'TEXT'],
    ['lease_expires_at', 'TEXT'],
    ['last_error_category', 'TEXT'],
    ['last_error_message', 'TEXT'],
  ];
  for (const [column, definition] of columns) {
    if (db.engine === 'postgres') {
      await db.execute(`ALTER TABLE github_scan_requests ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    } else {
      const existing = await db.query<{ name: string }>('PRAGMA table_info(github_scan_requests)');
      if (!existing.some((entry) => entry.name === column)) {
        await db.execute(`ALTER TABLE github_scan_requests ADD COLUMN ${column} ${definition}`);
      }
    }
  }
  await db.execute('CREATE INDEX IF NOT EXISTS idx_scan_requests_claim ON github_scan_requests(status, lease_expires_at, created_at)');
}

export async function failScan(db: DatabaseAdapter, scanId: string, errorMessage: string): Promise<void> {
  await db.execute(`
    UPDATE scans SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?
  `, [errorMessage, new Date().toISOString(), scanId]);
}

export async function revertScanWorkerJobToPending(db: DatabaseAdapter, jobId: string): Promise<void> {
  await db.execute(`
    UPDATE github_scan_requests
    SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL
    WHERE id = ? AND status = 'processing'
  `, [jobId]);
}

let sqliteClaimLock: Promise<void> = Promise.resolve();

export async function withSqliteClaimLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = sqliteClaimLock;
  let release!: () => void;
  sqliteClaimLock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

export async function markScanWorkerJobFailed(
  db: DatabaseAdapter,
  job: ScanWorkerJobState,
  category: string,
  errorMessage: string,
  context: { repositoryFullName?: string; errorCode?: string; durationMs?: number } = {}
): Promise<void> {
  const nextStatus = RETRYABLE_SCAN_FAILURES.has(category) && job.attempt_count < SCAN_WORKER_MAX_ATTEMPTS ? 'pending' : 'failed';
  const safeMessage = errorMessage.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
  await db.execute(`
    UPDATE github_scan_requests
    SET status = ?, claimed_at = NULL, lease_expires_at = NULL,
        last_error_category = ?, last_error_message = ?
    WHERE id = ? AND status = 'processing'
  `, [nextStatus, category, safeMessage, job.id]);
  logger.error('scan_worker_job_failed', {
    scanRequestId: job.id,
    repositoryId: job.repository_id,
    commitSha: job.commit_sha,
    repositoryFullName: context.repositoryFullName,
    attempt: job.attempt_count,
    finalStatus: nextStatus,
    failureCategory: category,
    errorCode: context.errorCode,
    durationMs: context.durationMs,
  });
}
