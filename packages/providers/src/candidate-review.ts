import { createHash } from 'node:crypto';
import { CandidateChangeSchema, CandidateReviewActionSchema } from '@apiproof/shared';
import type { CandidateChange, CandidateReviewAction } from '@apiproof/shared';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
};

/** Fingerprint of the normalized candidate facts, excluding lifecycle audit entries. */
export function fingerprintCandidate(input: unknown): string {
  const candidate = CandidateChangeSchema.parse(input);
  const facts = {
    candidateId: candidate.candidateId,
    officialSource: { providerId: candidate.providerId, sourceUrl: candidate.sourceUrl },
    evidenceFingerprint: candidate.evidenceFingerprint ?? null,
    sourceEvidence: candidate.sourceEvidence ?? null,
    applicabilityScope: candidate.payload.applicabilityScope ?? null,
    severity: candidate.payload.severity ?? null,
    severityBasis: candidate.payload.severityBasis ?? null,
    payload: candidate.payload,
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(facts))).digest('hex');
}

/**
 * Records an explicit local review decision. Approval only advances the
 * candidate lifecycle to `reviewed`; production promotion remains a separate
 * human-controlled call to promoteCandidateToReviewed().
 */
export function reviewCandidate(input: unknown, actionInput: unknown): CandidateChange {
  const candidate = CandidateChangeSchema.parse(input);
  const action = CandidateReviewActionSchema.parse(actionInput) as CandidateReviewAction;
  if (candidate.state !== 'needs_review') throw new Error(`CANDIDATE_REVIEW_STATE_INVALID:${candidate.candidateId}`);
  if (action.sourceFingerprint !== (candidate.documentFingerprint ?? candidate.sourceFingerprint)) throw new Error(`SOURCE_UPDATED_REVIEW_REQUIRED:${candidate.candidateId}`);
  if (candidate.evidenceFingerprint && !action.evidenceFingerprint) throw new Error(`EVIDENCE_FINGERPRINT_REQUIRED:${candidate.candidateId}`);
  if (candidate.evidenceFingerprint && action.evidenceFingerprint !== candidate.evidenceFingerprint) throw new Error(`EVIDENCE_FINGERPRINT_MISMATCH:${candidate.candidateId}`);
  if (action.candidateFingerprint !== fingerprintCandidate(candidate)) throw new Error(`CANDIDATE_FINGERPRINT_MISMATCH:${candidate.candidateId}`);
  const nextState = action.decision === 'reject' ? 'rejected' : 'reviewed';
  const reviewBinding = nextState === 'reviewed' && candidate.evidenceFingerprint ? {
    documentFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
    evidenceFingerprint: candidate.evidenceFingerprint,
    candidateFingerprint: action.candidateFingerprint,
  } : undefined;
  return CandidateChangeSchema.parse({
    ...candidate,
    state: nextState,
    auditTrail: [...candidate.auditTrail, {
      state: nextState,
      at: action.reviewedAt,
      actor: action.reviewer,
      note: action.notes,
      ...(reviewBinding ? { reviewBinding } : {}),
    }],
  });
}
