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
import { enqueueNewFindingNotifications } from './slack-notifications.js';
import { getWorkspaceGitHubInstallation } from './workspace-service.js';
import { fetchRemoteRepositoryFiles, createWorkspaceGitHubSourceControlProvider } from './github.js';
import { TypeScriptRepositoryAnalyzer, RepositorySnapshot, discoverProviders } from '@apiproof/analyzers';
import { StripeProvider, TwilioProvider, DISCOVERY_PROVIDER_REGISTRY } from '@apiproof/providers';
import type { ApiProvider } from '@apiproof/core';
import type { ScanResult } from '@apiproof/shared';
import { loadProviderRegistry } from './registry-utils.js';
import { ensureScanWorkerSchema, failScan, markScanWorkerJobFailed, revertScanWorkerJobToPending, withSqliteClaimLock } from './scan-worker-state.js';
import { logger } from './logger.js';
import { summarizeScanCompatibility } from './scan-compatibility-evidence.js';
import { scanResultWithDiscovery } from './scan-discovery-evidence.js';
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

export interface ScanWorkerMetrics {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalScanRequests: number;
  lastProcessedAt: string | null;
}

/**
 * Returns operational aggregate queue metrics for monitoring and worker health.
 * Aggregates counters safely without exposing workspace-specific data across tenants.
 */
export async function getScanWorkerMetrics(): Promise<ScanWorkerMetrics> {
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
    const c = Number(row.count);
    map[row.status] = c;
    total += c;
  }

  const lastJob = await db.queryOne<{ created_at: string }>(`
    SELECT created_at FROM github_scan_requests WHERE status IN ('completed', 'failed') ORDER BY created_at DESC LIMIT 1
  `);

  return {
    pendingJobs: map.pending ?? 0,
    processingJobs: map.processing ?? 0,
    completedJobs: map.completed ?? 0,
    failedJobs: map.failed ?? 0,
    totalScanRequests: total,
    lastProcessedAt: lastJob?.created_at ?? null,
  };
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
  attempt_count: number;
  claimed_at: string | null;
  lease_expires_at: string | null;
}

interface RepositoryRow {
  id: string;
  workspace_id: string;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
}

// ---------------------------------------------------------------------------
// Job claiming
// ---------------------------------------------------------------------------

/**
 * Claims up to `limit` pending scan requests atomically.
 * Also recovers expired leases. Legacy rows without a lease are recovered
 * only when their original creation timestamp is older than the safety window.
 *
 * PostgreSQL: uses SELECT ... FOR UPDATE SKIP LOCKED to avoid contention.
 * SQLite: uses transaction-isolated SELECT pending -> UPDATE claimed IDs.
 */
async function claimPendingJobs(limit: number): Promise<PendingScanRequest[]> {
  const db = getDatabase();
  await ensureScanWorkerSchema(db);
  const now = new Date();
  const nowIso = now.toISOString();
  const legacyStaleThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const leaseExpiry = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  if (db.engine === 'postgres') {
    // PostgreSQL atomic claim using FOR UPDATE SKIP LOCKED
    return await db.transaction(async (tx) => {
      // Recover only expired leases. created_at is not a valid worker lease.
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

      if (rows.length === 0) {
        return [];
      }

      const ids = rows.map((r) => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      await tx.execute(
        `UPDATE github_scan_requests
         SET status = 'processing', claimed_at = $${ids.length + 1}, lease_expires_at = $${ids.length + 2},
             attempt_count = attempt_count + 1
         WHERE id IN (${placeholders})`,
        [...ids, nowIso, leaseExpiry]
      );

      return rows;
    });
  }

  // SQLite: serialized write transaction — select pending IDs first, then update those exact IDs
  return await withSqliteClaimLock(() => db.transaction(async (tx) => {
    // Recover only expired leases. created_at is not a valid worker lease.
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

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(', ');
    await tx.execute(
      `UPDATE github_scan_requests
       SET status = 'processing', claimed_at = ?, lease_expires_at = ?, attempt_count = attempt_count + 1
       WHERE id IN (${placeholders})`,
      [nowIso, leaseExpiry, ...ids]
    );

    return rows;
  }));
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
  const startedAtMs = Date.now();

  // 1. Resolve repository record
  const repo = await db.queryOne<RepositoryRow>(`
    SELECT id, workspace_id, owner, name, full_name, github_repository_id, default_branch, lifecycle
    FROM repositories
    WHERE id = ? AND workspace_id = ? AND lifecycle = 'active'
  `, [job.repository_id, job.workspace_id]);

  if (!repo) {
    await markScanWorkerJobFailed(db, job, 'REPOSITORY_NOT_FOUND', 'repository deleted or workspace mismatch.');
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'failed',
      error: 'REPOSITORY_NOT_FOUND',
    };
  }

  const expectedRef = `refs/heads/${repo.default_branch}`;
  if (job.ref !== expectedRef) {
    await markScanWorkerJobFailed(db, job, 'REF_MISMATCH', `scan ref does not match repository default branch ${repo.default_branch}.`);
    return {
      scanRequestId: job.id,
      repositoryId: repo.id,
      commitSha: job.commit_sha,
      status: 'failed',
      error: 'REF_MISMATCH',
    };
  }

  // 2. Resolve workspace installation (include inactive to detect suspended/deleted)
  const installation = await getWorkspaceGitHubInstallation(job.workspace_id, { includeInactive: true });
  if (!installation) {
    await markScanWorkerJobFailed(db, job, 'NO_ACTIVE_INSTALLATION', 'workspace has no active GitHub App installation.');
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'skipped',
      error: 'NO_ACTIVE_INSTALLATION',
    };
  }

  if (installation.status !== 'active') {
    const category = `INSTALLATION_${installation.status.toUpperCase()}`;
    const reason = `${category}: installation is not active.`;
    await markScanWorkerJobFailed(db, job, category, reason);
    return {
      scanRequestId: job.id,
      repositoryId: job.repository_id,
      commitSha: job.commit_sha,
      status: 'skipped',
      error: reason,
    };
  }

  // 3. Reuse the durable scan row created by the webhook when possible.
  // This prevents retries/reconciliation from producing duplicate scan records.
  const existingScan = await db.queryOne<{ id: string; status: string }>(`
    SELECT id, status FROM scans
    WHERE repository_id = ? AND sha = ?
    ORDER BY started_at ASC LIMIT 1
  `, [repo.id, job.commit_sha]);
  const scanId = existingScan?.id ?? `scn_${crypto.randomBytes(12).toString('hex')}`;

  if (existingScan?.status === 'completed') {
    await db.execute(`
      UPDATE github_scan_requests
      SET status = 'completed', claimed_at = NULL, lease_expires_at = NULL
      WHERE id = ? AND status = 'processing'
    `, [job.id]);
    return {
      scanRequestId: job.id,
      repositoryId: repo.id,
      commitSha: job.commit_sha,
      status: 'completed',
      scanId,
    };
  }

  await db.execute(existingScan
    ? `UPDATE scans SET status = 'running', error_message = NULL, started_at = ? WHERE id = ?`
    : `INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
       VALUES (?, ?, ?, 'running', 'multi-provider', ?)`,
    existingScan ? [now, scanId] : [scanId, repo.id, job.commit_sha, now]);

  try {
    // 5. Fetch files at exact commit SHA
    const provider = createWorkspaceGitHubSourceControlProvider({
      installationId: installation.installationId,
      repositoryId: repo.github_repository_id,
      owner: repo.owner,
      repository: repo.name,
    });

    let filesMap = new Map<string, string>();
    let headSha = job.commit_sha;

    try {
      const remoteData = await fetchRemoteRepositoryFiles(provider, job.commit_sha);
      filesMap = remoteData.files;
      headSha = remoteData.headSha;
      if (headSha !== job.commit_sha) {
        throw new Error('BASELINE_SHA_MISMATCH: GitHub returned a different source revision.');
      }
    } catch (fetchErr) {
      // Fail the job — do not fall back to fixture for async webhook-triggered scans
      const errorMsg = fetchErr instanceof Error ? fetchErr.message : 'SOURCE_FETCH_FAILED';
      await failScan(db, scanId, errorMsg);
      const category = errorMsg.startsWith('GITHUB_') ? 'GITHUB_NETWORK' : 'SOURCE_FETCH_FAILED';
      await markScanWorkerJobFailed(db, job, category, errorMsg, { repositoryFullName: repo.full_name, durationMs: Date.now() - startedAtMs });
      return {
        scanRequestId: job.id,
        repositoryId: repo.id,
        commitSha: job.commit_sha,
        status: 'failed',
        error: errorMsg,
      };
    }

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
      sourceDigest: string;
    }> = [];

    let totalFilesAnalyzed = 0, inputDigest = snapshot.digest();
    const compatibilityResults: ScanResult[] = [];

    for (const { id: provId, provider } of providersToAnalyze) {
      const scanResult = await analyzer.analyze(snapshot, provider.descriptor);
      compatibilityResults.push(scanResult);
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
            sourceDigest: crypto.createHash('sha256').update(fileRaw).digest('hex'),
          });
        }
      }
    }

    // 8. Persist findings idempotently + finalize scan
    const completedAt = new Date().toISOString(), newlyCreatedFindingIds: string[] = [];
    const discoveredProviders = discoverProviders(filesMap, DISCOVERY_PROVIDER_REGISTRY);
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
                source_snippet = ?,
                source_digest = ?
            WHERE id = ?
          `, [scanId, f.lineNumber, f.confidence, f.reason, JSON.stringify(f.reasonCodes), JSON.stringify(f.evidence), f.sourceSnippet, f.sourceDigest, existing.id]);
          activeFindingIds.push(existing.id);
        } else {
          await tx.execute(`
            INSERT INTO findings (
              id, scan_id, repository_id, usage_id, change_id, provider, title, description,
              severity, confidence, file_path, line_number, symbol, status, reason, reason_codes,
              evidence, source_snippet, source_digest, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
          `, [
            f.id, scanId, repo.id, f.id, f.changeId, f.provider, f.title, f.description,
            f.severity, f.confidence, f.filePath, f.lineNumber, f.symbol, f.reason,
            JSON.stringify(f.reasonCodes), JSON.stringify(f.evidence), f.sourceSnippet, f.sourceDigest, now,
          ]);
          activeFindingIds.push(f.id); newlyCreatedFindingIds.push(f.id);
        }
      }

      // Findings are a current-snapshot view. A finding that was not observed
      // in this complete baseline is resolved, while historical migration/PR
      // statuses remain immutable for auditability.
      if (activeFindingIds.length > 0) {
        const placeholders = activeFindingIds.map(() => '?').join(', ');
        await tx.execute(`
          UPDATE findings
          SET status = 'resolved'
          WHERE repository_id = ?
            AND status IN ('open', 'affected')
            AND id NOT IN (${placeholders})
        `, [repo.id, ...activeFindingIds]);
      } else {
        await tx.execute(`
          UPDATE findings SET status = 'resolved'
          WHERE repository_id = ? AND status IN ('open', 'affected')
        `, [repo.id]);
      }

      await tx.execute(`
        UPDATE scans
        SET status = 'completed',
            sha = ?,
            input_digest = ?,
            files_analyzed = ?,
            findings_count = ?,
            raw_result = ?,
            completed_at = ?
        WHERE id = ?
      `, [headSha, inputDigest, totalFilesAnalyzed, activeFindingIds.length,
        JSON.stringify(scanResultWithDiscovery(summarizeScanCompatibility(compatibilityResults), discoveredProviders)), completedAt, scanId]);

      await tx.execute(`
        UPDATE repositories SET status = ?, last_scan_at = ? WHERE id = ?
      `, [collectedFindings.length > 0 ? 'affected' : 'healthy', completedAt, repo.id]);

      // Mark the scan request as completed
      await tx.execute(`
        UPDATE github_scan_requests
        SET status = 'completed', claimed_at = NULL, lease_expires_at = NULL,
            last_error_category = NULL, last_error_message = NULL
        WHERE id = ? AND status = 'processing'
      `, [job.id]);
      await enqueueNewFindingNotifications(newlyCreatedFindingIds, tx); });

    logger.info('scan_worker_job_completed', {
      scanRequestId: job.id,
      repositoryId: repo.id,
      repositoryFullName: repo.full_name,
      commitSha: headSha,
      attempt: job.attempt_count,
      finalStatus: 'completed',
      findingsCount: collectedFindings.length,
      durationMs: Date.now() - startedAtMs,
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
    await failScan(db, scanId, errorMsg);
    await markScanWorkerJobFailed(db, job, 'SCAN_EXECUTION_FAILED', errorMsg, {
      repositoryFullName: repo.full_name,
      durationMs: Date.now() - startedAtMs,
    });
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
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Processes pending async scan jobs from the github_scan_requests queue.
 *
 * Designed for Vercel serverless invocation via an internal protected route.
 * Bounded by batchSize and timeoutMs to stay within function time limits.
 */
export async function processPendingGitHubScans(options: ScanWorkerOptions = {}): Promise<ScanWorkerResult> {
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
      await revertScanWorkerJobToPending(getDatabase(), job.id);
      // Continue reverting remaining unclaimed jobs
      const remainingJobs = jobs.slice(jobs.indexOf(job) + 1);
      for (const remaining of remainingJobs) {
        await revertScanWorkerJobToPending(getDatabase(), remaining.id);
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
