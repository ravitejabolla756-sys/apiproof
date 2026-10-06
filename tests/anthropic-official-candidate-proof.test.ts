import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  classifySourceUpdate,
  fingerprintCandidate,
  promoteCandidateToReviewed,
} from '@apiproof/providers';
import {
  CandidateReviewActionSchema,
  buildCompatibilityProofSnapshot,
  defaultSeverityForChangeType,
  fingerprintCandidateEvidence,
} from '@apiproof/shared';
import type { CandidateChange, CompatibilityUsage, ReviewedCompatibilityChange, UsageLanguage } from '@apiproof/shared';
import {
  LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW,
} from '../packages/providers/src/local-reviewed-candidate-reviews.js';

const CANDIDATE_ID = 'anthropic-claude-opus-4-1-retirement-2026-08-05';
const SOURCE_URL = 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations';
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate?.sourceEvidence || !candidate.documentFingerprint || !candidate.evidenceFingerprint) throw new Error('REFRESHED_ANTHROPIC_PROVENANCE_MISSING');

const openAiRecordsBefore = JSON.stringify(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai'));
const staleStoredCandidate: CandidateChange = {
  ...candidate,
  sourceFingerprint: '98d1cc99c4ca657931d3d305f7624d78698501de7330c104708e2558e06ff2d8',
  documentFingerprint: '98d1cc99c4ca657931d3d305f7624d78698501de7330c104708e2558e06ff2d8',
  sourceEvidence: undefined,
  evidenceFingerprint: undefined,
};

const reviewedTestProjection: ReviewedCompatibilityChange = promoteCandidateToReviewed(
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW,
  [{ url: SOURCE_URL, summary: 'Anthropic documents the Claude Opus 4.1 retirement and replacement model.', accessedAt: '2026-10-05' }],
);

const policy = { compatibilityProviders: new Set(['anthropic']), requireOfficialProvenance: true };

const usage = (overrides: Partial<CompatibilityUsage> = {}, language: UsageLanguage = 'typescript') => normalizeCompatibilityUsage({
  id: 'anthropic-model-usage',
  providerId: 'anthropic',
  model: 'claude-opus-4-1-20250805',
  evidenceKind: 'sdk',
  confidence: 0.99,
  static: true,
  location: { file: 'src/anthropic.ts', line: 18, column: 3, symbol: 'model' },
  ...overrides,
}, { language, versionSource: 'unknown', versionConfidence: 'unknown' });

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: 'I verified the official Anthropic model deprecation source, the exact Claude Opus 4.1 model identifier, the June 5, 2026 notification date, the August 5, 2026 retirement date, and the claude-opus-4-8 replacement. I approve authoritative applicability at provider + model scope only. I do not assert any SDK package, SDK version range, SDK method, endpoint, or model alias.',
  sourceFingerprint: candidate.documentFingerprint,
  evidenceFingerprint: candidate.evidenceFingerprint,
  candidateFingerprint: fingerprintCandidate(candidate),
};

describe('Anthropic official candidate review preparation', () => {
  it('applies the explicit review only to a separate local copy', () => {
    expect(candidate.state).toBe('needs_review');
    expect(LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE.state).toBe('reviewed');
    expect(LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed',
      at: '2026-10-05',
      actor: 'Ravi Teja',
      note: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.notes,
      reviewBinding: {
        documentFingerprint: '35a538cd9430ebba5e3d7dfe6416d420c35182c514e4686e774745f80e257a35',
        evidenceFingerprint: 'e6215ccb841b36bd31ab670fa76228f1ededc23e14762c3ff2f8d47df5ac315e',
        candidateFingerprint: 'dc699cbc5df9a1a7d0fde08ee330b0929329c6b2e734182ef5b661f1f788a6fb',
      },
    });
    expect(LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW).toEqual({
      status: 'reviewed',
      reviewer: 'Ravi Teja',
      reviewerKind: 'human',
      reviewedAt: '2026-10-05',
      notes: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.notes,
      documentFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.sourceFingerprint,
      evidenceFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.evidenceFingerprint,
      candidateFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.candidateFingerprint,
    });
    expect(candidate.state).toBe('needs_review');
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
  });

  it('passes the strict promotion validator without mutating production', () => {
    expect(reviewedTestProjection).toMatchObject({
      providerId: 'anthropic',
      changeId: CANDIDATE_ID,
      changeType: 'model_retired',
      publishedAt: '2026-06-05',
      removalAt: '2026-08-05',
      applicabilityScope: { dimensions: ['provider', 'model'] },
      affectedModels: ['claude-opus-4-1-20250805'],
      replacement: { model: 'claude-opus-4-8' },
      severity: 'high',
      review: {
        status: 'reviewed',
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-05',
        provenance: 'official',
        documentFingerprint: '35a538cd9430ebba5e3d7dfe6416d420c35182c514e4686e774745f80e257a35',
        evidenceFingerprint: 'e6215ccb841b36bd31ab670fa76228f1ededc23e14762c3ff2f8d47df5ac315e',
        candidateFingerprint: 'dc699cbc5df9a1a7d0fde08ee330b0929329c6b2e734182ef5b661f1f788a6fb',
      },
    });
    expect(reviewedTestProjection.affectedPackages).toBeUndefined();
    expect(reviewedTestProjection.affectedVersionRange).toBeUndefined();
    expect(reviewedTestProjection.apiOperationPatterns).toEqual([]);
    expect(reviewedTestProjection.affectedEndpoints).toEqual([]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CANDIDATE_ID)?.review).toMatchObject({
      status: 'reviewed',
      reviewer: 'Ravi Teja',
      reviewedAt: '2026-10-05',
      provenance: 'official',
      notes: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.notes,
      documentFingerprint: '35a538cd9430ebba5e3d7dfe6416d420c35182c514e4686e774745f80e257a35',
      evidenceFingerprint: 'e6215ccb841b36bd31ab670fa76228f1ededc23e14762c3ff2f8d47df5ac315e',
      candidateFingerprint: 'dc699cbc5df9a1a7d0fde08ee330b0929329c6b2e734182ef5b661f1f788a6fb',
    });
  });

  it('stores only deterministic official facts and keeps the candidate pending', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.sourceUrl).toBe(SOURCE_URL);
    expect(candidate.documentFingerprint).toBe('35a538cd9430ebba5e3d7dfe6416d420c35182c514e4686e774745f80e257a35');
    expect(candidate.evidenceFingerprint).toBe('e6215ccb841b36bd31ab670fa76228f1ededc23e14762c3ff2f8d47df5ac315e');
    expect(fingerprintCandidateEvidence(candidate.sourceEvidence)).toBe(candidate.evidenceFingerprint);
    expect(fingerprintCandidate(candidate)).toBe('dc699cbc5df9a1a7d0fde08ee330b0929329c6b2e734182ef5b661f1f788a6fb');
    expect(candidate.payload).toMatchObject({
      changeType: 'model_retired',
      publishedAt: '2026-06-05',
      removalAt: '2026-08-05',
      applicabilityScope: { dimensions: ['provider', 'model'] },
      affectedModels: ['claude-opus-4-1-20250805'],
      replacement: { model: 'claude-opus-4-8' },
      severity: 'high',
    });
    expect(candidate.payload.affectedPackages).toBeUndefined();
    expect(candidate.payload.affectedVersionRange).toBeUndefined();
    expect(candidate.payload.apiOperationPatterns).toBeUndefined();
    expect(defaultSeverityForChangeType('model_retired')).toBe('high');
    expect(CandidateReviewActionSchema.parse(reviewAction)).toMatchObject({
      sourceFingerprint: candidate.documentFingerprint,
      evidenceFingerprint: candidate.evidenceFingerprint,
      candidateFingerprint: fingerprintCandidate(candidate),
    });
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
  });

  it('classifies the old stored record honestly before refresh', () => {
    expect(classifySourceUpdate(staleStoredCandidate, candidate)).toBe('SOURCE_UNAVAILABLE_REVIEW_REQUIRED');
    const previousWithEvidence = { ...staleStoredCandidate, sourceEvidence: candidate.sourceEvidence, evidenceFingerprint: candidate.evidenceFingerprint };
    expect(classifySourceUpdate(previousWithEvidence, candidate)).toBe('DOCUMENT_UPDATED_EVIDENCE_UNCHANGED');
    const changedEvidence = { ...candidate, sourceEvidence: { ...candidate.sourceEvidence, claims: [...candidate.sourceEvidence.claims, { key: 'replacement', value: 'claude-opus-4-9' }] }, evidenceFingerprint: 'a'.repeat(64) };
    expect(classifySourceUpdate(previousWithEvidence, changedEvidence)).toBe('EVIDENCE_UPDATED_REVIEW_REQUIRED');
  });

  it.each([
    ['affected', usage(), 'AFFECTED'],
    ['replacement', usage({ id: 'replacement', model: 'claude-opus-4-8', location: { file: 'src/anthropic.ts', line: 24, column: 3, symbol: 'model' } }), 'NOT_AFFECTED'],
    ['dynamic', usage({ id: 'dynamic', model: undefined, static: false, confidence: 0.4, location: { file: 'src/wrapper.ts', line: 31, column: 3, symbol: 'model' } }), 'NEEDS_REVIEW'],
    ['unrelated-model', usage({ id: 'unrelated', model: 'claude-sonnet-4-6', location: { file: 'src/anthropic.ts', line: 38, column: 3, symbol: 'model' } }), 'NOT_AFFECTED'],
  ] as const)('evaluates %s through the test-only reviewed projection', (_label, item, expected) => {
    const result = evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [item], completeEvidence: expected !== 'NEEDS_REVIEW' }, reviewedTestProjection, policy);
    expect(result.status).toBe(expected);
  });

  it('proves the same language-neutral rule for TypeScript and Python IR', () => {
    for (const language of ['typescript', 'python'] as const) {
      const result = evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage({}, language)], completeEvidence: true }, reviewedTestProjection, policy);
      expect(result.status, language).toBe('AFFECTED');
      expect(result.matchedUsages[0]?.model).toBe('claude-opus-4-1-20250805');
    }
  });

  it('does not create an Anthropic claim for another provider and does not mutate OpenAI rules', () => {
    const unrelated = evaluateRegisteredNormalizedCompatibility({ providerId: 'cloudflare', usageIR: [usage({ providerId: 'cloudflare' })], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(unrelated).toHaveLength(0);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(JSON.stringify(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai'))).toBe(openAiRecordsBefore);
  });

  it.each([
    ['retired model', usage(), 'AFFECTED'],
    ['replacement model', usage({ id: 'registered-replacement', model: 'claude-opus-4-8' }), 'NOT_AFFECTED'],
    ['another model', usage({ id: 'registered-other', model: 'claude-sonnet-4-6' }), 'NOT_AFFECTED'],
    ['dynamic model', usage({ id: 'registered-dynamic', model: undefined, static: false, confidence: 0.4 }), 'NEEDS_REVIEW'],
  ] as const)('evaluates %s through the actual local production registry', (_label, item, expected) => {
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'anthropic', usageIR: [item], completeEvidence: expected !== 'NEEDS_REVIEW' }, PRODUCTION_COMPATIBILITY_REGISTRY);
    const result = results.find((item) => item.changeId === CANDIDATE_ID);
    expect(result).toBeDefined();
    expect(result?.status).toBe(expected);
  });

  it('generates Compatibility Proof snapshots without exposing the projection in production', () => {
    const outcomes = [
      evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage()], completeEvidence: true }, reviewedTestProjection, policy),
      evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage({ id: 'replacement', model: 'claude-opus-4-8' })], completeEvidence: true }, reviewedTestProjection, policy),
      evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage({ id: 'dynamic', model: undefined, static: false, confidence: 0.4 })], completeEvidence: false }, reviewedTestProjection, policy),
    ];
    expect(outcomes.map((item) => item.status)).toEqual(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
    const proofs = outcomes.map((result, index) => buildCompatibilityProofSnapshot({
      repositoryId: 'anthropic-local-review-fixture',
      baselineSha: 'a'.repeat(40),
      scanId: `anthropic-proof-${index}`,
      results: [result],
      mode: 'test',
    })[0]);
    expect(proofs.map((proof) => proof?.status)).toEqual(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
    expect(proofs.every((proof) => proof?.changeId === CANDIDATE_ID && proof?.reviewStatus === 'reviewed' && proof?.provenance === 'official')).toBe(true);
  });

  it('proves both OpenAI rules still match only their own provider and changed API', () => {
    const gptResults = evaluateRegisteredNormalizedCompatibility({
      providerId: 'openai',
      usageIR: [normalizeCompatibilityUsage({ id: 'gpt45', providerId: 'openai', model: 'gpt-4.5-preview', evidenceKind: 'sdk', confidence: 0.99, static: true, location: { file: 'src/openai.ts', line: 4, column: 1 } }, { language: 'typescript' })],
      completeEvidence: true,
    }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(gptResults.find((result) => result.changeId === 'openai-gpt-4-5-preview-removal-2025-07-14')?.status).toBe('AFFECTED');
    expect(gptResults.find((result) => result.changeId === 'openai-assistants-api-sunset-2026-08-26')?.status).toBe('NOT_AFFECTED');

    const assistantsResults = evaluateRegisteredNormalizedCompatibility({
      providerId: 'openai',
      usageIR: [normalizeCompatibilityUsage({ id: 'assistants', providerId: 'openai', resource: 'Assistants API', evidenceKind: 'sdk', confidence: 0.99, static: true, location: { file: 'src/openai.ts', line: 8, column: 1 } }, { language: 'typescript' })],
      completeEvidence: true,
    }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(assistantsResults.find((result) => result.changeId === 'openai-assistants-api-sunset-2026-08-26')?.status).toBe('AFFECTED');
    expect(assistantsResults.find((result) => result.changeId === 'openai-gpt-4-5-preview-removal-2025-07-14')?.status).toBe('NOT_AFFECTED');
    expect(assistantsResults).toHaveLength(2);
  });

  it('keeps registry ordering stable and produces one proof per reviewed change without conflicts', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
      'github-organization-security-fields-removed-2026-04-21',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'twilio-regional-api-domain-removal-2026-04-28',
    ]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage()], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    const result = results.find((item) => item.changeId === CANDIDATE_ID);
    expect(result?.reasonCodes).toEqual(['VERSION_NOT_CONSTRAINED', 'MATCHED_STATIC_USAGE']);
    const proof = buildCompatibilityProofSnapshot({ repositoryId: 'anthropic-production-fixture', baselineSha: 'b'.repeat(40), scanId: 'anthropic-production-proof', results, mode: 'test' });
    expect(proof.find((item) => item?.changeId === CANDIDATE_ID)).toMatchObject({ changeId: CANDIDATE_ID, status: 'AFFECTED', reasonCodes: result?.reasonCodes, provenance: 'official' });
  });
});
