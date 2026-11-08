import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyCandidate, buildPatchContext, cleanupPatchWorkspace, createSourcePatchWorkspace, deterministicPlan, DeterministicPatchGenerator, FakeSandbox } from '@apiproof/core';
import { PlanningInputSchema } from '@apiproof/shared';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { isApprovedDynamicProductionChange, loadActiveProductionRegistry, loadApprovedDynamicPatchRule, loadProviderRegistry } from '../apps/web/src/lib/server/registry-utils.js';
import { approveProviderRuleCandidate, editProviderRuleCandidate, rejectProviderRuleCandidate } from '../apps/web/src/lib/server/provider-rule-service.js';
import { verifyMigrationForProposal } from '../apps/web/src/lib/server/migration-verification.js';

const reviewEvidence = (affected: string, unaffected: string) => ({
  cases: [
    { kind: 'affected', filePath: 'review/affected.ts', code: affected, rationale: 'The reviewed token is present in the affected usage.' },
    { kind: 'unaffected', filePath: 'review/unaffected.ts', code: unaffected, rationale: 'The reviewed token is absent from this unaffected usage.' },
    { kind: 'uncertain', filePath: 'review/uncertain.ts', code: 'const value = maybeDynamicInput;', rationale: 'This usage requires human follow-up because its meaning is ambiguous.' },
  ],
});

const DB_PATH = path.resolve('.tmp/provider-rule-scope.db');
const now = '2026-10-29T00:00:00.000Z';

async function seedApprovedRule(workspaceId: string, candidateId: string, changeId: string): Promise<void> {
  const db = getDatabase();
  await db.execute(`INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [workspaceId, workspaceId, workspaceId, now, now]);
  await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'slack', ?, 'official-changelog', 'profiled-official-source', ?, ?)`, [`source-${workspaceId}`, `https://api.slack.com/changelog/${workspaceId}`, now, now]);
  await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'slack', ?, 'Scoped change', 'Scoped change description', 'test', ?, ?, '{}', ?, ?)`, [`entry-${workspaceId}`, `source-${workspaceId}`, changeId, `https://api.slack.com/changelog/${workspaceId}`, 'a'.repeat(64), now, now]);
  const payload = {
    changeId,
    title: 'Scoped Slack operation removal',
    description: 'A reviewed workspace-scoped operation removal.',
    changeType: 'endpoint_removed',
    applicabilityScope: { dimensions: ['provider', 'operation'] },
    apiOperationPatterns: ['conversations.history'],
    affectedResources: ['conversations.history'],
    affectedPackages: ['@slack/web-api'],
    sourceFacts: ['The official source documents the operation removal.'],
    replacement: { operation: 'conversations.list' },
    severity: 'high',
    migrationTemplate: {
      transformation: { kind: 'member-rename', from: 'history', to: 'list', receiver: 'conversations', preserveArguments: true },
      sources: [`https://api.slack.com/changelog/${workspaceId}`],
      limitations: ['Only direct conversations.history member calls are eligible.'],
    },
  };
  await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, workspace_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at, reviewed_by, reviewed_at, review_notes) VALUES (?, ?, ?, 'slack', ?, 'approved', 'high', ?, ?, ?, 'reviewer', '2026-10-29', 'Reviewed')`, [candidateId, `entry-${workspaceId}`, workspaceId, `fingerprint-${workspaceId}`, JSON.stringify(payload), now, now]);
}

async function seedPendingRule(workspaceId: string, candidateId: string): Promise<void> {
  const db = getDatabase();
  await db.execute(`INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [workspaceId, workspaceId, workspaceId, now, now]);
  await db.execute(`INSERT INTO provider_change_sources (id, provider_id, source_url, source_type, adapter_id, created_at, updated_at) VALUES (?, 'slack', ?, 'official-changelog', 'profiled-official-source', ?, ?)`, [`pending-source-${workspaceId}`, `https://api.slack.com/changelog/pending-${workspaceId}`, now, now]);
  await db.execute(`INSERT INTO provider_changelog_entries (id, source_id, provider_id, entry_key, title, description, source_locator, source_url, content_hash, evidence_json, first_seen_at, last_seen_at) VALUES (?, ?, 'slack', ?, 'Pending change', 'Pending change description', 'test', ?, ?, '{}', ?, ?)`, [`pending-entry-${workspaceId}`, `pending-source-${workspaceId}`, `pending-change-${workspaceId}`, `https://api.slack.com/changelog/pending-${workspaceId}`, 'b'.repeat(64), now, now]);
  const payload = {
    changeId: `pending-change-${workspaceId}`,
    title: 'Pending Slack operation removal',
    description: 'A pending workspace-scoped operation removal.',
    changeType: 'endpoint_removed',
    applicabilityScope: { dimensions: ['provider', 'operation'] },
    apiOperationPatterns: ['conversations.history'],
    sourceFacts: ['The official source documents the operation removal.'],
    severity: 'high',
  };
  await db.execute(`INSERT INTO provider_rule_candidates (id, changelog_entry_id, workspace_id, provider_id, candidate_fingerprint, status, severity, payload_json, created_at, updated_at) VALUES (?, ?, ?, 'slack', ?, 'needs_review', 'high', ?, ?, ?)`, [candidateId, `pending-entry-${workspaceId}`, workspaceId, `pending-fingerprint-${workspaceId}`, JSON.stringify(payload), now, now]);
}

describe('provider rule workspace scope', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = DB_PATH;
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    initDatabase(DB_PATH);
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  });

  it('loads approved dynamic rules only for the requested workspace', async () => {
    await seedApprovedRule('workspace-a', 'candidate-a', 'workspace-change-a');
    await seedApprovedRule('workspace-b', 'candidate-b', 'workspace-change-b');

    const registryA = await loadActiveProductionRegistry('workspace-a');
    const registryB = await loadActiveProductionRegistry('workspace-b');

    expect(registryA.changes.some((change) => change.changeId === 'workspace-change-a')).toBe(true);
    expect(registryA.changes.some((change) => change.changeId === 'workspace-change-b')).toBe(false);
    expect(registryB.changes.some((change) => change.changeId === 'workspace-change-b')).toBe(true);
    expect(registryB.changes.some((change) => change.changeId === 'workspace-change-a')).toBe(false);
  });

  it('binds an approved migration template to the workspace-scoped change digest', async () => {
    await seedApprovedRule('workspace-a', 'candidate-a', 'workspace-change-a');

    const change = (await loadProviderRegistry('slack', 'workspace-a')).find((candidate) => candidate.id === 'workspace-change-a');
    const rule = await loadApprovedDynamicPatchRule('slack', 'workspace-change-a', 'workspace-a');

    expect(change).toBeDefined();
    expect(rule?.transformation.kind).toBe('member-rename');
    expect(rule?.changeDigest).toBe(crypto.createHash('sha256').update(JSON.stringify(change)).digest('hex'));
    await expect(loadApprovedDynamicPatchRule('slack', 'workspace-change-a', 'workspace-b')).resolves.toBeUndefined();
  });

  it('takes an approved dynamic template through deterministic patch generation', async () => {
    await seedApprovedRule('workspace-a', 'candidate-a', 'workspace-change-a');
    const change = (await loadProviderRegistry('slack', 'workspace-a')).find((candidate) => candidate.id === 'workspace-change-a')!;
    const rule = (await loadApprovedDynamicPatchRule('slack', 'workspace-change-a', 'workspace-a'))!;
    const source = "import { WebClient } from '@slack/web-api';\nconst client = new WebClient();\nexport async function load() { return client.conversations.history({ channel: 'C123' }); }\n";
    const workspace = await createSourcePatchWorkspace('dynamic-slack', { 'src/slack.ts': source });
    try {
      const planning = PlanningInputSchema.parse({
        change, repository: workspace.directory,
        impacts: [{ usageId: 'usage-history', changeId: change.id, symbol: 'conversations.history', location: { file: 'src/slack.ts', start: { line: 3, column: 1 }, end: { line: 3, column: 100 } }, reason: 'Reviewed operation removal.', confidence: 0.98, versionAssessment: 'unknown', reasonCodes: ['MATCHED_OPERATION'] }],
        facts: [{ id: 'fact:location:usage-history', kind: 'location', statement: 'Affected source location: src/slack.ts:3:1.', evidenceIds: ['impact:usage-history'] }],
        evidence: [{ id: `change:${change.id}`, kind: 'change', label: 'Reviewed dynamic change.', changeId: change.id }, { id: 'impact:usage-history', kind: 'impact', label: 'Affected operation.', changeId: change.id, symbol: 'conversations.history' }],
        snippets: [{ evidenceId: 'impact:usage-history', file: 'src/slack.ts', startLine: 1, endLine: 3, text: source, redacted: false }], migrationInstructions: change.migrationInstructions, warnings: [], unresolvedQuestions: [], bounds: { maxSnippetLines: 24, maxSnippetChars: 12_000, maxTotalChars: 64_000 }, sourceDigest: crypto.createHash('sha256').update(source).digest('hex'), analysisDigest: 'c'.repeat(64),
      });
      const plan = deterministicPlan(planning);
      const context = await buildPatchContext(workspace, planning, plan, { rule });
      expect(context.supported).toBe(true);
      const patch = await new DeterministicPatchGenerator().generate(context);
      expect((await applyCandidate(workspace, context, patch)).status).toBe('PATCH_READY_FOR_VALIDATION');
    } finally {
      await cleanupPatchWorkspace(workspace);
    }
  });

  it('verifies an approved dynamic template through the Draft-PR evidence boundary', async () => {
    await seedApprovedRule('workspace-a', 'candidate-a', 'workspace-change-a');
    const change = (await loadProviderRegistry('slack', 'workspace-a')).find((candidate) => candidate.id === 'workspace-change-a')!;
    const rule = (await loadApprovedDynamicPatchRule('slack', 'workspace-change-a', 'workspace-a'))!;
    const source = "import { WebClient } from '@slack/web-api';\nconst client = new WebClient();\nexport async function load() { return client.conversations.history({ channel: 'C123' }); }\n";
    const sourceDigest = crypto.createHash('sha256').update(source).digest('hex');
    const findingId = 'dynamic-proposal-finding';
    const sha = 'b'.repeat(40);
    const db = getDatabase();
    await db.execute(`INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, lifecycle, created_at) VALUES ('dynamic-proposal-repo', 'workspace-a', 'owner', 'repo', 'owner/repo', '123', 'main', 'connected', 'active', ?)`, [now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES ('dynamic-proposal-scan', 'dynamic-proposal-repo', ?, 'completed', 'multi-provider', ?, ?)`, [sha, now, now]);
    await db.execute(`INSERT INTO findings (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, source_snippet, source_digest, created_at) VALUES (?, 'dynamic-proposal-scan', 'dynamic-proposal-repo', 'dynamic-proposal-usage', 'workspace-change-a', 'slack', 'Slack operation removed', 'Reviewed dynamic change', 'high', 0.9, 'src/slack.ts', 3, 'conversations.history', 'open', 'breaking', '["MATCHED_OPERATION"]', '[]', ?, ?, ?)`, [findingId, source, sourceDigest, now]);
    const planningInput = PlanningInputSchema.parse({
      change, repository: 'owner/repo',
      impacts: [{ usageId: 'dynamic-proposal-usage', changeId: change.id, symbol: 'conversations.history', location: { file: 'src/slack.ts', start: { line: 3, column: 1 }, end: { line: 3, column: 50 } }, reason: 'breaking', confidence: 0.9, versionAssessment: 'unknown', reasonCodes: ['MATCHED_OPERATION'] }],
      evidence: [{ id: `change:${change.id}`, kind: 'change', label: `Reviewed change record ${change.id}.`, changeId: change.id }, { id: 'impact:dynamic-proposal-usage', kind: 'impact', label: 'conversations.history affected at src/slack.ts:3', changeId: change.id, symbol: 'conversations.history' }],
      facts: [{ id: `fact:change:${change.id}`, kind: 'change', statement: `Change record ${change.id} is official and reviewed.`, evidenceIds: [`change:${change.id}`] }, { id: 'fact:operation:dynamic-proposal-usage', kind: 'operation', statement: 'Affected operation: conversations.history.', evidenceIds: ['impact:dynamic-proposal-usage'] }, { id: 'fact:location:dynamic-proposal-usage', kind: 'location', statement: 'Location: src/slack.ts:3', evidenceIds: ['impact:dynamic-proposal-usage'] }],
      snippets: [{ evidenceId: 'impact:dynamic-proposal-usage', file: 'src/slack.ts', startLine: 1, endLine: 5, text: source, redacted: false }], migrationInstructions: change.migrationInstructions, warnings: [], unresolvedQuestions: [], bounds: { maxSnippetLines: 24, maxSnippetChars: 12_000, maxTotalChars: 64_000 }, sourceDigest, analysisDigest: crypto.createHash('sha256').update(findingId).digest('hex'),
    });
    const plan = deterministicPlan(planningInput);
    await db.execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, baseline_sha, created_at) VALUES ('dynamic-proposal-migration', ?, 'dynamic-proposal-repo', ?, 'planned', ?, ?, ?)`, [findingId, plan.generatedBy.changeDigest, JSON.stringify(plan), sha, now]);
    const { verifyMigrationForProposal } = await import('../apps/web/src/lib/server/migration-verification.js');
    const diagnosticSecret = 'twilio-sandbox-output-secret-123456';
    const result = await verifyMigrationForProposal({
      migration: { id: 'dynamic-proposal-migration', finding_id: findingId, repository_id: 'dynamic-proposal-repo', plan_id: plan.generatedBy.changeDigest, plan_json: JSON.stringify(plan), patch_diff: null, patch_digest: null, baseline_sha: sha, verification_report: null },
      finding: { id: findingId, repository_id: 'dynamic-proposal-repo', usage_id: 'dynamic-proposal-usage', change_id: 'workspace-change-a', provider: 'slack', confidence: 0.9, file_path: 'src/slack.ts', line_number: 3, symbol: 'conversations.history', reason: 'breaking', reason_codes: '["MATCHED_OPERATION"]', evidence: '[]', source_snippet: source, source_digest: sourceDigest },
      repo: { id: 'dynamic-proposal-repo', workspace_id: 'workspace-a', owner: 'owner', name: 'repo', full_name: 'owner/repo', github_repository_id: '123', default_branch: 'main', lifecycle: 'active' },
      options: { sourceFiles: { 'src/slack.ts': source, 'package.json': JSON.stringify({ name: 'dynamic-repo', scripts: { test: 'node -e "process.exit(0)"' } }), 'pnpm-lock.yaml': "lockfileVersion: '9.0'\nimporters:\n  .:\n    specifiers: {}\n" }, sandbox: new FakeSandbox({ BUILD: { stdout: diagnosticSecret }, TEST: { stderr: diagnosticSecret } }) },
    });
    expect(result.evidence.proofLevel).toBe('CONTRACT_VERIFIED');
    expect(result.patchContent['src/slack.ts']).toContain('conversations.list');
    expect(JSON.stringify(result.wrapper)).not.toContain(diagnosticSecret);
    expect(result.report.steps.every((step) => step.stdout === '' && step.stderr === '')).toBe(true);
    expect(JSON.stringify(await db.queryOne<{ verification_report: string }>(
      'SELECT verification_report FROM migrations WHERE id = ?', ['dynamic-proposal-migration'],
    ))).not.toContain(diagnosticSecret);
    expect(await db.queryOne<{ status: string }>('SELECT status FROM migrations WHERE id = ?', ['dynamic-proposal-migration'])).toEqual({ status: 'verified' });
    expect(rule.changeDigest).toBe(crypto.createHash('sha256').update(JSON.stringify(change)).digest('hex'));
  });

  it('classifies approved dynamic changes without templates as review-only', async () => {
    await seedPendingRule('workspace-a', 'pending-candidate-a');
    await approveProviderRuleCandidate('pending-candidate-a', 'reviewer-a', 'Reviewed source and approved detection for review-only remediation.', 'workspace-a', reviewEvidence('client.conversations.history()', 'client.conversations.list()'));

    await expect(isApprovedDynamicProductionChange('slack', 'pending-change-workspace-a', 'workspace-a')).resolves.toBe(true);
    await expect(loadApprovedDynamicPatchRule('slack', 'pending-change-workspace-a', 'workspace-a')).resolves.toBeUndefined();
  });

  it('rejects review-only dynamic remediation before source or GitHub access', async () => {
    await seedPendingRule('workspace-a', 'pending-candidate-a');
    await approveProviderRuleCandidate('pending-candidate-a', 'reviewer-a', 'Reviewed source and approved detection for review-only remediation.', 'workspace-a', reviewEvidence('client.conversations.history()', 'client.conversations.list()'));
    const db = getDatabase();
    const sha = 'a'.repeat(40);
    await db.execute(`INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at) VALUES ('dynamic-repo', 'workspace-a', 'owner', 'repo', 'owner/repo', '123', 'main', 'connected', ?)`, [now]);
    await db.execute(`INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at) VALUES ('dynamic-scan', 'dynamic-repo', ?, 'completed', 'multi-provider', ?, ?)`, [sha, now, now]);
    await db.execute(`INSERT INTO findings (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at) VALUES ('dynamic-finding', 'dynamic-scan', 'dynamic-repo', 'dynamic-usage', 'pending-change-workspace-a', 'slack', 'Slack operation removed', 'Reviewed dynamic change', 'high', 0.9, 'src/slack.ts', 1, 'conversations.history', 'open', 'breaking', '["MATCHED_OPERATION"]', '[]', ?)`, [now]);
    const plan = {
      changeId: 'pending-change-workspace-a', provider: 'slack', repository: 'owner/repo', status: 'PLAN_NEEDS_REVIEW', affectedLocations: [], facts: [], recommendations: [], steps: [], assumptions: [], warnings: [], unresolvedQuestions: [], evidence: [],
      confidence: { analysisConfidence: 0, planningConfidence: 0, evidenceCoverage: 0, basis: ['Review-only boundary test.'] },
      generatedBy: { planner: 'test', version: '1', model: null, generatedAt: now, evidenceIds: [], changeDigest: 'b'.repeat(64), analysisDigest: 'c'.repeat(64), modelReasoningUsed: false, validationStatus: 'validated' }, requiresHumanReview: true,
    };
    await db.execute(`INSERT INTO migrations (id, finding_id, repository_id, plan_id, status, plan_json, baseline_sha, created_at) VALUES ('dynamic-migration', 'dynamic-finding', 'dynamic-repo', 'pending-change-workspace-a', 'planned', ?, ?, ?)`, [JSON.stringify(plan), sha, now]);
    await expect(verifyMigrationForProposal({
      migration: { id: 'dynamic-migration', finding_id: 'dynamic-finding', repository_id: 'dynamic-repo', plan_id: 'pending-change-workspace-a', plan_json: JSON.stringify(plan), patch_diff: null, patch_digest: null, baseline_sha: sha, verification_report: null },
      finding: { id: 'dynamic-finding', repository_id: 'dynamic-repo', usage_id: 'dynamic-usage', change_id: 'pending-change-workspace-a', provider: 'slack', confidence: 0.9, file_path: 'src/slack.ts', line_number: 1, symbol: 'conversations.history', reason: 'breaking', reason_codes: '["MATCHED_OPERATION"]', evidence: '[]', source_snippet: null, source_digest: null },
      repo: { id: 'dynamic-repo', workspace_id: 'workspace-a', owner: 'owner', name: 'repo', full_name: 'owner/repo', github_repository_id: '123', default_branch: 'main' },
    })).rejects.toThrow('DYNAMIC_REMEDIATION_UNAVAILABLE');
    expect(await db.queryOne<{ status: string }>('SELECT status FROM migrations WHERE id = ?', ['dynamic-migration'])).toEqual({ status: 'verification_failed' });
  });

  it('rejects cross-workspace candidate mutations', async () => {
    await seedPendingRule('workspace-a', 'pending-candidate-a');

    await expect(editProviderRuleCandidate('pending-candidate-a', 'reviewer-b', { title: 'Cross-workspace edit' }, 'not allowed', 'workspace-b')).rejects.toThrow('RULE_CANDIDATE_NOT_FOUND');
    await expect(approveProviderRuleCandidate('pending-candidate-a', 'reviewer-b', 'not allowed', 'workspace-b')).rejects.toThrow('RULE_CANDIDATE_NOT_FOUND');
    await expect(rejectProviderRuleCandidate('pending-candidate-a', 'reviewer-b', 'not allowed', 'workspace-b')).rejects.toThrow('RULE_CANDIDATE_NOT_REVIEWABLE');

    const candidate = await getDatabase().queryOne<{ status: string; reviewed_by: string | null }>('SELECT status, reviewed_by FROM provider_rule_candidates WHERE id = ?', ['pending-candidate-a']);
    expect(candidate).toEqual({ status: 'needs_review', reviewed_by: null });
  });

  it('rejects executable templates that do not cite the candidate official source', async () => {
    await seedPendingRule('workspace-a', 'pending-candidate-a');

    await editProviderRuleCandidate('pending-candidate-a', 'reviewer-a', {
      migrationTemplate: {
        transformation: { kind: 'member-rename', from: 'history', to: 'list', receiver: 'conversations', preserveArguments: true },
        sources: ['https://example.com/unrelated-migration'],
        limitations: ['The template is limited to direct calls.'],
      },
    }, 'Proposed deterministic transformation.', 'workspace-a');

    await expect(approveProviderRuleCandidate('pending-candidate-a', 'reviewer-a', 'Reviewed source and rejected mismatched migration provenance.', 'workspace-a', reviewEvidence('client.conversations.history()', 'client.conversations.list()'))).rejects.toThrow('RULE_MIGRATION_SOURCE_MISMATCH');
  });
});
