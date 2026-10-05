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

const ANTHROPIC_CANDIDATE_ID = 'anthropic-claude-opus-4-1-retirement-2026-08-05';
const anthropicCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(ANTHROPIC_CANDIDATE_ID);
if (!anthropicCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${ANTHROPIC_CANDIDATE_ID}`);

/** Explicit user-supplied local decision; this remains separate from the canonical queue and production registry. */
export const LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: 'I verified the official Anthropic model deprecation source, the exact Claude Opus 4.1 model identifier, the June 5, 2026 notification date, the August 5, 2026 retirement date, and the claude-opus-4-8 replacement. I approve authoritative applicability at provider + model scope only. I do not assert any SDK package, SDK version range, SDK method, endpoint, or model alias.',
  sourceFingerprint: '35a538cd9430ebba5e3d7dfe6416d420c35182c514e4686e774745f80e257a35',
  evidenceFingerprint: 'e6215ccb841b36bd31ab670fa76228f1ededc23e14762c3ff2f8d47df5ac315e',
  candidateFingerprint: 'dc699cbc5df9a1a7d0fde08ee330b0929329c6b2e734182ef5b661f1f788a6fb',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE = reviewCandidate(anthropicCandidate, LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION);

export const LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_ANTHROPIC_OPUS_4_1_REVIEW_ACTION.candidateFingerprint,
});
