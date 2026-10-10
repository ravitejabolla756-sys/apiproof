import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY, classifySourceUpdate, fingerprintCandidate, reviewCandidate } from '@apiproof/providers';
import { CandidateReviewActionSchema, fingerprintCandidateEvidence } from '@apiproof/shared';
import type { CandidateChange, CandidateSourceEvidence } from '@apiproof/shared';

const current = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26');
if (!current?.sourceEvidence || !current.evidenceFingerprint || !current.documentFingerprint) throw new Error('REFRESHED_ASSISTANTS_PROVENANCE_MISSING');

const evidence = (claims: CandidateSourceEvidence['claims']): CandidateSourceEvidence => ({
  providerId: current.providerId,
  sourceUrl: current.sourceUrl,
  sourceTitle: 'Deprecations | OpenAI API',
  sourceLocator: 'section:2025-08-20: Assistants API',
  claims,
});

const refreshed = (overrides: Partial<CandidateChange>): CandidateChange => ({
  ...current,
  ...overrides,
});

const withEvidence = (claims: CandidateSourceEvidence['claims'], documentFingerprint = current.documentFingerprint): CandidateChange => {
  const sourceEvidence = evidence(claims);
  const fingerprint = documentFingerprint ?? current.sourceFingerprint;
  return refreshed({ sourceEvidence, evidenceFingerprint: fingerprintCandidateEvidence(sourceEvidence), documentFingerprint: fingerprint, sourceFingerprint: fingerprint });
};

const actionFor = (candidate: CandidateChange, overrides: Record<string, unknown> = {}) => ({
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-05',
  notes: 'Reviewed deterministic extracted source evidence.',
  sourceFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
  candidateFingerprint: fingerprintCandidate(candidate),
  evidenceFingerprint: candidate.evidenceFingerprint,
  ...overrides,
});

describe('evidence-scoped source provenance', () => {
  it('classifies identical document and evidence as unchanged', () => {
    expect(classifySourceUpdate(current, current)).toBe('SOURCE_UNCHANGED');
  });

  it('distinguishes unrelated document changes from candidate evidence changes', () => {
    expect(classifySourceUpdate(current, withEvidence(current.sourceEvidence!.claims, 'a'.repeat(64)))).toBe('DOCUMENT_UPDATED_EVIDENCE_UNCHANGED');
  });

  it.each([
    ['removal date', [{ key: 'removalAt', value: '2027-08-26' }]],
    ['replacement guidance', [{ key: 'replacement', value: 'Responses API only' }]],
    ['affected resource', [{ key: 'resource', value: 'Responses API' }]],
  ] as const)('requires review when %s evidence changes', (_label, changedClaim) => {
    const claims = current.sourceEvidence!.claims.filter((claim) => claim.key !== changedClaim[0]!.key).concat(changedClaim);
    expect(classifySourceUpdate(current, withEvidence(claims))).toBe('EVIDENCE_UPDATED_REVIEW_REQUIRED');
  });

  it('requires review when the relevant section is unavailable', () => {
    expect(classifySourceUpdate(current, null)).toBe('SOURCE_UNAVAILABLE_REVIEW_REQUIRED');
    expect(classifySourceUpdate(current, refreshed({ sourceEvidence: undefined, evidenceFingerprint: undefined }))).toBe('SOURCE_UNAVAILABLE_REVIEW_REQUIRED');
  });

  it('rejects an old candidate fingerprint and accepts the current evidence binding locally', () => {
    const oldClaims = current.sourceEvidence!.claims.filter((claim) => claim.key !== 'removalAt').concat({ key: 'removalAt', value: '2027-08-26' });
    const oldCandidate = withEvidence(oldClaims, 'b'.repeat(64));
    expect(() => reviewCandidate(current, actionFor(current, { candidateFingerprint: fingerprintCandidate(oldCandidate) }))).toThrow('CANDIDATE_FINGERPRINT_MISMATCH');
    const reviewed = reviewCandidate(current, actionFor(current));
    expect(CandidateReviewActionSchema.parse(actionFor(current))).toMatchObject({ evidenceFingerprint: current.evidenceFingerprint });
    expect(reviewed.state).toBe('reviewed');
  });

  it('keeps the canonical candidate pending while the reviewed projection remains official', () => {
    expect(current.state).toBe('needs_review');
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(current.candidateId)).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(current.candidateId)?.review.evidenceFingerprint).toBe(current.evidenceFingerprint);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.every((change) => change.review.provenance === 'official')).toBe(true);
  });
});
