import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, fingerprintCandidate, reviewCandidate } from '@apiproof/providers';
import { CandidateReviewActionSchema } from '@apiproof/shared';

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates[0]!;
const action = (overrides: Record<string, unknown> = {}) => ({
  decision: 'approve-for-promotion-review', reviewer: 'local-human-reviewer', reviewedAt: '2026-10-05',
  notes: 'Reviewed the captured official evidence; verify SDK scope separately before production promotion.',
  sourceFingerprint: candidate.sourceFingerprint, evidenceFingerprint: candidate.evidenceFingerprint, candidateFingerprint: fingerprintCandidate(candidate), ...overrides,
});

describe('local candidate review workflow', () => {
  it('keeps the candidate inventory attributable to official titles', () => {
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates).toHaveLength(71);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.every((entry) => Boolean(entry.payload.sourceTitle))).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.every((entry) => (entry.payload.sourceFacts?.length ?? 0) > 0)).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.every((entry) => (entry.payload.unknowns?.length ?? 0) > 0)).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.every((entry) => Boolean(entry.payload.severityBasis))).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.every((entry) => entry.sourceFingerprintBasis === 'full-body')).toBe(true);
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((entry) => entry.providerId === 'openai' || entry.providerId === 'anthropic' || entry.providerId === 'github' || entry.providerId === 'twilio' || entry.providerId === 'supabase')).toHaveLength(10);
    expect(new Set(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((entry) => entry.providerId)).size).toBe(60);
  });

  it('records an explicit review decision without entering the production registry', () => {
    const reviewed = reviewCandidate(candidate, action());
    expect(reviewed.state).toBe('reviewed');
    expect(reviewed.auditTrail.at(-1)).toMatchObject({ state: 'reviewed', actor: 'local-human-reviewer' });
  });

  it('rejects changed source evidence and candidate facts', () => {
    expect(() => reviewCandidate(candidate, action({ sourceFingerprint: 'f'.repeat(64) }))).toThrow('SOURCE_UPDATED_REVIEW_REQUIRED');
    expect(() => reviewCandidate(candidate, action({ candidateFingerprint: 'e'.repeat(64) }))).toThrow('CANDIDATE_FINGERPRINT_MISMATCH');
  });

  it('accepts full-body provenance for candidates sharing one official page', () => {
    const openAiCandidates = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((entry) => entry.sourceUrl.includes('openai.com'));
    expect(openAiCandidates).toHaveLength(2);
    expect(new Set(openAiCandidates.map((entry) => entry.sourceFingerprint))).toHaveLength(2);
  });

  it('supports explicit rejection and validates the review action contract', () => {
    expect(reviewCandidate(candidate, action({ decision: 'reject', notes: 'The source does not prove the SDK mapping.' })).state).toBe('rejected');
    expect(() => CandidateReviewActionSchema.parse({ ...action(), decision: 'approved' })).toThrow();
  });
});
