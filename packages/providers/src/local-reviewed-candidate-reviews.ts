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

const ANTHROPIC_PARAMETER_CANDIDATE_ID = 'anthropic-opus-4-7-parameter-restrictions';
const anthropicParameterCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(ANTHROPIC_PARAMETER_CANDIDATE_ID);
if (!anthropicParameterCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${ANTHROPIC_PARAMETER_CANDIDATE_ID}`);

/** Explicit human review for the parameter restriction; production insertion remains a separate local-registry step. */
export const LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: "I verified the complete official Anthropic model-deprecations source and confirmed that the candidate-specific evidence is unchanged: temperature, top_p, and top_k are restricted to non-default values for Claude Opus 4.7 and later models and Claude Mythos Preview, with HTTP 400 behavior and guidance to omit the parameters and use prompting. I approve only deterministic applicability supported by the normalized candidate. I do not assert numeric default values, SDK package, SDK version, SDK method, endpoint, unsupported model aliases, or guessed identifiers for future models covered by 'and later'.",
  sourceFingerprint: '963a809d2191441ef8c2bcbfbdab4071fccc129394b48af249249bccecc4594c',
  evidenceFingerprint: '4b7fec20394d52ac8c69563bff460509c0873fff225ecbc9489982ef45ab6948',
  candidateFingerprint: '6f4b69347a030bfb7dfc28d039eb50ac93e6ca4c931294f776aa548dc9ae64dc',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_CANDIDATE = reviewCandidate(anthropicParameterCandidate, LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION);

export const LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW_ACTION.candidateFingerprint,
});

const GITHUB_ORGANIZATION_SECURITY_CANDIDATE_ID = 'github-organization-security-fields-removed-2026-04-21';
const githubOrganizationSecurityCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(GITHUB_ORGANIZATION_SECURITY_CANDIDATE_ID);
if (!githubOrganizationSecurityCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${GITHUB_ORGANIZATION_SECURITY_CANDIDATE_ID}`);

/** Explicit user-supplied local decision; production insertion is performed by the local reviewed-record registry. */
export const LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official GitHub changelog. I approve authoritative applicability at provider + resource + response_field scope for the seven exact organization REST API response fields listed by GitHub. The source identifies GitHub Code Security configurations as the replacement. I do not assert an Octokit package, package version, SDK method, endpoint path, GraphQL applicability, or API-version scope.',
  sourceFingerprint: '53a3e3e386510ad229d78b9ccca3eac343c43596d5e9dd14e79b5a74dc0e9d5a',
  evidenceFingerprint: '58adfc89004241550723c3891f29953e65d03dd752d974932fbc61d54e05c78f',
  candidateFingerprint: '59bb233364fafa44ab4bff7177300bc507a7478ae84f0d7cf001d9522eb9a708',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_CANDIDATE = reviewCandidate(githubOrganizationSecurityCandidate, LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION);

export const LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_GITHUB_ORGANIZATION_SECURITY_REVIEW_ACTION.candidateFingerprint,
});
