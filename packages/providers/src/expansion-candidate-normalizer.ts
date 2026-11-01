import { fingerprintCandidateEvidence } from '@apiproof/shared';
import type { CandidateChange, CandidateSourceEvidence } from '@apiproof/shared';

export type ExpansionCandidateInput = Pick<CandidateChange, 'candidateId' | 'providerId' | 'sourceUrl' | 'sourceType' | 'discoveredAt' | 'payload'> & {
  documentFingerprint: string;
  evidence: CandidateSourceEvidence;
  evidenceNote: string;
};

/** Normalizes source-backed expansion candidates without widening their scope. */
export const makeExpansionCandidate = (input: ExpansionCandidateInput): CandidateChange => ({
  candidateId: input.candidateId,
  providerId: input.providerId,
  sourceUrl: input.sourceUrl,
  sourceType: input.sourceType,
  sourceFingerprint: input.documentFingerprint,
  documentFingerprint: input.documentFingerprint,
  evidenceFingerprint: fingerprintCandidateEvidence(input.evidence),
  sourceEvidence: input.evidence,
  sourceFingerprintBasis: 'full-body',
  discoveredAt: input.discoveredAt,
  state: 'needs_review',
  payload: {
    ...input.payload,
    sourceTitle: input.evidence.sourceTitle,
    sourceFacts: [input.payload.description],
    unknowns: [
      'SDK package, SDK version, and SDK method applicability are not established by the captured source.',
      'Runtime wrappers and dynamically constructed requests are not inferred.',
    ],
    severityBasis: 'Proposed severity reflects only the documented deprecation or removal; human review is required.',
  },
  auditTrail: [
    { state: 'discovered', at: input.discoveredAt, actor: 'official-source-capture', note: input.evidenceNote },
    { state: 'normalized', at: input.discoveredAt, actor: 'candidate-normalizer', note: 'Normalized only deterministic facts from the official source.' },
    { state: 'needs_review', at: input.discoveredAt, actor: 'candidate-normalizer', note: 'Human review is required before promotion or compatibility claims.' },
  ],
});
