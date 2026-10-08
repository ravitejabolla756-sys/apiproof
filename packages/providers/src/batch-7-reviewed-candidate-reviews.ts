import type { CandidateChange, CandidateReviewAction, ReviewedCompatibilityChange } from '@apiproof/shared';
import { EXPANSION_OFFICIAL_CHANGE_CANDIDATES } from './expansion-change-candidates.js';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';

const findCandidate = (candidateId: string): CandidateChange => {
  const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`BATCH_7_CANDIDATE_MISSING:${candidateId}`);
  return candidate;
};

const reviewAndPromoteDry = (candidateId: string, action: CandidateReviewAction): { reviewedCandidate: CandidateChange; productionProjection: ReviewedCompatibilityChange } => {
  const candidate = findCandidate(candidateId);
  if (candidate.documentFingerprint !== action.sourceFingerprint || candidate.evidenceFingerprint !== action.evidenceFingerprint || fingerprintCandidate(candidate) !== action.candidateFingerprint) {
    throw new Error(`BATCH_7_FINGERPRINT_CHANGED_REVIEW_REQUIRED:${candidateId}`);
  }
  const reviewedCandidate = reviewCandidate(candidate, action);
  const productionProjection = promoteCandidateToReviewed(reviewedCandidate, {
    status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt,
    notes: action.notes, documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint,
    candidateFingerprint: action.candidateFingerprint,
  }, [{ url: reviewedCandidate.sourceUrl, summary: 'Official first-party source for the candidate-specific reviewed facts.', accessedAt: action.reviewedAt }]);
  return { reviewedCandidate, productionProjection };
};

export const BATCH_7_ELEVENLABS_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08',
  notes: 'I verified ElevenLabs\' official June 8, 2026 changelog. The models eleven_monolingual_v1, eleven_multilingual_v1, and scribe_v1 are deprecated and scheduled for removal on 2026-07-09. I verified the documented migration guidance: eleven_monolingual_v1 and eleven_multilingual_v1 should migrate to eleven_multilingual_v2 or another current model, and scribe_v1 should migrate to scribe_v2 or scribe_v2_realtime. I approve authoritative applicability only to those exact model identifiers. I do not assert any SDK package, SDK version, endpoint, API operation, model alias, or other ElevenLabs model.',
  sourceFingerprint: 'c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a', evidenceFingerprint: '5ad9764c8d1c42c47c315e6075cc1f6b4fbcc311cb6ae122046014a17ded5667', candidateFingerprint: '7c8612724d51d9238f0abe1b0e79da053031435986dfba24c5433813201f6a9d',
} as const satisfies CandidateReviewAction;

export const BATCH_7_CLERK_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08',
  notes: 'I verified Clerk\'s official API version 2026-05-12 upgrade guide. In API version 2026-05-12, public_metadata, private_metadata, and unsafe_metadata are removed from PATCH /v1/users/{user_id}; public_metadata and private_metadata are removed from PATCH /v1/organizations/{organization_id}; and unsafe_metadata is removed from PATCH /v1/me. I verified that Clerk directs these metadata updates to the dedicated metadata endpoints documented in the migration guide. I approve authoritative applicability only to API version 2026-05-12, the exact affected update endpoints, and the exact removed metadata fields represented by this candidate. I do not assert unrelated Clerk endpoints, unrelated API versions, or SDK package/version applicability beyond what is explicitly proven by the candidate.',
  sourceFingerprint: 'cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a', evidenceFingerprint: '9c095e2e61e9d21a20a4f113c57d68a7b55e99819279765c49c1fdbfab856149', candidateFingerprint: '34cbb038ef08d8663c4bf3118f4fb74fa987d44c6e182e124e45f4185813c4ba',
} as const satisfies CandidateReviewAction;

export const BATCH_7_GROQ_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08',
  notes: 'I verified Groq\'s official model deprecation documentation. The model identifiers groq/compound and groq/compound-mini were decommissioned on 2026-09-21, and requests to those model IDs are no longer supported. The official deprecation table does not specify a replacement model for these two entries. I approve authoritative applicability at provider + model scope only for groq/compound and groq/compound-mini. I do not assert any SDK package, SDK version, endpoint, API operation, model alias, or undocumented replacement model.',
  sourceFingerprint: '6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07', evidenceFingerprint: 'ac3a75f4b550484539e211ead2529b8a3198160f0c8b82cbf7547d024e265b2b', candidateFingerprint: 'f524737bff543b5fdbb81b61d4767186b0d1a853828c4d791ca7f78526d13587',
} as const satisfies CandidateReviewAction;

export const BATCH_7_FIREBASE_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08',
  notes: 'I verified Firebase\'s official Firebase Cloud Messaging deprecation documentation. The deprecated Instance ID server APIs represented by this candidate are scheduled for decommissioning on 2027-09-29, after which requests to the deprecated APIs will begin failing. I verified that Firebase provides migration guidance specific to the affected Instance ID use cases, including FCM v1 validation and the newer topic subscription APIs where applicable. I approve authoritative applicability only to the exact Instance ID server API endpoints and resources represented in this candidate. I do not assert all Firebase Cloud Messaging APIs, unrelated device-group behavior, SDK package/version applicability, or any endpoint not explicitly covered by the candidate.',
  sourceFingerprint: 'f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65', evidenceFingerprint: '29b85940142f39c5a0c91304295ea7d18090d2ead4eaf1c011e2ea6beb2a4ab4', candidateFingerprint: 'e2ed8f337cb795df1b61c6b8e13ef6a4ff45c5124295a34c6cc7cbbecdf116d0',
} as const satisfies CandidateReviewAction;

export const BATCH_7_GOOGLE_CLOUD_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08',
  notes: 'I verified Google Cloud\'s official Cloud API Registry release notes and feature-deprecation documentation. Support for retrieving, listing, enabling, and disabling Model Context Protocol servers and tools through the Cloud API Registry API was shut down on 2026-07-30. I verified that Google Cloud identifies Agent Registry as the alternative for storing, discovering, and governing MCP servers, tools, and AI agents. I approve authoritative applicability only to the exact Cloud API Registry MCP server and tool functionality represented in this candidate. I do not assert shutdown of Cloud API Registry as a whole, unrelated Service Usage APIs, SDK package/version applicability, or unrelated MCP functionality.',
  sourceFingerprint: 'e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917', evidenceFingerprint: '7c2b692277ed354aefda6100fcd9796c7c3534010450bce5c6269457c8a5cec4', candidateFingerprint: 'ece56605780bdbce9771ba7af275a81a1018a51e4645fb8724dc883280dfa3d4',
} as const satisfies CandidateReviewAction;

export const BATCH_7_REVIEWED_CANDIDATES = [
  reviewAndPromoteDry('elevenlabs-v1-model-removal-2026-07-09', BATCH_7_ELEVENLABS_REVIEW_ACTION),
  reviewAndPromoteDry('clerk-api-2026-05-12-metadata-fields-removed', BATCH_7_CLERK_REVIEW_ACTION),
  reviewAndPromoteDry('groq-models-decommissioned-2026-09-21', BATCH_7_GROQ_REVIEW_ACTION),
  reviewAndPromoteDry('firebase-instance-id-server-apis-decommission-2027-09-29', BATCH_7_FIREBASE_REVIEW_ACTION),
  reviewAndPromoteDry('google-cloud-api-registry-mcp-shutdown-2026-07-30', BATCH_7_GOOGLE_CLOUD_REVIEW_ACTION),
] as const;
