import { CandidateReviewSchema } from '@apiproof/shared';
import type { CandidateReviewAction } from '@apiproof/shared';
import { reviewCandidate } from './candidate-review.js';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './official-change-candidates.js';

const CANDIDATE_ID = 'openai-assistants-api-sunset-2026-08-26';
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${CANDIDATE_ID}`);

/** Explicit user-supplied local decision; changing candidate evidence invalidates this binding. */
export const LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: 'I verified the official Assistants API deprecation and removal facts. I approve authoritative applicability at provider + resource scope for Assistants API only. The documented replacements are Responses API and Conversations API. I do not assert any SDK package, SDK version, SDK operation, or endpoint path.',
  sourceFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
  evidenceFingerprint: '70f977467ffc1ba85e48684000a7af3eb87ee6beaad85cc0f0ce908c849809cb',
  candidateFingerprint: '9c8a0e3792e19bf6e8c231c91089c1702cd2781676df284383f4022292bc8c8d',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE = reviewCandidate(candidate, LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION);

export const LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_OPENAI_ASSISTANTS_REVIEW_ACTION.candidateFingerprint,
});
