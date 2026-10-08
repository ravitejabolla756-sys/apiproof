import { describe, expect, it } from 'vitest';
import {
  EXPANSION_OFFICIAL_CHANGE_CANDIDATES,
  fingerprintCandidate,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';

describe('provider expansion promotion-gate dry runs', () => {
  it('accepts complete candidates and fail-closes incomplete authoritative scopes without persisting any review', () => {
    const expectedPromotionBlockers = new Map([
      ['deepgram-legacy-intelligence-parameters-2025-11-05', 'APPLICABILITY_SCOPE_TARGET_REQUIRED:operation|endpoint|resource|model|domain'],
    ]);
    const observedPromotionBlockers = new Map<string, string>();
    for (const candidate of EXPANSION_OFFICIAL_CHANGE_CANDIDATES) {
      let projected;
      try {
        const reviewed = reviewCandidate(candidate, {
          decision: 'approve-for-promotion-review',
          reviewer: 'test-only promotion gate',
          reviewedAt: '2026-10-08',
          notes: 'Non-persisted structural promotion-gate validation; not a human review.',
          sourceFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
          evidenceFingerprint: candidate.evidenceFingerprint,
          candidateFingerprint: fingerprintCandidate(candidate),
        });
        projected = promoteCandidateToReviewed(reviewed, {
          status: 'reviewed',
          reviewer: 'test-only promotion gate',
          reviewerKind: 'human',
          reviewedAt: '2026-10-08',
          notes: 'Non-persisted structural promotion-gate validation; not a human review.',
          documentFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
          evidenceFingerprint: candidate.evidenceFingerprint,
          candidateFingerprint: fingerprintCandidate(candidate),
        }, [{
          url: candidate.sourceUrl,
          summary: 'Test-only official-source linkage for a non-persisted promotion projection.',
          accessedAt: '2026-10-08',
        }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        observedPromotionBlockers.set(candidate.candidateId, message);
        const expected = expectedPromotionBlockers.get(candidate.candidateId);
        if (expected !== message) throw new Error(`${candidate.candidateId}: ${message}`, { cause: error });
        expect(candidate.state, candidate.candidateId).toBe('needs_review');
        continue;
      }

      expect(projected.changeId, candidate.candidateId).toBe(candidate.payload.changeId ?? candidate.candidateId);
      expect(projected.review.status, candidate.candidateId).toBe('reviewed');
      expect(projected.review.reviewer, candidate.candidateId).toBe('test-only promotion gate');
      expect(candidate.state, candidate.candidateId).toBe('needs_review');
    }
    expect(observedPromotionBlockers).toEqual(expectedPromotionBlockers);
  });
});
