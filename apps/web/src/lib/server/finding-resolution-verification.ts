import crypto from 'node:crypto';
import type { DatabaseAdapter } from './db/types.js';
import { transitionFinding } from './finding-lifecycle.js';

export const FINDING_RESOLUTION_CLASSIFICATIONS = ['resolved', 'unresolved', 'regressed', 'ambiguous', 'inconclusive'] as const;
export type FindingResolutionClassification = typeof FINDING_RESOLUTION_CLASSIFICATIONS[number];

export function classifyMergedFinding(params: {
  scanCompleted: boolean;
  findingPresent: boolean;
  previousState: string | null | undefined;
  conflictingActiveChange: boolean;
}): FindingResolutionClassification {
  if (!params.scanCompleted) return 'inconclusive';
  if (params.conflictingActiveChange) return 'ambiguous';
  if (!params.findingPresent) return 'resolved';
  if (params.previousState === 'verified_resolved' || params.previousState === 'resolved_legacy') return 'regressed';
  return 'unresolved';
}

export async function recordFindingResolutionVerification(
  db: DatabaseAdapter,
  params: {
    workspaceId: string;
    repositoryId: string;
    findingId: string;
    migrationId: string;
    pullRequestId: string;
    mergeSha: string;
    scanId: string;
    classification: FindingResolutionClassification;
    evidence: Record<string, unknown>;
  },
): Promise<void> {
  const idempotencyKey = `finding-resolution:${params.migrationId}:scan:${params.scanId}`;
  await db.execute(`
    INSERT INTO finding_resolution_verifications
      (id, workspace_id, repository_id, finding_id, migration_id, pull_request_id, merge_sha, scan_id, classification, evidence_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (idempotency_key) DO NOTHING
  `, [
    `frv_${crypto.randomBytes(12).toString('hex')}`,
    params.workspaceId,
    params.repositoryId,
    params.findingId,
    params.migrationId,
    params.pullRequestId,
    params.mergeSha,
    params.scanId,
    params.classification,
    JSON.stringify(params.evidence),
    idempotencyKey,
    new Date().toISOString(),
  ]);
}

export async function persistMergedFindingResolutionEvidence(
  db: DatabaseAdapter,
  params: {
    workspaceId: string;
    repositoryId: string;
    scanId: string;
    mergeSha: string;
    activeFindingIds: string[];
    activeChangeIds: Set<string>;
    findingPreviousStates: Map<string, string | null>;
  },
): Promise<void> {
  const rows = await db.query<{
    migration_id: string;
    finding_id: string;
    pull_request_id: string;
    merge_sha: string;
    baseline_sha: string | null;
    change_id: string;
    lifecycle_state: string | null;
  }>(`
    SELECT m.id AS migration_id, m.finding_id, pr.id AS pull_request_id,
      pr.merge_sha, m.baseline_sha, f.change_id, f.lifecycle_state
    FROM migrations m
    JOIN pull_requests pr ON pr.migration_id = m.id
    JOIN findings f ON f.id = m.finding_id AND f.repository_id = m.repository_id
    WHERE m.repository_id = ?
      AND pr.repository_id = ?
      AND pr.state = 'merged'
      AND pr.merge_sha = ?
  `, [params.repositoryId, params.repositoryId, params.mergeSha]);
  const protectedFindingIds = new Set(
    rows
      .filter((row) => !params.activeFindingIds.includes(row.finding_id) && params.activeChangeIds.has(row.change_id))
      .map((row) => row.finding_id),
  );

  const excludedFindingIds = [...new Set([...params.activeFindingIds, ...protectedFindingIds])];
  const placeholders = excludedFindingIds.map(() => '?').join(', ');
  const absentFindings = await db.query<{ id: string; lifecycle_state: string | null }>(`
    SELECT id, lifecycle_state FROM findings
    WHERE repository_id = ?
      AND COALESCE(lifecycle_state, 'open') IN ('open', 'acknowledged', 'remediating', 'reopened', 'fixed_pending_verification')
      ${excludedFindingIds.length > 0 ? `AND id NOT IN (${placeholders})` : ''}
  `, [params.repositoryId, ...excludedFindingIds]);
  for (const finding of absentFindings) {
    await transitionFinding(db, {
      findingId: finding.id,
      workspaceId: params.workspaceId,
      toState: 'verified_resolved',
      reason: 'finding_absent_from_completed_scan',
      idempotencyKey: `finding:${finding.id}:scan:${params.scanId}:verified-resolved`,
      evidence: { scanId: params.scanId, baselineSha: params.mergeSha },
    });
  }

  for (const row of rows) {
    const findingPresent = params.activeFindingIds.includes(row.finding_id);
    const conflictingActiveChange = protectedFindingIds.has(row.finding_id);
    const previousState = params.findingPreviousStates.get(row.finding_id) ?? row.lifecycle_state;
    const classification = classifyMergedFinding({
      scanCompleted: row.baseline_sha !== params.mergeSha,
      findingPresent,
      previousState,
      conflictingActiveChange,
    });
    await recordFindingResolutionVerification(db, {
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      findingId: row.finding_id,
      migrationId: row.migration_id,
      pullRequestId: row.pull_request_id,
      mergeSha: row.merge_sha,
      scanId: params.scanId,
      classification,
      evidence: {
        baselineSha: row.baseline_sha,
        mergeSha: row.merge_sha,
        scanId: params.scanId,
        findingPresent,
        conflictingActiveChange,
        previousState,
        currentFindingIds: params.activeFindingIds,
      },
    });
  }
}

