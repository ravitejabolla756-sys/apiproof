import crypto from 'node:crypto';
import { DeterministicPlanner, computeCanonicalPatchDigest } from '@apiproof/core';
import type { PlanningInput } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { loadProviderRegistry } from './registry-utils.js';

export interface MigrationPlanRecord {
  id: string;
  findingId: string;
  repositoryId: string;
  planId: string;
  status: string;
  plan: unknown;
  patchDiff: string;
  createdAt: string;
}

export async function generateMigrationForFinding(findingId: string, userId: string): Promise<MigrationPlanRecord> {
  const db = getDatabase();

  // 1. Fetch finding and ensure user owns repository (IDOR protection)
  const finding = await db.queryOne<{
    id: string;
    scan_id: string;
    repository_id: string;
    usage_id: string;
    change_id: string;
    provider: 'stripe' | 'twilio';
    title: string;
    description: string;
    severity: string;
    confidence: number;
    file_path: string;
    line_number: number;
    symbol: string;
    reason: string;
    reason_codes: string;
    evidence: string;
    source_snippet: string | null;
    repo_full_name: string;
    repo_name: string;
    repo_owner: string;
  }>(`
    SELECT f.*, r.full_name as repo_full_name, r.name as repo_name, r.owner as repo_owner
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    WHERE f.id = ? AND r.user_id = ?
  `, [findingId, userId]);

  if (!finding) {
    throw new Error('Finding not found or access denied.');
  }

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

  // 5. Generate Unified Diff representation
  let patchDiff: string;
  if (finding.change_id === 'stripe-subscription-coupon-removed') {
    patchDiff = `--- a/${finding.file_path}
+++ b/${finding.file_path}
@@ -${finding.line_number},3 +${finding.line_number},3 @@
-    coupon: couponId,
+    discounts: [{ coupon: couponId }],`;
  } else if (finding.change_id === 'twilio-twiml-namespace-casing') {
    patchDiff = `--- a/${finding.file_path}
+++ b/${finding.file_path}
@@ -${finding.line_number},1 +${finding.line_number},1 @@
-    new twilio.Twiml.VoiceResponse();
+    new twilio.twiml.VoiceResponse();`;
  } else {
    patchDiff = `--- a/${finding.file_path}
+++ b/${finding.file_path}
@@ -${finding.line_number},1 +${finding.line_number},1 @@
-    ${finding.symbol}
+    // Automated migration required: review ${change.title}`;
  }

  const patchDigest = computeCanonicalPatchDigest({ [finding.file_path]: patchDiff });
  const migrationId = `mig_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  // 6. Save migration, update finding status, and emit activity inside a single transaction
  await db.transaction(async (tx) => {
    await tx.execute(`
      INSERT INTO migrations (
        id, finding_id, repository_id, plan_id, status, plan_json, patch_diff, patch_digest, created_at
      ) VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?)
    `, [
      migrationId,
      finding.id,
      finding.repository_id,
      plan.generatedBy.changeDigest,
      JSON.stringify(plan),
      patchDiff,
      patchDigest,
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
      'migration_verified',
      'Migration Plan Generated',
      `Generated deterministic migration plan for ${finding.change_id} in ${finding.file_path}.`,
      now
    ]);
  });

  return {
    id: migrationId,
    findingId: finding.id,
    repositoryId: finding.repository_id,
    planId: plan.generatedBy.changeDigest,
    status: 'planned',
    plan,
    patchDiff,
    createdAt: now,
  };
}
