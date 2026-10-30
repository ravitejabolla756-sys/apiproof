import type { CandidateReviewAction, ReviewedCompatibilityChange } from '@apiproof/shared';
import { fingerprintCandidate } from './candidate-review.js';
import { reviewCandidate } from './candidate-review.js';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './official-change-candidates.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';

/**
 * Promotes the remaining source-backed candidates that were already present
 * in the official review queue. This batch adds no inferred applicability.
 */
const REVIEW_ACTIONS = {
  'clerk-core-3-after-switch-organization-url-removed': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Clerk Core 3 upgrade guide and approved the exact OrganizationSwitcher prop rename. No broader Clerk resource or SDK behavior is inferred.',
    sourceFingerprint: '99c50d018fc2f7ac9f6405adf2511e453605135ddc9bb658a522f1f27814a836',
    evidenceFingerprint: '0b5d1c58a54ccadc9afc23760c71a697109a69926d9a6f56c2155255a3e6d268',
    candidateFingerprint: '9645b29d567bc39db6eef1fa2309a4837637dd47f88b108105a44821f4df3e7c',
  },
  'elevenlabs-legacy-dubbing-endpoints-deprecated': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official ElevenLabs changelog and approved only the documented legacy dubbing endpoint boundary and project-based replacement.',
    sourceFingerprint: 'e20a43e903f000b6264e0c9bdc0cd869db5de4b061158e0746772201a3d508d7',
    evidenceFingerprint: '86c38328bc6cc4cb655f6bba9be296e474e955b3d8fcc754e5655a37d89cb4f0',
    candidateFingerprint: '108e2d1c5bf7990be819abd90d992d1191bd2644b9e36e9222672d7d8055ff63',
  },
  'firebase-vertexai-import-alias-removed-2025-07-17': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Firebase JavaScript release notes and approved the exact firebase/vertexai import removal and firebase/ai replacement.',
    sourceFingerprint: '475aa1636777df33e690b9101512bc7ca3b3b9429c2192a2eda339c5e73aea87',
    evidenceFingerprint: '9e36285ce62fc50a733d3f7c9039f2a2d7946d0f54244819d71fabc50064104c',
    candidateFingerprint: '2f8d36aff69e381df4423b12e5884bc0c1e55b1ae46035fda5eaa7ff0187bfb6',
  },
  'firebase-vertexai-symbols-removed-2025-07-17': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Firebase JavaScript release notes and approved only the named VertexAI symbol removals and replacement names.',
    sourceFingerprint: '475aa1636777df33e690b9101512bc7ca3b3b9429c2192a2eda339c5e73aea87',
    evidenceFingerprint: 'e1ab78b48c6547df655025efe6d02887d548c1b1bf6d335621e34722cb07aed0',
    candidateFingerprint: '52bef114107ae00cf7346d7685eeefed118d6136ec7cfbd421bdcff333e8deb5',
  },
  'groq-qwen-3-6-27b-retired-2026-09-14': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Groq deprecations page and approved the named model retirement and direct successor only.',
    sourceFingerprint: 'a7ca0f9d03bfe571f8975fe3f3d7b0e37b145081fdf7aa586292eb2178380992',
    evidenceFingerprint: 'f62d2947a09ff75c089031f749f6043fc73b53d48d0cde09d51b931bf5c41a4c',
    candidateFingerprint: 'b947c22c6b677295ba66971663621e93bd4296aa0ae4539cfde436fd30d3d56c',
  },
  'slack-files-upload-retired-2025-03-11': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Slack platform changelog and approved only the files.upload retirement and asynchronous upload replacement.',
    sourceFingerprint: 'f57bc982d00b6652d13b59de598cf87df0cd6ead9239b1fba1f2a1ae06334f5e',
    evidenceFingerprint: '89d410ce08af85fb322e9e7d8126cf151ab6bec3bca83d6edd74f504a3a32032',
    candidateFingerprint: '4742d79f281eb41821160c476a07e85f9ab5b3828d8a80b92741de65d51b5d91',
  },
  'stripe-subscription-period-fields-removed-2025-03-31': {
    reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'Verified the official Stripe changelog and approved the API-version-scoped Subscription field removal and SubscriptionItem replacement.',
    sourceFingerprint: 'e64635f0b756a6caab0df25b8390474e6d4e348455f4d173423856fc71bd49a7',
    evidenceFingerprint: 'b93504ad9305b197aec2f8e4b3277464530163f147db91509bdd8e0f8284b5ee',
    candidateFingerprint: 'c80cfc3dd4b91ab09e0924bb9d1662c3ce71c1498911fd13ee464365b3066170',
  },
} as const satisfies Record<string, Omit<CandidateReviewAction, 'decision'> & { candidateFingerprint: string }>;

const promote = (candidateId: keyof typeof REVIEW_ACTIONS): ReviewedCompatibilityChange => {
  const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(candidateId);
  if (!candidate) throw new Error(`BATCH10_CANDIDATE_MISSING:${candidateId}`);
  const action = REVIEW_ACTIONS[candidateId];
  if (fingerprintCandidate(candidate) !== action.candidateFingerprint) throw new Error(`BATCH10_FINGERPRINT_CHANGED_REVIEW_REQUIRED:${candidateId}`);
  const reviewed = reviewCandidate(candidate, { ...action, decision: 'approve-for-promotion-review' });
  return promoteCandidateToReviewed(reviewed, {
    status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt,
    notes: action.notes, documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint,
    candidateFingerprint: action.candidateFingerprint,
  }, [{ url: candidate.sourceUrl, summary: `Official ${candidate.providerId} source reviewed for the bounded documented change.`, accessedAt: action.reviewedAt }]);
};

export const PROVIDER_EXPANSION_BATCH10_REVIEWED_RECORDS = (Object.keys(REVIEW_ACTIONS) as Array<keyof typeof REVIEW_ACTIONS>).map(promote) as readonly ReviewedCompatibilityChange[];
