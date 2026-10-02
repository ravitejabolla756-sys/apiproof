import crypto from 'node:crypto';
import { DeterministicPlanner, formatCanonicalMigrationBranch } from '@apiproof/core';
import type { PlanningInput } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { loadProviderRegistry } from './registry-utils.js';
import { requireFindingAccess } from './workspace-service.js';

export interface MigrationPlanRecord {
  id: string;
  findingId: string;
  repositoryId: string;
  planId: string;
  status: string;
  targetBranch?: string | undefined;
  target_branch?: string | undefined;
  baselineSha?: string | undefined;
  baseline_sha?: string | undefined;
  plan: unknown;
  patchDiff: string | null;
  createdAt: string;
}

export async function generateMigrationForFinding(findingId: string, userId: string): Promise<MigrationPlanRecord> {
  const db = getDatabase();

  // 1. Fetch finding and ensure workspace membership (central authorization / IDOR protection)
  const { finding: rawFinding, repository: repo } = await requireFindingAccess(findingId, userId);
  const finding = {
    ...rawFinding,
    provider: rawFinding.provider as 'stripe' | 'twilio',
    repo_full_name: repo.full_name,
    repo_name: repo.name,
    repo_owner: repo.owner,
  };

  // 2. Load registry change definition
  const registryChanges = await loadProviderRegistry(finding.provider);
  const change = registryChanges.find((c: { id: string }) => c.id === finding.change_id);
  if (!change) {
    throw new Error(`Change definition ${finding.change_id} not found in ${finding.provider} registry.`);
  }

  // 3. Construct PlanningInput
  const parsedEvidence = JSON.parse(finding.evidence) as Array<{ detail?: string }>;
  const parsedReasonCodes = JSON.parse(finding.reason_codes) as string[];

  const baseEvidenceId = `impact:${finding.usage_id}`;
  const planningInput: PlanningInput = {
    change: change as unknown as PlanningInput['change'],
    repository: finding.repo_full_name,
    analysisDigest: crypto.createHash('sha256').update(finding.id).digest('hex'),
    impacts: [
      {
        usageId: finding.usage_id,
        changeId: finding.change_id,
        symbol: finding.symbol,
        location: {
          file: finding.file_path,
          start: { line: finding.line_number, column: 1 },
          end: { line: finding.line_number, column: 50 },
        },
        reason: finding.reason,
        confidence: finding.confidence,
        versionAssessment: 'unknown',
        reasonCodes: parsedReasonCodes,
      },
    ],
    evidence: [
      {
        id: `change:${change.id}`,
        kind: 'change',
        label: `Reviewed change record ${change.id}.`,
        changeId: change.id,
      },
      {
        id: baseEvidenceId,
        kind: 'impact',
        label: `${finding.symbol} affected at ${finding.file_path}:${finding.line_number}`,
        changeId: change.id,
        symbol: finding.symbol,
      },
      ...parsedEvidence.map((ev, idx: number) => ({
        id: `impact:${finding.usage_id}:${idx}`,
        kind: 'impact' as const,
        label: ev.detail ?? 'Evidence item',
        changeId: change.id,
      })),
    ],
    facts: [
      {
        id: `fact:change:${change.id}`,
        kind: 'change',
        statement: `Change record ${change.id} is official and reviewed.`,
        evidenceIds: [`change:${change.id}`],
      },
      {
        id: `fact:operation:${finding.usage_id}`,
        kind: 'operation',
        statement: `Affected operation: ${finding.symbol}.`,
        evidenceIds: [baseEvidenceId],
      },
      {
        id: `fact:location:${finding.usage_id}`,
        kind: 'location',
        statement: `Location: ${finding.file_path}:${finding.line_number}`,
        evidenceIds: [baseEvidenceId],
      },
    ],
    snippets: finding.source_snippet ? [
      {
        evidenceId: baseEvidenceId,
        file: finding.file_path,
        startLine: Math.max(1, finding.line_number - 2),
        endLine: finding.line_number + 2,
        text: finding.source_snippet,
        redacted: false,
      }
    ] : [],
    warnings: [],
    unresolvedQuestions: [],
    migrationInstructions: change.migrationInstructions ?? [],
    bounds: { maxSnippetLines: 24, maxSnippetChars: 12_000, maxTotalChars: 64_000 },
    sourceDigest: crypto.createHash('sha256').update(finding.source_snippet ?? '').digest('hex'),
  };

  // 4. Run DeterministicPlanner
  const planner = new DeterministicPlanner();
  const plan = await planner.plan(planningInput);

  // Planning records intent only. The executable diff and resulting source
  // are produced later by migration-verification.ts from the exact baseline.
  const patchDiff: string | null = null;
  const patchDigest: string | null = null;
  const migrationId = `mig_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  // Query baseline SHA from the scan that produced this finding
  const scanRecord = await db.queryOne<{ sha: string }>(`
    SELECT s.sha
    FROM findings f
    JOIN scans s ON f.scan_id = s.id
    WHERE f.id = ?
  `, [finding.id]);
  const baselineSha = scanRecord?.sha;

  // 6. Save migration, update finding status, and emit activity inside a single transaction
  await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO migrations (
        id, finding_id, repository_id, plan_id, status, plan_json, patch_diff, patch_digest, baseline_sha, created_at
      ) VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?)
    `, [
      migrationId,
      finding.id,
      finding.repository_id,
      plan.generatedBy.changeDigest,
      JSON.stringify(plan),
      patchDiff,
      patchDigest,
      baselineSha ?? null,
      now
    ]);

    await tx.execute(`
      UPDATE findings
      SET status = 'migration_planned'
      WHERE id = ?
    `, [finding.id]);

    await tx.execute(`
      INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `act_${crypto.randomBytes(10).toString('hex')}`,
      userId,
      finding.repository_id,
      'migration_planned',
      'Migration Plan Generated',
      `Generated deterministic migration plan for ${finding.change_id} in ${finding.file_path}.`,
      now
    ]);
  });

  const branchName = formatCanonicalMigrationBranch(finding.change_id, migrationId);

  return {
    id: migrationId,
    findingId: finding.id,
    repositoryId: finding.repository_id,
    planId: plan.generatedBy.changeDigest,
    status: 'planned',
    targetBranch: branchName,
    target_branch: branchName,
    baselineSha,
    baseline_sha: baselineSha,
    plan,
    patchDiff,
    createdAt: now,
  };
}
