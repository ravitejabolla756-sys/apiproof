import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  promoteCandidateToReviewed,
} from '@apiproof/providers';
import { LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE, LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW } from '../packages/providers/src/local-reviewed-candidate-reviews.js';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityResult, CompatibilityUsage } from '@apiproof/shared';

const CANDIDATE_ID = 'openai-assistants-api-sunset-2026-08-26';
const CHANGE_ID = 'openai-assistants-api-sunset-2026-08-26';
const SOURCE_URL = 'https://developers.openai.com/api/docs/deprecations';

const normalizedUsage = (overrides: Partial<CompatibilityUsage> = {}) => normalizeCompatibilityUsage({
  id: 'assistants-usage',
  providerId: 'openai',
  resource: 'Assistants API',
  evidenceKind: 'sdk',
  confidence: 0.98,
  static: true,
  location: { file: 'src/assistants.ts', line: 18, column: 3, symbol: 'Assistants API' },
  ...overrides,
}, { language: 'typescript' });

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate) throw new Error(`OPENAI_ASSISTANTS_CANDIDATE_MISSING:${CANDIDATE_ID}`);

const projectedRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE,
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW,
  [{
    url: SOURCE_URL,
    summary: 'Official source states the Assistants API removal date and names the Responses API and Conversations API as replacements.',
    accessedAt: '2026-10-05',
  }],
);
const projectedRegistry = PRODUCTION_COMPATIBILITY_REGISTRY;

function evaluate(resource: string | undefined, options: { completeEvidence?: boolean; isStatic?: boolean; line?: number } = {}): CompatibilityResult {
  const result = projectedRegistry.byProvider.get('openai')
    ?.find((change) => change.changeId === CHANGE_ID);
  if (!result) throw new Error('ASSISTANTS_PROJECTION_NOT_COMPILED');
  const usage = normalizedUsage({
    id: `resource-${resource ?? 'dynamic'}`,
    resource,
    static: options.isStatic ?? true,
    confidence: options.isStatic === false ? 0.45 : 0.98,
    location: { file: `src/${resource?.toLowerCase().replaceAll(' ', '-') ?? 'wrapper'}.ts`, line: options.line ?? 18, column: 3, symbol: resource ?? 'dynamic provider wrapper' },
  });
  // The production evaluator takes a registered record; evaluate the same exact
  // reviewed projection through the registry entry point used by production.
  const evaluated = evaluateRegisteredNormalizedCompatibility({
    providerId: 'openai',
    usageIR: [usage],
    completeEvidence: options.completeEvidence ?? true,
  }, projectedRegistry).find((item) => item.changeId === CHANGE_ID);
  if (!evaluated) throw new Error('ASSISTANTS_COMPATIBILITY_RESULT_MISSING');
  return evaluated;
}

describe('OpenAI Assistants explicit local human review', () => {
  it('transitions only the local candidate copy and persists the fingerprint-bound human decision', () => {
    expect(candidate.state).toBe('needs_review');
    expect(LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE.state).toBe('reviewed');
    expect(LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed',
      at: '2026-10-05',
      actor: 'Ravi Teja',
      note: LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW.notes,
      reviewBinding: {
        documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
        evidenceFingerprint: '70f977467ffc1ba85e48684000a7af3eb87ee6beaad85cc0f0ce908c849809cb',
        candidateFingerprint: '9c8a0e3792e19bf6e8c231c91089c1702cd2781676df284383f4022292bc8c8d',
      },
    });
    expect(LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW).toEqual({
      status: 'reviewed',
      reviewer: 'Ravi Teja',
      reviewerKind: 'human',
      reviewedAt: '2026-10-05',
      notes: 'I verified the official Assistants API deprecation and removal facts. I approve authoritative applicability at provider + resource scope for Assistants API only. The documented replacements are Responses API and Conversations API. I do not assert any SDK package, SDK version, SDK operation, or endpoint path.',
      documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
      evidenceFingerprint: '70f977467ffc1ba85e48684000a7af3eb87ee6beaad85cc0f0ce908c849809cb',
      candidateFingerprint: '9c8a0e3792e19bf6e8c231c91089c1702cd2781676df284383f4022292bc8c8d',
    });
    expect(candidate.state).toBe('needs_review');
  });

  it('passes the local promotion validator without inserting the record into production', () => {
    expect(projectedRecord).toMatchObject({
      providerId: 'openai',
      changeId: CHANGE_ID,
      changeType: 'endpoint_removed',
      removalAt: '2026-08-26',
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      affectedResources: ['Assistants API'],
      replacement: { resources: ['Responses API', 'Conversations API'] },
      severity: 'high',
      review: {
        status: 'reviewed',
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-05',
        provenance: 'official',
        documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
        evidenceFingerprint: '70f977467ffc1ba85e48684000a7af3eb87ee6beaad85cc0f0ce908c849809cb',
        candidateFingerprint: '9c8a0e3792e19bf6e8c231c91089c1702cd2781676df284383f4022292bc8c8d',
      },
    });
    expect(projectedRecord.applicabilityScope.dimensions).toEqual(['provider', 'resource']);
    expect(projectedRecord.affectedPackages).toBeUndefined();
    expect(projectedRecord.affectedVersionRange).toBeUndefined();
    expect(projectedRecord.apiOperationPatterns).toEqual([]);
    expect(projectedRecord.affectedEndpoints).toEqual([]);
    expect(projectedRecord.review.notes).toBe(LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW.notes);
    expect(projectedRecord.evidence[0]?.url).toBe(SOURCE_URL);
    expect(projectedRegistry.byChangeId.get(CHANGE_ID)).toEqual(projectedRecord);

    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(50);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CHANGE_ID)).toBe(true);
    const gpt45 = PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get('openai-gpt-4-5-preview-removal-2025-07-14');
    expect(gpt45).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'model'] },
      affectedModels: ['gpt-4.5-preview'],
      removalAt: '2025-07-14',
      replacement: { model: 'gpt-4.1' },
    });
    expect(gpt45?.review.documentFingerprint).toBeDefined();
    expect(gpt45?.review.evidenceFingerprint).toBeDefined();
    expect(gpt45?.review.candidateFingerprint).toBeDefined();
  });

  it('rejects a reviewed candidate or review binding that changes after approval', () => {
    const evidence = [{
      url: SOURCE_URL,
      summary: 'Official source states the Assistants API removal date and names the Responses API and Conversations API as replacements.',
      accessedAt: '2026-10-05',
    }];
    expect(() => promoteCandidateToReviewed(
      LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE,
      { ...LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW, evidenceFingerprint: 'f'.repeat(64) },
      evidence,
    )).toThrow('CANDIDATE_REVIEW_EVIDENCE_FINGERPRINT_MISMATCH');

    expect(() => promoteCandidateToReviewed({
      ...LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE,
      payload: { ...LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE.payload, affectedResources: ['Responses API'] },
    }, LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW, evidence)).toThrow('CANDIDATE_REVIEW_CANDIDATE_FINGERPRINT_MISMATCH');
  });

  it('evaluates the projected registry only against authoritative provider + resource scope', () => {
    const affected = evaluate('Assistants API');
    const responses = evaluate('Responses API', { line: 24 });
    const conversations = evaluate('Conversations API', { line: 32 });
    const dynamic = evaluate(undefined, { completeEvidence: false, isStatic: false, line: 40 });
    const unrelatedResource = evaluate('Files API', { line: 48 });
    expect(affected.status).toBe('AFFECTED');
    expect(affected.reasonCodes).toEqual(['VERSION_NOT_CONSTRAINED', 'MATCHED_STATIC_USAGE']);
    expect(responses.status).toBe('NOT_AFFECTED');
    expect(responses.reasonCodes).toContain('CHANGED_API_NOT_USED');
    expect(conversations.status).toBe('NOT_AFFECTED');
    expect(unrelatedResource.status).toBe('NOT_AFFECTED');
    expect(dynamic.status).toBe('NEEDS_REVIEW');
    expect(dynamic.reasonCodes).toContain('RESOURCE_UNRESOLVED');
    expect(dynamic.evidenceCoverage).toBe('partial');

    const unrelatedProviderUsage = normalizedUsage({ id: 'anthropic-resource', providerId: 'anthropic', resource: 'Messages API' });
    const unrelatedProviderResults = evaluateRegisteredNormalizedCompatibility({
      providerId: 'anthropic', usageIR: [unrelatedProviderUsage], completeEvidence: true,
    }, projectedRegistry);
    expect(unrelatedProviderResults).toHaveLength(2);
    expect(unrelatedProviderResults.every((item) => item.providerId === 'anthropic' && item.status === 'NOT_AFFECTED')).toBe(true);
    expect(unrelatedProviderResults.some((item) => item.changeId.startsWith('openai-'))).toBe(false);
  });

  it('generates production-mode Compatibility Proof snapshots for affected, unaffected, and uncertain results', () => {
    const outcomes = [
      evaluate('Assistants API', { line: 18 }),
      evaluate('Responses API', { line: 24 }),
      evaluate('Conversations API', { line: 32 }),
      evaluate(undefined, { completeEvidence: false, isStatic: false, line: 40 }),
      evaluate('Files API', { line: 48 }),
    ];
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'AFFECTED', 'NOT_AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED',
    ]);

    const proofs = outcomes.map((outcome, index) => buildCompatibilityProofSnapshot({
      repositoryId: 'openai-assistants-local-review-fixture',
      baselineSha: 'a'.repeat(40),
      scanId: `assistants-human-review-${index}`,
      results: [outcome],
      mode: 'production',
    })[0]);
    expect(proofs.map((proof) => proof?.status)).toEqual(outcomes.map((outcome) => outcome.status));
    expect(proofs.every((proof) => proof?.changeId === CHANGE_ID && proof.reviewStatus === 'reviewed' && proof.provenance === 'official')).toBe(true);
    expect(proofs[0]).toMatchObject({ exactFile: 'src/assistants-api.ts', exactLine: 18, exactSymbol: 'Assistants API' });
    expect(proofs[3]).toMatchObject({ status: 'NEEDS_REVIEW', exactFile: 'src/wrapper.ts', exactLine: 40, recommendedNextAction: 'MANUAL_REVIEW' });
    expect(proofs[3]?.reasonCodes).toContain('RESOURCE_UNRESOLVED');
  });
});
