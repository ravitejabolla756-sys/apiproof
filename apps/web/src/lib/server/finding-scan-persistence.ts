import type { DatabaseAdapter } from './db/types.js';
import { recordFindingCreated, transitionFinding } from './finding-lifecycle.js';
import type { ProductizationFinding } from './productization-worker.js';

export async function upsertFindingForScan(
  db: DatabaseAdapter,
  params: {
    finding: ProductizationFinding;
    scanId: string;
    repositoryId: string;
    workspaceId: string;
    now: string;
  },
): Promise<{ id: string; isNew: boolean; previousState: string | null }> {
  const { finding, scanId, repositoryId, workspaceId, now } = params;
  const existing = await db.queryOne<{ id: string; lifecycle_state: string | null }>(`
    SELECT id, lifecycle_state FROM findings
    WHERE repository_id = ? AND change_id = ? AND file_path = ? AND symbol = ?
  `, [repositoryId, finding.changeId, finding.filePath, finding.symbol]);

  if (existing) {
    if (existing.lifecycle_state === 'verified_resolved' || existing.lifecycle_state === 'resolved_legacy') {
      await transitionFinding(db, {
        findingId: existing.id,
        workspaceId,
        toState: 'reopened',
        reason: 'finding_reappeared_in_scan',
        idempotencyKey: `finding:${existing.id}:scan:${scanId}:reopened`,
        evidence: { scanId },
      });
    }
    await db.execute(`
      UPDATE findings
      SET scan_id = ?, line_number = ?, confidence = ?, reason = ?, reason_codes = ?,
          evidence = ?, source_snippet = ?, source_digest = ?
      WHERE id = ?
    `, [scanId, finding.lineNumber, finding.confidence, finding.reason, JSON.stringify(finding.reasonCodes), JSON.stringify(finding.evidence), finding.sourceSnippet, finding.sourceDigest, existing.id]);
    return { id: existing.id, isNew: false, previousState: existing.lifecycle_state };
  }

  await db.execute(`
    INSERT INTO findings (
      id, scan_id, repository_id, usage_id, change_id, provider, title, description,
      severity, confidence, file_path, line_number, symbol, status, reason, reason_codes,
      evidence, source_snippet, source_digest, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
  `, [
    finding.id, scanId, repositoryId, finding.id, finding.changeId, finding.provider, finding.title, finding.description,
    finding.severity, finding.confidence, finding.filePath, finding.lineNumber, finding.symbol, finding.reason,
    JSON.stringify(finding.reasonCodes), JSON.stringify(finding.evidence), finding.sourceSnippet, finding.sourceDigest, now,
  ]);
  await recordFindingCreated(db, { findingId: finding.id, repositoryId, workspaceId, scanId });
  return { id: finding.id, isNew: true, previousState: null };
}

