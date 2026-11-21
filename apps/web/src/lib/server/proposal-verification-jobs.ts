import crypto from 'node:crypto';
import { requireAuthoritativeDefaultBranch } from '@apiproof/core';
import { getDatabase } from './db/index.js';
import { checkWorkspaceLimit } from './billing/service.js';
import { requireMigrationAccess } from './workspace-service.js';
import { hasReadyVerificationWorker } from './verification-worker-registry.js';
import type { DatabaseAdapter } from './db/types.js';
import { withPostgresTenantContext } from './db/postgres-tenant-context.js';

export type ProposalJobStatus = 'verification_in_progress' | 'completed' | 'execution_unavailable' | 'failed';

export interface ProposalJobSnapshot {
  jobId: string;
  status: ProposalJobStatus;
  proposal?: unknown;
  errorCode?: string;
}

export async function enqueueMigrationProposal(migrationId: string, userId: string, sessionId?: string): Promise<ProposalJobSnapshot> {
  if (process.env.NODE_ENV === 'production' && !sessionId?.trim()) {
    throw new Error('PROPOSAL_WORKER_DATABASE_AUTH_UNAVAILABLE');
  }
  const { migration, repository, workspace } = await requireMigrationAccess(migrationId, userId);
  if (repository.lifecycle !== 'active') throw new Error('REPOSITORY_NOT_ACTIVE');
  if (!/^\d+$/.test(repository.github_repository_id ?? '')) throw new Error('AUTHORITATIVE_GITHUB_REPOSITORY_REQUIRED');
  try { requireAuthoritativeDefaultBranch(repository.default_branch); }
  catch { throw new Error('GITHUB_DEFAULT_BRANCH_NOT_FOUND'); }

  const db = getDatabase();
  const runTenantDb = <T>(operation: (tx: DatabaseAdapter) => Promise<T>) =>
    db.engine === 'sqlite'
      ? operation(db)
      : withPostgresTenantContext(db, userId, workspace.id, operation, sessionId);
  const binding = await runTenantDb((tx) => tx.queryOne<{ scan_id: string; sha: string; status: string; repository_id: string }>(`
    SELECT s.id AS scan_id, s.sha, s.status, s.repository_id
    FROM findings f JOIN scans s ON s.id = f.scan_id
    WHERE f.id = ? AND f.repository_id = ?
  `, [migration.finding_id, repository.id]));
  if (!binding || binding.status !== 'completed' || binding.repository_id !== repository.id) throw new Error('COMPLETED_SCAN_REQUIRED');
  const baselineSha = migration.baseline_sha?.trim() || binding.sha?.trim();
  if (!baselineSha || baselineSha !== binding.sha || !/^[a-f0-9]{40}$/i.test(baselineSha)) throw new Error('BASELINE_SHA_REPOSITORY_MISMATCH');

  const limit = await runTenantDb((tx) => checkWorkspaceLimit(workspace.id, 'draft_prs', tx));
  if (!limit.allowed) throw new Error(limit.reason ?? 'PLAN_LIMIT_EXCEEDED');

  const existing = await runTenantDb((tx) => tx.queryOne<{ id: string; status: string; result_json: string | null }>(
    'SELECT id, status, result_json FROM migration_verification_jobs WHERE migration_id = ? AND workspace_id = ? AND repository_id = ?',
    [migrationId, workspace.id, repository.id],
  ));
  if (existing?.status === 'completed') return snapshotFromRow(existing);
  if (existing?.status === 'processing') return { jobId: existing.id, status: 'verification_in_progress' };

  if (!await hasReadyVerificationWorker()) {
    return { jobId: existing?.id ?? '', status: 'execution_unavailable', errorCode: 'VERIFICATION_EXECUTION_UNAVAILABLE' };
  }

  const now = new Date().toISOString();
  if (existing) {
    await runTenantDb(async (tx) => {
      await tx.execute(`UPDATE migration_verification_jobs SET status = 'pending', requested_by = ?, baseline_sha = ?, attempt_count = 0,
        claimed_by = NULL, lease_expires_at = NULL, error_category = NULL, error_message = NULL, result_json = NULL, updated_at = ? WHERE id = ?`,
      [userId, baselineSha, now, existing.id]);
      await invalidateFailedMigrationArtifacts(tx, migrationId);
    });
    return { jobId: existing.id, status: 'verification_in_progress' };
  }

  const jobId = `vjob_${crypto.randomBytes(12).toString('hex')}`;
  try {
    await runTenantDb(async (tx) => {
      await tx.execute(`INSERT INTO migration_verification_jobs
        (id, migration_id, workspace_id, repository_id, requested_by, baseline_sha, status, attempt_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [jobId, migrationId, workspace.id, repository.id, userId, baselineSha, now, now]);
      await invalidateFailedMigrationArtifacts(tx, migrationId);
    });
  } catch {
    const raced = await runTenantDb((tx) => tx.queryOne<{ id: string; status: string; result_json: string | null }>(
      'SELECT id, status, result_json FROM migration_verification_jobs WHERE migration_id = ? AND workspace_id = ? AND repository_id = ?',
      [migrationId, workspace.id, repository.id],
    ));
    if (!raced) throw new Error('VERIFICATION_JOB_ENQUEUE_FAILED');
    return raced.status === 'completed' ? snapshotFromRow(raced) : { jobId: raced.id, status: 'verification_in_progress' };
  }
  return { jobId, status: 'verification_in_progress' };
}

async function invalidateFailedMigrationArtifacts(db: Pick<DatabaseAdapter, 'execute'>, migrationId: string): Promise<void> {
  await db.execute(`UPDATE migrations SET status = 'planned', patch_digest = NULL, patch_content = NULL,
    patch_diff = NULL, verification_report = NULL
    WHERE id = ? AND status <> 'pr_created'
      AND NOT EXISTS (SELECT 1 FROM pull_requests WHERE migration_id = ?)`, [migrationId, migrationId]);
}

export async function getMigrationProposalJobStatus(migrationId: string, userId: string, sessionId?: string): Promise<ProposalJobSnapshot | null> {
  if (process.env.NODE_ENV === 'production' && !sessionId?.trim()) {
    throw new Error('PROPOSAL_WORKER_DATABASE_AUTH_UNAVAILABLE');
  }
  const { repository, workspace } = await requireMigrationAccess(migrationId, userId);
  const db = getDatabase();
  const row = await withPostgresTenantContext(db, userId, workspace.id, (tx) => tx.queryOne<{ id: string; status: string; result_json: string | null; error_category: string | null }>(`
    SELECT id, status, result_json, error_category FROM migration_verification_jobs
    WHERE migration_id = ? AND workspace_id = ? AND repository_id = ?
  `, [migrationId, workspace.id, repository.id]), sessionId);
  if (!row) return null;
  return snapshotFromRow(row);
}

function snapshotFromRow(row: { id: string; status: string; result_json: string | null; error_category?: string | null }): ProposalJobSnapshot {
  if (row.status === 'completed') {
    try {
      return { jobId: row.id, status: 'completed', proposal: JSON.parse(row.result_json ?? 'null') };
    } catch {
      return { jobId: row.id, status: 'failed', errorCode: 'VERIFICATION_RESULT_INVALID' };
    }
  }
  if (row.status === 'execution_unavailable') return { jobId: row.id, status: 'execution_unavailable', errorCode: 'VERIFICATION_EXECUTION_UNAVAILABLE' };
  if (row.status === 'failed') return { jobId: row.id, status: 'failed', errorCode: 'VERIFICATION_JOB_FAILED' };
  return { jobId: row.id, status: 'verification_in_progress' };
}
