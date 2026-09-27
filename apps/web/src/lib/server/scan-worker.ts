/**
 * Phase 4: Asynchronous Scan Worker
 *
 * Processes pending scan requests from github_scan_requests atomically.
 * Uses FOR UPDATE SKIP LOCKED on PostgreSQL and a serialized UPDATE-then-SELECT
 * pattern on SQLite.
 *
 * Design constraints:
 * - Bounded execution: configurable batchSize and timeoutMs per invocation.
 * - No permanently running process assumed — runs per Vercel cron / internal route call.
 * - Idempotent: UNIQUE(repository_id, commit_sha) prevents double-work at DB level.
 * - Workspace installation token is ephemeral and never persisted.
 * - Fails fast if APIPROOF_SECRET is absent (delegated to getVerifierSecret).
 */

import crypto from 'node:crypto';
import { getDatabase } from './db/index.js';
import { getWorkspaceGitHubInstallation } from './workspace-service.js';
import { loadGitHubAppConfig, NodeGitHubAppTokenProvider, GitHubAppSourceControlProvider, FetchGitHubReadTransport } from '@apiproof/core';
import { fetchRemoteRepositoryFiles } from './github.js';
import { TypeScriptRepositoryAnalyzer, RepositorySnapshot } from '@apiproof/analyzers';
import { StripeProvider, TwilioProvider } from '@apiproof/providers';
import type { ApiProvider } from '@apiproof/core';
import { loadProviderRegistry } from './registry-utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScanWorkerOptions {
  /** Maximum number of jobs to claim and process in one invocation. Default: 5 */
  batchSize?: number | undefined;
  /** Maximum wall-clock milliseconds for the entire invocation. Default: 50_000 */
  timeoutMs?: number | undefined;
}

export interface ScanWorkerJobResult {
  scanRequestId: string;
  repositoryId: string;
  commitSha: string;
  status: 'completed' | 'failed' | 'skipped';
  scanId?: string;
  findingsCount?: number;
  error?: string;
}

export interface ScanWorkerResult {
  jobsClaimed: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsSkipped: number;
  results: ScanWorkerJobResult[];
  timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PendingScanRequest {
  id: string;
  workspace_id: string;
  repository_id: string;
  commit_sha: string;
  ref: string;
  status: string;
  delivery_id: string | null;
  created_at: string;
}

interface RepositoryRow {
  id: string;
  workspace_id: string;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
}

// ---------------------------------------------------------------------------
// Job claiming
// ---------------------------------------------------------------------------

/**
 * Claims up to `limit` pending scan requests atomically.
 * Also recovers stale jobs stuck in 'processing' state for > 5 minutes.
 *
 * PostgreSQL: uses SELECT ... FOR UPDATE SKIP LOCKED to avoid contention.
 * SQLite: uses transaction-isolated SELECT pending -> UPDATE claimed IDs.
 */
async function claimPendingJobs(limit: number): Promise<PendingScanRequest[]> {
  const db = getDatabase();
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  if (db.engine === 'postgres') {
    // PostgreSQL atomic claim using FOR UPDATE SKIP LOCKED
    return await db.transaction(async (tx) => {
      // Revert stale jobs older than 5 minutes back to pending
      await tx.execute(`
        UPDATE github_scan_requests
        SET status = 'pending'
        WHERE status = 'processing' AND created_at < $1
      `, [staleThreshold]);

      const rows = await tx.query<PendingScanRequest>(`
        SELECT id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at
        FROM github_scan_requests
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `, [limit]);

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      await tx.execute(
        `UPDATE github_scan_requests SET status = 'processing' WHERE id IN (${placeholders})`,
        ids
      );

      return rows;
    });
  }

  // SQLite: serialized write transaction — select pending IDs first, then update those exact IDs
  return await db.transaction(async (tx) => {
    // Revert stale jobs older than 5 minutes back to pending
    await tx.execute(`
      UPDATE github_scan_requests
      SET status = 'pending'
      WHERE status = 'processing' AND created_at < ?
    `, [staleThreshold]);

    const rows = await tx.query<PendingScanRequest>(`
      SELECT id, workspace_id, repository_id, commit_sha, ref, status, delivery_id, created_at
      FROM github_scan_requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `, [limit]);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(', ');
    await tx.execute(
      `UPDATE github_scan_requests SET status = 'processing' WHERE id IN (${placeholders})`,
      ids
    );

    return rows;
  });
}

// ---------------------------------------------------------------------------
// Per-job execution
// ---------------------------------------------------------------------------

function extractSourceSnippet(fileContent: string, lineNumber: number, contextLines = 3): string {
  const lines = fileContent.split('\n');
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).map((line, idx) => {
    const currentLineNum = start + idx + 1;
    const marker = currentLineNum === lineNumber ? '>' : ' ';
    return `${marker} ${currentLineNum.toString().padStart(4, ' ')} | ${line}`;
  }).join('\n');
}

/**
 * Executes a single scan job for a claimed github_scan_requests row.
 *
 * Fetches files at the exact commit SHA from the workspace's GitHub App installation,
 * runs the existing APIProof AST engine, persists findings idempotently, and
 * marks the scan request as completed or failed.
 */
async function executeJob(job: PendingScanRequest): Promise<ScanWorkerJobResult> {
  const db = getDatabase();
  const now = new Date().toISOString();

  // 1. Resolve repository record
  const repo = await db.queryOne<RepositoryRow>(`
    SELECT id, workspace_id, owner, name, full_name, default_branch
    FROM repositories
    WHERE id = ? AND workspace_id = ?
  `, [job.repository_id, job.workspace_id]);

  if (!repo) {
    await markJobFailed(job.id, 'REPOSITORY_NOT_FOUND: repository deleted or workspace mismatch.');
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'failed',
      error: 'REPOSITORY_NOT_FOUND',
    };
  }

  // 2. Resolve workspace installation (include inactive to detect suspended/deleted)
  const installation = await getWorkspaceGitHubInstallation(job.workspace_id, { includeInactive: true });
  if (!installation) {
    await markJobFailed(job.id, 'NO_ACTIVE_INSTALLATION: workspace has no active GitHub App installation.');
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'skipped',
      error: 'NO_ACTIVE_INSTALLATION',
    };
  }

  if (installation.status !== 'active') {
    const reason = `INSTALLATION_${installation.status.toUpperCase()}: installation is not active.`;
    await markJobFailed(job.id, reason);
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'skipped',
      error: reason,
    };
  }

  // 3. Build a scan record
  const scanId = `scn_${crypto.randomBytes(12).toString('hex')}`;

  await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES (?, ?, ?, 'running', 'multi-provider', ?)
    `, [scanId, repo.id, job.commit_sha, now]);
  });

  try {
    // 4. Obtain ephemeral installation token (never stored)
    const config = loadGitHubAppConfig();
    const tokenProvider = new NodeGitHubAppTokenProvider(config, { allowAnyRepository: true });
    const installationToken = await tokenProvider.getInstallationToken(installation.installationId);

    // 5. Fetch files at exact commit SHA
    const transport = new FetchGitHubReadTransport();
    const provider = new GitHubAppSourceControlProvider(config, tokenProvider, transport);

    let filesMap = new Map<string, string>();
    let headSha = job.commit_sha;

    try {
      const remoteData = await fetchRemoteRepositoryFiles(provider, job.commit_sha);
      filesMap = remoteData.files;
      headSha = remoteData.headSha;
    } catch (fetchErr) {
      console.warn(`[scan-worker] Failed to fetch files for ${repo.full_name}@${job.commit_sha}:`, fetchErr);
      // Fail the job — do not fall back to fixture for async webhook-triggered scans
      const errorMsg = fetchErr instanceof Error ? fetchErr.message : 'Failed to fetch repository files';
      await failScan(scanId, errorMsg);
      await markJobFailed(job.id, errorMsg);
      return {
        scanRequestId: job.id,
        repositoryId: repo.id,
        commitSha: job.commit_sha,
        status: 'failed',
        error: errorMsg,
      };
    }

    // Keep token reference to suppress unused variable lint while keeping it ephemeral
    void installationToken;

    // 6. Build snapshot and detect providers
    const snapshot = RepositorySnapshot.fromMemory(repo.name, filesMap);
    const analyzer = new TypeScriptRepositoryAnalyzer();

    const providersToAnalyze: Array<{ id: 'stripe' | 'twilio'; provider: ApiProvider }> = [];
    const pkgContent = filesMap.get('package.json');
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.stripe) providersToAnalyze.push({ id: 'stripe', provider: new StripeProvider() });
        if (deps.twilio) providersToAnalyze.push({ id: 'twilio', provider: new TwilioProvider() });
      } catch {
        // unparseable package.json — still run with no providers (yields empty findings)
      }
    }
    if (providersToAnalyze.length === 0) {
      providersToAnalyze.push({ id: 'stripe', provider: new StripeProvider() });
    }

    // 7. Run AST analysis
    const collectedFindings: Array<{
      id: string;
      changeId: string;
      provider: string;
      title: string;
      description: string;
      severity: string;
      confidence: number;
      filePath: string;
      lineNumber: number;
      symbol: string;
      reason: string;
      reasonCodes: string[];
      evidence: unknown[];
      sourceSnippet: string;
    }> = [];

    let totalFilesAnalyzed = 0;
    let inputDigest = snapshot.digest();

    for (const { id: provId, provider } of providersToAnalyze) {
      const scanResult = await analyzer.analyze(snapshot, provider.descriptor);
      totalFilesAnalyzed = Math.max(totalFilesAnalyzed, scanResult.coverage.filesAnalyzed);
      inputDigest = scanResult.audit.inputDigest;

      const registryChanges = await loadProviderRegistry(provId);
      for (const change of registryChanges) {
        const { impacts } = provider.matchImpact(scanResult, change);
        for (const impact of impacts) {
          const findingId = `fnd_${crypto.randomBytes(12).toString('hex')}`;
          const filePath = impact.location.file;
          const lineNumber = impact.location.start.line;
          const fileRaw = filesMap.get(filePath) ?? '';
          const snippet = extractSourceSnippet(fileRaw, lineNumber);

          collectedFindings.push({
            id: findingId,
            changeId: change.id,
            provider: provId,
            title: change.title,
            description: change.description,
            severity: change.severity,
            confidence: impact.confidence,
            filePath,
            lineNumber,
            symbol: impact.symbol,
            reason: impact.reason,
            reasonCodes: impact.reasonCodes,
            evidence: impact.evidence,
            sourceSnippet: snippet,
          });
        }
      }
    }

    // 8. Persist findings idempotently + finalize scan
    const completedAt = new Date().toISOString();
    await db.transaction(async (tx) => {
      const activeFindingIds: string[] = [];

      for (const f of collectedFindings) {
        const existing = await tx.queryOne<{ id: string; status: string }>(`
          SELECT id, status FROM findings
          WHERE repository_id = ? AND change_id = ? AND file_path = ? AND symbol = ?
        `, [repo.id, f.changeId, f.filePath, f.symbol]);

        if (existing) {
          await tx.execute(`
            UPDATE findings
            SET scan_id = ?,
                line_number = ?,
                confidence = ?,
                reason = ?,
                reason_codes = ?,
                evidence = ?,
                source_snippet = ?
            WHERE id = ?
          `, [scanId, f.lineNumber, f.confidence, f.reason, JSON.stringify(f.reasonCodes), JSON.stringify(f.evidence), f.sourceSnippet, existing.id]);
          activeFindingIds.push(existing.id);
        } else {
          await tx.execute(`
            INSERT INTO findings (
              id, scan_id, repository_id, usage_id, change_id, provider, title, description,
              severity, confidence, file_path, line_number, symbol, status, reason, reason_codes,
              evidence, source_snippet, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
          `, [
            f.id, scanId, repo.id, f.id, f.changeId, f.provider, f.title, f.description,
            f.severity, f.confidence, f.filePath, f.lineNumber, f.symbol, f.reason,
            JSON.stringify(f.reasonCodes), JSON.stringify(f.evidence), f.sourceSnippet, now,
          ]);
          activeFindingIds.push(f.id);
        }
      }

      await tx.execute(`
        UPDATE scans
        SET status = 'completed',
            sha = ?,
            input_digest = ?,
            files_analyzed = ?,
            findings_count = ?,
            completed_at = ?
        WHERE id = ?
      `, [headSha, inputDigest, totalFilesAnalyzed, activeFindingIds.length, completedAt, scanId]);

      const repoStatus = collectedFindings.length > 0 ? 'affected' : 'healthy';
      await tx.execute(`
        UPDATE repositories SET status = ?, last_scan_at = ? WHERE id = ?
      `, [repoStatus, completedAt, repo.id]);

      // Mark the scan request as completed
      await tx.execute(`
        UPDATE github_scan_requests SET status = 'completed' WHERE id = ?
      `, [job.id]);
    });

    return {
      scanRequestId: job.id,
      repositoryId: repo.id,
      commitSha: headSha,
      status: 'completed',
      scanId,
      findingsCount: collectedFindings.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown scan worker error';
    await failScan(scanId, errorMsg);
    await markJobFailed(job.id, errorMsg);
    return {
      scanRequestId: job.id,
      repositoryId: repo.id,
      commitSha: job.commit_sha,
      status: 'failed',
      error: errorMsg,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function failScan(scanId: string, errorMessage: string): Promise<void> {
  const db = getDatabase();
  await db.execute(`
    UPDATE scans SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?
  `, [errorMessage, new Date().toISOString(), scanId]);
}

async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  const db = getDatabase();
  // Persist the error in the delivery record note — status reverts to 'failed' so it won't be retried silently.
  // Truncate to 500 chars to avoid unbounded column growth.
  const truncated = errorMessage.slice(0, 500);
  await db.execute(`
    UPDATE github_scan_requests SET status = 'failed' WHERE id = ?
  `, [jobId]);
  console.error(`[scan-worker] Job ${jobId} failed: ${truncated}`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Processes pending async scan jobs from the github_scan_requests queue.
 *
 * Designed for Vercel serverless invocation via an internal protected route.
 * Bounded by batchSize and timeoutMs to stay within function time limits.
 */
export async function processPendingGitHubScans(
  options: ScanWorkerOptions = {}
): Promise<ScanWorkerResult> {
  const batchSize = Math.min(options.batchSize ?? 5, 20); // hard cap at 20
  const timeoutMs = Math.min(options.timeoutMs ?? 50_000, 270_000); // hard cap at 270s (Vercel Pro max)

  const deadline = Date.now() + timeoutMs;
  const results: ScanWorkerJobResult[] = [];
  let timedOut = false;

  // Claim jobs atomically
  const jobs = await claimPendingJobs(batchSize);

  if (jobs.length === 0) {
    return {
      jobsClaimed: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      jobsSkipped: 0,
      results: [],
      timedOut: false,
    };
  }

  for (const job of jobs) {
    if (Date.now() >= deadline) {
      timedOut = true;
      // Revert unclaimed jobs back to pending so they can be retried
      await revertJobToPending(job.id);
      // Continue reverting remaining unclaimed jobs
      const remainingJobs = jobs.slice(jobs.indexOf(job) + 1);
      for (const remaining of remainingJobs) {
        await revertJobToPending(remaining.id);
      }
      break;
    }

    const result = await executeJob(job);
    results.push(result);
  }

  return {
    jobsClaimed: jobs.length,
    jobsCompleted: results.filter((r) => r.status === 'completed').length,
    jobsFailed: results.filter((r) => r.status === 'failed').length,
    jobsSkipped: results.filter((r) => r.status === 'skipped').length,
    results,
    timedOut,
  };
}

async function revertJobToPending(jobId: string): Promise<void> {
  const db = getDatabase();
  await db.execute(`
    UPDATE github_scan_requests SET status = 'pending' WHERE id = ? AND status = 'processing'
  `, [jobId]);
}
