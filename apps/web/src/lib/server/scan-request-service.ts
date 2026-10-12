import crypto from 'node:crypto';
import { createWorkspaceGitHubSourceControlProvider } from './github.js';
import { getDatabase } from './db/index.js';
import { getWorkspaceGitHubInstallation, type RepositoryRecord } from './workspace-service.js';
import { parseBoundedProductizationProjection } from './productization-persistence.js';
import { providerIntelligenceV1Enabled } from './provider-intelligence-feature.js';
import { withSqliteClaimLock } from './scan-worker-state.js';

export type ScanRequestState = 'queued' | 'processing' | 'completed';

export interface ResolvedRepositoryHead {
  commitSha: string;
  ref: string;
}

export interface EnqueuedScanRequest {
  requestId: string | null;
  scanId: string | null;
  repositoryId: string;
  commitSha: string;
  ref: string;
  state: ScanRequestState;
  created: boolean;
}

interface ScanRequestRow {
  id: string;
  status: string;
}

interface ScanRow {
  id: string;
  status: string;
  raw_result: string | Record<string, unknown> | null;
}

function hasProductizationResult(rawResult: ScanRow['raw_result']): boolean {
  if (!rawResult) return false;
  try {
    const parsed = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    return parseBoundedProductizationProjection(parsed) !== null;
  } catch {
    return false;
  }
}

function requireCommitSha(value: string): string {
  const commitSha = value.trim();
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) {
    throw new Error('GITHUB_INVALID_RESPONSE: Invalid commit SHA returned for repository default branch.');
  }
  return commitSha;
}

function normalizeEnqueuedCommitSha(value: string): string {
  const commitSha = value.trim();
  if (!commitSha || commitSha.length > 200) {
    throw new Error('GITHUB_INVALID_RESPONSE: Missing or invalid commit identifier.');
  }
  return commitSha;
}

/** Resolve only branch metadata; source files remain the worker's responsibility. */
export async function resolveRepositoryHead(repository: Pick<RepositoryRecord, 'workspace_id' | 'github_repository_id' | 'owner' | 'name' | 'default_branch'>): Promise<ResolvedRepositoryHead> {
  const installation = await getWorkspaceGitHubInstallation(repository.workspace_id);
  if (!installation || installation.status !== 'active') {
    throw new Error('GITHUB_APP_NOT_CONFIGURED: Active GitHub App installation is required to queue a repository scan.');
  }

  const provider = createWorkspaceGitHubSourceControlProvider({
    installationId: installation.installationId,
    repositoryId: repository.github_repository_id,
    owner: repository.owner,
    repository: repository.name,
  });
  const head = await provider.getDefaultBranch();
  if (head.name !== repository.default_branch) {
    throw new Error('GITHUB_DEFAULT_BRANCH_NOT_FOUND: Stored repository default branch no longer matches GitHub.');
  }

  return {
    commitSha: requireCommitSha(head.sha),
    ref: `refs/heads/${head.name}`,
  };
}

function scanState(requestStatus: string, scanStatus: string | undefined): ScanRequestState {
  if (requestStatus === 'processing' || scanStatus === 'running') return 'processing';
  if (requestStatus === 'completed' && scanStatus === 'completed') return 'completed';
  return 'queued';
}

/**
 * Enqueue or reuse exactly one logical scan for a repository and commit.
 * The database uniqueness constraint is the concurrency boundary; callers do
 * not need a preflight check outside this transaction.
 */
export async function enqueueRepositoryScan(input: {
  workspaceId: string;
  repositoryId: string;
  commitSha: string;
  ref: string;
  deliveryId?: string | null;
}): Promise<EnqueuedScanRequest> {
  // Manual scans resolve a verified 40-character Git ref above. Webhook
  // deliveries are already authenticated by GitHub and may use test/durable
  // commit identifiers in local adapters, so the queue boundary only requires
  // a bounded non-empty identifier; the worker validates the source response.
  const commitSha = normalizeEnqueuedCommitSha(input.commitSha);
  const db = getDatabase();
  const now = new Date().toISOString();

  const enqueue = (): Promise<EnqueuedScanRequest> => db.transaction(async (tx): Promise<EnqueuedScanRequest> => {
    let request = await tx.queryOne<ScanRequestRow>(`
      SELECT id, status
      FROM github_scan_requests
      WHERE repository_id = ? AND commit_sha = ?
    `, [input.repositoryId, commitSha]);

    let scan = await tx.queryOne<ScanRow>(`
      SELECT id, status, raw_result
      FROM scans
      WHERE repository_id = ? AND sha = ?
      ORDER BY started_at DESC
      LIMIT 1
    `, [input.repositoryId, commitSha]);

    const productizationComplete = scan?.status === 'completed' && hasProductizationResult(scan.raw_result);
    if (productizationComplete && (!request || request.status === 'completed')) {
      return {
        requestId: request?.id ?? null,
        scanId: scan?.id ?? null,
        repositoryId: input.repositoryId,
        commitSha,
        ref: input.ref,
        state: 'completed',
        created: false,
      };
    }

    if (request?.status === 'processing' || request?.status === 'pending') {
      return {
        requestId: request.id,
        scanId: scan?.id ?? null,
        repositoryId: input.repositoryId,
        commitSha,
        ref: input.ref,
        state: scanState(request.status, scan?.status),
        created: false,
      };
    }

    if (request?.status === 'completed' && !providerIntelligenceV1Enabled()) {
      return {
        requestId: request.id,
        scanId: scan?.id ?? null,
        repositoryId: input.repositoryId,
        commitSha,
        ref: input.ref,
        state: scanState(request.status, scan?.status),
        created: false,
      };
    }

    let created = false;
    if (!request) {
      const requestId = `req_${crypto.randomBytes(12).toString('hex')}`;
      const inserted = await tx.execute(`
        INSERT INTO github_scan_requests (id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        ON CONFLICT (repository_id, commit_sha) DO NOTHING
      `, [requestId, input.workspaceId, input.repositoryId, commitSha, input.ref, input.deliveryId ?? null, now]);
      created = inserted.changes === 1;
      request = await tx.queryOne<ScanRequestRow>(`
        SELECT id, status
        FROM github_scan_requests
        WHERE repository_id = ? AND commit_sha = ?
      `, [input.repositoryId, commitSha]);
    } else if (
      request.status === 'failed' ||
      (request.status === 'completed' && providerIntelligenceV1Enabled() && !productizationComplete)
    ) {
      await tx.execute(`
        UPDATE github_scan_requests
        SET status = 'pending', claimed_at = NULL, lease_expires_at = NULL,
            last_error_category = NULL, last_error_message = NULL
        WHERE id = ? AND status IN ('failed', 'completed')
      `, [request.id]);
      request = { ...request, status: 'pending' };
    }

    if (!request) throw new Error('SCAN_REQUEST_ENQUEUE_FAILED');

    if (!scan) {
      const scanId = `scn_${crypto.randomBytes(12).toString('hex')}`;
      await tx.execute(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES (?, ?, ?, 'pending', 'multi-provider', ?)
      `, [scanId, input.repositoryId, commitSha, now]);
      scan = { id: scanId, status: 'pending', raw_result: null };
    }

    return {
      requestId: request.id,
      scanId: scan.id,
      repositoryId: input.repositoryId,
      commitSha,
      ref: input.ref,
      state: scanState(request.status, scan.status),
      created,
    };
  });

  return db.engine === 'sqlite' ? withSqliteClaimLock(enqueue) : enqueue();
}
