import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage } from '@apiproof/shared';
import { evaluateCompatibility } from '@apiproof/analyzers';

const CANDIDATE_ID = 'anthropic-opus-4-7-parameter-restrictions';
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate) throw new Error('ANTHROPIC_OPUS_4_7_CANDIDATE_MISSING');

const humanReviewInput = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: "I verified the complete official Anthropic model-deprecations source and confirmed that the candidate-specific evidence is unchanged: temperature, top_p, and top_k are restricted to non-default values for Claude Opus 4.7 and later models and Claude Mythos Preview, with HTTP 400 behavior and guidance to omit the parameters and use prompting. I approve only deterministic applicability supported by the normalized candidate. I do not assert numeric default values, SDK package, SDK version, SDK method, endpoint, unsupported model aliases, or guessed identifiers for future models covered by 'and later'.",
  sourceFingerprint: '963a809d2191441ef8c2bcbfbdab4071fccc129394b48af249249bccecc4594c',
  evidenceFingerprint: '4b7fec20394d52ac8c69563bff460509c0873fff225ecbc9489982ef45ab6948',
  candidateFingerprint: '6f4b69347a030bfb7dfc28d039eb50ac93e6ca4c931294f776aa548dc9ae64dc',
};

const reviewedCandidate = reviewCandidate(candidate, humanReviewInput);
const reviewedRecord = promoteCandidateToReviewed(reviewedCandidate, {
  status: 'reviewed', reviewer: humanReviewInput.reviewer, reviewerKind: 'human', reviewedAt: humanReviewInput.reviewedAt,
  notes: humanReviewInput.notes, documentFingerprint: humanReviewInput.sourceFingerprint,
  evidenceFingerprint: humanReviewInput.evidenceFingerprint, candidateFingerprint: humanReviewInput.candidateFingerprint,
}, [{
  url: candidate.sourceUrl,
  summary: 'Anthropic documents temperature, top_p, and top_k non-default values returning HTTP 400 for Claude Opus 4.7 and later models and Claude Mythos Preview; omit them and use prompting.',
  accessedAt: '2026-10-05',
}]);

const policy = { compatibilityProviders: new Set(['anthropic']), requireOfficialProvenance: true };
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'anthropic-parameter-usage', providerId: 'anthropic', model: 'claude-opus-4-7', parameter: 'temperature',
  parameterValueStatus: 'disallowed', evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/anthropic.ts', line: 18, column: 3, symbol: 'client.messages.create' }, ...overrides,
});

describe('Anthropic Opus 4.7 human review', () => {
  it('transitions only the local reviewed copy and preserves the exact review binding', () => {
    expect(candidate.state).toBe('needs_review');
    expect(reviewedCandidate.state).toBe('reviewed');
    expect(reviewedCandidate.auditTrail.at(-1)).toMatchObject({ state: 'reviewed', actor: 'Ravi Teja', at: '2026-10-05', reviewBinding: { documentFingerprint: humanReviewInput.sourceFingerprint, evidenceFingerprint: humanReviewInput.evidenceFingerprint, candidateFingerprint: humanReviewInput.candidateFingerprint } });
    expect(reviewedRecord.review).toMatchObject({ status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-05', notes: humanReviewInput.notes, provenance: 'official', documentFingerprint: humanReviewInput.sourceFingerprint, evidenceFingerprint: humanReviewInput.evidenceFingerprint, candidateFingerprint: humanReviewInput.candidateFingerprint });
    expect(reviewedRecord.applicabilityScope).toEqual({ dimensions: ['provider', 'model', 'parameter'] });
    expect(reviewedRecord.parameterConditions).toEqual(candidate.payload.parameterConditions);
    expect(reviewedRecord.affectedModels).toEqual(['claude-opus-4-7', 'claude-mythos-preview']);
    expect(reviewedRecord.severity).toBe('high');
    expect(reviewedRecord.description).toContain('Claude Opus 4.7 and later');
    expect(reviewedRecord.evidence[0]?.summary).toContain('HTTP 400');
  });

  it('passes promotion validation and is represented by the local production registry', () => {
    expect(reviewedRecord.changeId).toBe(CANDIDATE_ID);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(4);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CANDIDATE_ID)).toBe(true);
  });

  it('marks an explicitly recognized model with a disallowed value as AFFECTED', () => {
    const result = evaluateCompatibility({ providerId: 'anthropic', usages: [usage()], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedModel).toBe('claude-opus-4-7');
    expect(result.matchedParameter).toBe('temperature');
    expect(result.matchedParameterValueStatus).toBe('disallowed');
    expect(result.reasonCodes).toContain('MATCHED_DISALLOWED_PARAMETER_VALUE');
  });

  it('marks absent or statically allowed restricted parameters as NOT_AFFECTED', () => {
    const absent = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'absent', parameter: undefined, parameterValueStatus: undefined })], completeEvidence: true }, reviewedRecord, policy);
    const allowed = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'allowed', parameterValueStatus: 'allowed' })], completeEvidence: true }, reviewedRecord, policy);
    expect(absent.status).toBe('NOT_AFFECTED');
    expect(allowed.status).toBe('NOT_AFFECTED');
  });

  it('marks dynamic or unknown parameter values as NEEDS_REVIEW', () => {
    const result = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'dynamic-value', static: false, confidence: 0.55, parameterValueStatus: 'unknown' })], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('PARAMETER_VALUE_UNRESOLVED');
  });

  it('matches the explicitly recognized Mythos Preview model but does not guess broader family identifiers', () => {
    const mythos = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'mythos', model: 'claude-mythos-preview' })], completeEvidence: true }, reviewedRecord, policy);
    const possibleLater = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'possible-later', model: 'claude-opus-4-8' })], completeEvidence: false }, reviewedRecord, policy);
    const dynamicModel = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'dynamic-model', model: undefined, static: false, confidence: 0.5 })], completeEvidence: false }, reviewedRecord, policy);
    expect(mythos.status).toBe('AFFECTED');
    expect(possibleLater.status).toBe('NEEDS_REVIEW');
    expect(dynamicModel.status).toBe('NEEDS_REVIEW');
  });

  it('returns NOT_AFFECTED for a clearly unrelated Anthropic model and no Anthropic claim for another provider', () => {
    const unrelatedModel = evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'unrelated-model', model: 'claude-sonnet-4-6', parameter: undefined, parameterValueStatus: undefined })], completeEvidence: true }, reviewedRecord, policy);
    const unrelatedProvider = evaluateCompatibility({ providerId: 'openai', usages: [usage({ id: 'unrelated-provider', providerId: 'openai' })], completeEvidence: true }, reviewedRecord, { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true });
    expect(unrelatedModel.status).toBe('NOT_AFFECTED');
    expect(unrelatedProvider.matchedUsages).toHaveLength(0);
    expect(unrelatedProvider.status).toBe('NOT_AFFECTED');
  });

  it('exposes model, parameter status, HTTP 400 consequence, source, and review provenance in proofs', () => {
    const results = [
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'affected', location: { file: 'src/a.ts', line: 10, column: 1 } })], completeEvidence: true }, reviewedRecord, policy),
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'not-affected', parameterValueStatus: 'allowed', location: { file: 'src/a.ts', line: 20, column: 1 } })], completeEvidence: true }, reviewedRecord, policy),
      evaluateCompatibility({ providerId: 'anthropic', usages: [usage({ id: 'needs-review', static: false, confidence: 0.5, parameterValueStatus: 'unknown', location: { file: 'src/a.ts', line: 30, column: 1 } })], completeEvidence: true }, reviewedRecord, policy),
    ];
    const proofs = buildCompatibilityProofSnapshot({ repositoryId: 'anthropic-parameter-review', baselineSha: 'd'.repeat(40), scanId: 'anthropic-parameter-review-proof', results, mode: 'test' });
    expect(results.map((result) => result.status)).toEqual(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
    expect(proofs).toHaveLength(3);
    expect(proofs.some((proof) => proof.matchedModel === 'claude-opus-4-7' && proof.matchedParameter === 'temperature' && proof.matchedParameterValueStatus === 'disallowed')).toBe(true);
    expect(proofs.every((proof) => proof.officialSourceReference === candidate.sourceUrl && proof.reviewStatus === 'reviewed' && proof.provenance === 'official')).toBe(true);
    expect(proofs.some((proof) => proof.proofEvidence.some((evidence) => evidence.kind === 'official-source' && evidence.detail.includes('HTTP 400')))).toBe(true);
    expect(proofs.some((proof) => proof.status === 'NEEDS_REVIEW')).toBe(true);
  });
});
