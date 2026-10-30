import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { CandidatePayloadSchema, ProviderRuleReviewEvidenceSchema, ReviewedCompatibilityChangeSchema, validateApplicabilityScope } from '@apiproof/shared';
import type { ProviderRuleReviewEvidence } from '@apiproof/shared';
import { getDatabase } from './db/index.js';
import { collectProviderRuleTestTokens, findProviderRuleTestMatches } from './provider-rule-test.js';

type CandidateRow = {
  id: string;
  provider_id: string;
  workspace_id: string | null;
  status: string;
  payload_json: string;
  source_url: string;
  source_type: string;
};

type CandidateEdit = {
  title?: unknown;
  description?: unknown;
  applicabilityScope?: unknown;
  affectedPackages?: unknown;
  affectedVersionRange?: unknown;
  apiOperationPatterns?: unknown;
  affectedResources?: unknown;
  replacement?: unknown;
  migrationTemplate?: unknown;
};

type RepositoryRow = { id: string; workspace_id: string };
function validateReviewEvidence(payload: Record<string, unknown>, input: unknown): ProviderRuleReviewEvidence {
  let evidence: ProviderRuleReviewEvidence;
  try {
    evidence = ProviderRuleReviewEvidenceSchema.parse(input);
  } catch {
    throw new Error('RULE_REVIEW_EVIDENCE_INVALID');
  }
  const tokens = collectProviderRuleTestTokens(payload);
  if (tokens.length === 0) throw new Error('RULE_REVIEW_EVIDENCE_REQUIRES_DETECTABLE_TOKEN');
  for (const item of evidence.cases) {
    const matches = findProviderRuleTestMatches(item.code, tokens);
    if (item.kind === 'affected' && matches.length === 0) throw new Error('RULE_REVIEW_AFFECTED_FIXTURE_MUST_MATCH');
    if (item.kind === 'unaffected' && matches.length > 0) throw new Error('RULE_REVIEW_UNAFFECTED_FIXTURE_MUST_NOT_MATCH');
  }
  return evidence;
}

function requireText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`INVALID_${field.toUpperCase()}`);
  return normalized;
}

/**
 * Edits remain in the review queue. The payload is parsed against the shared
 * candidate contract before it is persisted, and the fingerprint changes so
 * an edited rule cannot be confused with the original source candidate.
 */
export async function editProviderRuleCandidate(candidateId: string, reviewerId: string, input: CandidateEdit, notes: string, workspaceId?: string): Promise<{ candidateId: string }> {
  const id = requireText(candidateId, 'candidate_id', 200);
  const reviewer = requireText(reviewerId, 'reviewer_id', 200);
  const editNotes = requireText(notes, 'edit_notes', 2_000);
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const candidate = await tx.queryOne<CandidateRow>(`
      SELECT c.id, c.provider_id, c.workspace_id, c.status, c.payload_json, s.source_url, s.source_type
      FROM provider_rule_candidates c
      JOIN provider_changelog_entries e ON e.id = c.changelog_entry_id
      JOIN provider_change_sources s ON s.id = e.source_id
      WHERE c.id = ? ${workspaceId ? 'AND (c.workspace_id IS NULL OR c.workspace_id = ?)' : ''}
    `, workspaceId ? [id, workspaceId] : [id]);
    if (!candidate) throw new Error('RULE_CANDIDATE_NOT_FOUND');
    if (candidate.status !== 'needs_review') throw new Error('RULE_CANDIDATE_NOT_REVIEWABLE');
    let current: Record<string, unknown>;
    try { current = JSON.parse(candidate.payload_json) as Record<string, unknown>; } catch { throw new Error('RULE_CANDIDATE_PAYLOAD_INVALID'); }
    const next = CandidatePayloadSchema.parse({ ...current, ...input });
    const payloadJson = JSON.stringify(next);
    const fingerprint = createHash('sha256').update(payloadJson).digest('hex');
    const now = new Date().toISOString();
    const updated = await tx.execute(`
      UPDATE provider_rule_candidates
      SET candidate_fingerprint = ?, payload_json = ?, updated_at = ?
      WHERE id = ? AND status = 'needs_review'
    `, [fingerprint, payloadJson, now, id]);
    if (updated.changes !== 1) throw new Error('RULE_CANDIDATE_EDIT_CONFLICT');
    await tx.execute(`
      INSERT INTO provider_rule_reviews (id, rule_candidate_id, decision, reviewer_id, notes, created_at)
      VALUES (?, ?, 'edited', ?, ?, ?)
    `, [`prr_${randomUUID()}`, id, reviewer, editNotes, now]);
    return { candidateId: id };
  });
}

/**
 * Approves a structured candidate and fans out durable rescan jobs. The
 * candidate remains database-backed rather than being copied into the static
 * registry; the enabled productization path consumes only approved,
 * workspace-authorized records and keeps remediation fail-closed.
 */
export async function approveProviderRuleCandidate(candidateId: string, reviewerId: string, notes: string, workspaceId?: string, reviewEvidence?: unknown): Promise<{ candidateId: string; repositoriesQueued: number }> {
  const id = requireText(candidateId, 'candidate_id', 200);
  const reviewer = requireText(reviewerId, 'reviewer_id', 200);
  const reviewNotes = requireText(notes, 'review_notes', 2_000);
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const candidate = await tx.queryOne<CandidateRow>(`
      SELECT c.id, c.provider_id, c.workspace_id, c.status, c.payload_json, s.source_url, s.source_type
      FROM provider_rule_candidates c
      JOIN provider_changelog_entries e ON e.id = c.changelog_entry_id
      JOIN provider_change_sources s ON s.id = e.source_id
      WHERE c.id = ? ${workspaceId ? 'AND (c.workspace_id IS NULL OR c.workspace_id = ?)' : ''}
    `, workspaceId ? [id, workspaceId] : [id]);
    if (!candidate) throw new Error('RULE_CANDIDATE_NOT_FOUND');
    if (candidate.status !== 'needs_review') throw new Error('RULE_CANDIDATE_NOT_REVIEWABLE');
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(candidate.payload_json) as Record<string, unknown>; } catch { throw new Error('RULE_CANDIDATE_PAYLOAD_INVALID'); }
    if (typeof payload.changeType !== 'string' || !payload.applicabilityScope || !Array.isArray(payload.sourceFacts)) {
      throw new Error('RULE_CANDIDATE_REQUIRES_STRUCTURED_REVIEW');
    }
    const validatedEvidence = validateReviewEvidence(payload, reviewEvidence);
    const normalizedPayload = CandidatePayloadSchema.parse(payload);
    if (normalizedPayload.migrationTemplate && !normalizedPayload.migrationTemplate.sources.includes(candidate.source_url)) {
      throw new Error('RULE_MIGRATION_SOURCE_MISMATCH');
    }
    const reviewedChange = ReviewedCompatibilityChangeSchema.parse({
      providerId: candidate.provider_id,
      changeId: normalizedPayload.changeId ?? `candidate-${candidate.id}`,
      title: normalizedPayload.title,
      description: normalizedPayload.description,
      changeType: normalizedPayload.changeType,
      publishedAt: normalizedPayload.publishedAt,
      effectiveAt: normalizedPayload.effectiveAt,
      removalAt: normalizedPayload.removalAt,
      officialSourceUrl: candidate.source_url,
      sourceType: candidate.source_type,
      applicabilityScope: normalizedPayload.applicabilityScope,
      affectedPackages: normalizedPayload.affectedPackages,
      affectedVersionRange: normalizedPayload.affectedVersionRange,
      apiOperationPatterns: normalizedPayload.apiOperationPatterns ?? [],
      affectedParameters: normalizedPayload.affectedParameters ?? [],
      parameterConditions: normalizedPayload.parameterConditions,
      affectedResponseFields: normalizedPayload.affectedResponseFields ?? [],
      affectedEndpoints: normalizedPayload.affectedEndpoints ?? [],
      affectedDomains: normalizedPayload.affectedDomains ?? [],
      affectedModels: normalizedPayload.affectedModels ?? [],
      affectedResources: normalizedPayload.affectedResources ?? [],
      authOrHeaderPatterns: normalizedPayload.authOrHeaderPatterns ?? [],
      enumMetadata: normalizedPayload.enumMetadata,
      apiVersionMetadata: normalizedPayload.apiVersionMetadata,
      replacement: normalizedPayload.replacement,
      severity: normalizedPayload.severity ?? 'high',
      review: { status: 'reviewed', reviewer, reviewedAt: new Date().toISOString().slice(0, 10), provenance: 'official' },
      evidence: [{ url: candidate.source_url, summary: normalizedPayload.description.slice(0, 2_000), accessedAt: new Date().toISOString().slice(0, 10) }],
    });
    validateApplicabilityScope(reviewedChange);
    const now = new Date().toISOString();
    const updated = await tx.execute(`
      UPDATE provider_rule_candidates
      SET status = 'approved', workspace_id = COALESCE(?, workspace_id), reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
      WHERE id = ? AND status = 'needs_review' ${workspaceId ? 'AND (workspace_id IS NULL OR workspace_id = ?)' : ''}
    `, workspaceId ? [workspaceId, reviewer, now, reviewNotes, now, id, workspaceId] : [null, reviewer, now, reviewNotes, now, id]);
    if (updated.changes !== 1) throw new Error('RULE_CANDIDATE_REVIEW_CONFLICT');
    await tx.execute(`
      INSERT INTO provider_rule_reviews (id, rule_candidate_id, decision, reviewer_id, notes, evidence_json, created_at)
      VALUES (?, ?, 'approved', ?, ?, ?, ?)
    `, [`prr_${randomUUID()}`, id, reviewer, reviewNotes, JSON.stringify(validatedEvidence), now]);

    const repositories = await tx.query<RepositoryRow>(`
      SELECT id, workspace_id FROM repositories
      WHERE lifecycle = 'active' AND status IN ('connected', 'healthy', 'affected') AND workspace_id IS NOT NULL
        AND (
          NOT EXISTS (SELECT 1 FROM repository_provider_usage known WHERE known.repository_id = repositories.id)
          OR EXISTS (
            SELECT 1 FROM repository_provider_usage observed
            WHERE observed.repository_id = repositories.id AND observed.provider_id = ?
          )
        )
      ${workspaceId ? 'AND workspace_id = ?' : ''}
    `, workspaceId ? [candidate.provider_id, workspaceId] : [candidate.provider_id]);
    let repositoriesQueued = 0;
    for (const repository of repositories) {
      const inserted = await tx.execute(`
        INSERT INTO provider_rescan_jobs (id, workspace_id, repository_id, rule_candidate_id, reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'new_rule_approved', ?, ?)
        ON CONFLICT (repository_id, rule_candidate_id) DO NOTHING
      `, [`prs_${randomUUID()}`, repository.workspace_id, repository.id, id, now, now]);
      repositoriesQueued += inserted.changes;
    }
    return { candidateId: id, repositoriesQueued };
  });
}

export async function rejectProviderRuleCandidate(candidateId: string, reviewerId: string, notes: string, workspaceId?: string): Promise<void> {
  const id = requireText(candidateId, 'candidate_id', 200);
  const reviewer = requireText(reviewerId, 'reviewer_id', 200);
  const reviewNotes = requireText(notes, 'review_notes', 2_000);
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const updated = await tx.execute(`
      UPDATE provider_rule_candidates
      SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
      WHERE id = ? AND status = 'needs_review' ${workspaceId ? 'AND (workspace_id IS NULL OR workspace_id = ?)' : ''}
    `, workspaceId
      ? [reviewer, new Date().toISOString(), reviewNotes, new Date().toISOString(), id, workspaceId]
      : [reviewer, new Date().toISOString(), reviewNotes, new Date().toISOString(), id]);
    if (updated.changes !== 1) throw new Error('RULE_CANDIDATE_NOT_REVIEWABLE');
    await tx.execute(`
      INSERT INTO provider_rule_reviews (id, rule_candidate_id, decision, reviewer_id, notes, created_at)
      VALUES (?, ?, 'rejected', ?, ?, ?)
    `, [`prr_${randomUUID()}`, id, reviewer, reviewNotes, new Date().toISOString()]);
  });
}
