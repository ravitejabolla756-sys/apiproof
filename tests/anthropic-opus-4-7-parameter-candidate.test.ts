import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  fingerprintCandidate,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage } from '@apiproof/shared';
import { evaluateCompatibility, evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';

const CANDIDATE_ID = 'anthropic-opus-4-7-parameter-restrictions';
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate) throw new Error('ANTHROPIC_OPUS_4_7_CANDIDATE_MISSING');

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Test-only reviewer',
  reviewedAt: '2026-10-05',
  notes: 'Test-only reviewed projection; do not promote to production.',
  sourceFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
  evidenceFingerprint: candidate.evidenceFingerprint,
  candidateFingerprint: fingerprintCandidate(candidate),
};

const reviewedCandidate = reviewCandidate(candidate, reviewAction);
const reviewedRecord = promoteCandidateToReviewed(reviewedCandidate, {
  status: 'reviewed', reviewer: reviewAction.reviewer, reviewerKind: 'human', reviewedAt: reviewAction.reviewedAt,
  notes: reviewAction.notes, documentFingerprint: reviewAction.sourceFingerprint,
  evidenceFingerprint: reviewAction.evidenceFingerprint, candidateFingerprint: reviewAction.candidateFingerprint,
}, [{ url: candidate.sourceUrl, summary: 'Official Anthropic parameter-deprecation source.', accessedAt: '2026-10-05' }]);

const policy = { compatibilityProviders: new Set(['anthropic']), requireOfficialProvenance: true };
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'anthropic-parameter-usage', providerId: 'anthropic', model: 'claude-opus-4-7', parameter: 'temperature',
  parameterValueStatus: 'disallowed', evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/anthropic.ts', line: 18, column: 3, symbol: 'client.messages.create' }, ...overrides,
});

describe('Anthropic Opus 4.7 parameter candidate', () => {
  it('keeps the official candidate needs_review and validates its refreshed evidence shape', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.payload.applicabilityScope).toEqual({ dimensions: ['provider', 'model', 'parameter'] });
    expect(candidate.payload.parameterConditions).toEqual([
      { parameter: 'temperature', predicate: 'non-default', values: [1] },
      { parameter: 'top_p', predicate: 'non-default', values: [0.99] },
      { parameter: 'top_k', predicate: 'non-default' },
    ]);
    expect(candidate.sourceEvidence?.sourceLocator).toBe('section:API parameter deprecations');
    expect(candidate.evidenceFingerprint).toBeTruthy();
  });

  it('creates the reviewed projection used for the local production insertion', () => {
    expect(reviewedCandidate.state).toBe('reviewed');
    expect(reviewedRecord.review.status).toBe('reviewed');
    expect(reviewedRecord.review.provenance).toBe('official');
    expect(reviewedRecord.applicabilityScope).toEqual({ dimensions: ['provider', 'model', 'parameter'] });
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.affectedVersionRange).toBeUndefined();
    expect(reviewedRecord.apiOperationPatterns).toEqual([]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CANDIDATE_ID)).toBe(true);
  });

  it('evaluates an explicit static non-default parameter value as AFFECTED', () => {
    const result = evaluateCompatibility({ providerId: 'anthropic', usages: [usage()], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.reasonCodes).toContain('MATCHED_DISALLOWED_PARAMETER_VALUE');
    expect(result.matchedParameterValueStatus).toBe('disallowed');
  });

  it('evaluates an allowed/default-assessed value as NOT_AFFECTED for the parameter restriction', () => {
    const result = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'allowed', parameterValueStatus: 'allowed' })], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('NOT_AFFECTED');
    expect(result.reasonCodes).toContain('CHANGED_API_NOT_USED');
  });

  it('fails closed for dynamic or unresolved parameter values', () => {
    const result = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'dynamic', static: false, confidence: 0.55, parameterValueStatus: 'unknown' })], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('PARAMETER_VALUE_UNRESOLVED');
  });

  it('does not match another model, provider, or unrelated parameter', () => {
    const otherModel = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'other-model', model: 'claude-opus-4-8' })], completeEvidence: true }, reviewedRecord, policy);
    const otherProvider = evaluateCompatibility({ providerId: 'openai', usages: [usage({ id: 'other-provider', providerId: 'openai' })], completeEvidence: true }, reviewedRecord, { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true });
    const otherParameter = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'other-parameter', parameter: 'system' })], completeEvidence: true }, reviewedRecord, policy);
    expect(otherModel.status).toBe('NOT_AFFECTED');
    expect(otherProvider.status).toBe('NOT_AFFECTED');
    expect(otherParameter.status).toBe('NOT_AFFECTED');
  });

  it('keeps the condition language-neutral across TypeScript and Python IR', () => {
    for (const language of ['typescript', 'python'] as const) {
      const ir = normalizeCompatibilityUsage(usage({ id: language }), { language });
      const result = evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [ir], completeEvidence: true }, reviewedRecord, policy);
      expect(result.status).toBe('AFFECTED');
    }
  });

  it('creates deterministic test-only proof snapshots for affected, not-affected, and review states', () => {
    const results = [
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'affected', location: { file: 'src/anthropic.ts', line: 18, column: 3 } })], completeEvidence: true }, reviewedRecord, policy),
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'not-affected', model: 'claude-opus-4-8', location: { file: 'src/anthropic.ts', line: 19, column: 3 } })], completeEvidence: true }, reviewedRecord, policy),
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'needs-review', static: false, confidence: 0.5, parameterValueStatus: 'unknown', location: { file: 'src/anthropic.ts', line: 20, column: 3 } })], completeEvidence: true }, reviewedRecord, policy),
    ];
    expect(results.map((result) => result.status)).toEqual(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
    const proofs = buildCompatibilityProofSnapshot({ repositoryId: 'anthropic-parameter-fixture', baselineSha: 'c'.repeat(40), scanId: 'anthropic-parameter-proof', results, mode: 'test' });
    expect(proofs).toHaveLength(3);
    expect(proofs.map((proof) => proof.status)).toEqual(['NOT_AFFECTED', 'AFFECTED', 'NEEDS_REVIEW']);
  });
});
