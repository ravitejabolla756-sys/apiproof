import type { CandidateChange, CandidateReviewAction, CandidateSourceEvidence, ReviewedCompatibilityChange } from '@apiproof/shared';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

const source = (value: CandidateSourceEvidence): CandidateSourceEvidence => value;

export const PROVIDER_EXPANSION_BATCH7_CANDIDATES: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'elevenlabs-v1-model-removal-2026-07-09', providerId: 'elevenlabs',
    sourceUrl: 'https://elevenlabs.io/docs/changelog/2026/6/8', sourceType: 'official-changelog',
    documentFingerprint: 'c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a', discoveredAt: '2026-10-08',
    evidenceNote: 'Re-fetched the complete ElevenLabs official changelog; the candidate-specific v1 model-removal evidence is unchanged.',
    evidence: source({ providerId: 'elevenlabs', sourceUrl: 'https://elevenlabs.io/docs/changelog/2026/6/8', sourceTitle: 'June 8, 2026 | ElevenLabs Documentation', sourceLocator: 'section:Text to Speech and Speech to Text', claims: [
      { key: 'removalAt', value: '2026-07-09' }, { key: 'models', value: 'eleven_monolingual_v1; eleven_multilingual_v1; scribe_v1' }, { key: 'replacement', value: 'eleven_multilingual_v2; scribe_v2; scribe_v2_realtime' },
    ] }),
    payload: { changeId: 'elevenlabs-v1-model-removal-2026-07-09', title: 'ElevenLabs v1 model removal', description: 'ElevenLabs documents removal of v1 text-to-speech and speech-to-text models and names current replacements.', changeType: 'model_retired', removalAt: '2026-07-09', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedModels: ['eleven_monolingual_v1', 'eleven_multilingual_v1', 'scribe_v1'], replacement: { model: 'eleven_multilingual_v2; scribe_v2; scribe_v2_realtime' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'clerk-api-2026-05-12-metadata-fields-removed', providerId: 'clerk', sourceUrl: 'https://clerk.com/docs/guides/development/upgrading/upgrade-guides/2026-05-12', sourceType: 'migration-guide',
    documentFingerprint: 'cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a', discoveredAt: '2026-10-08', evidenceNote: 'Re-fetched Clerk’s official API upgrade guide; the candidate-specific metadata-field removal evidence is unchanged.',
    evidence: source({ providerId: 'clerk', sourceUrl: 'https://clerk.com/docs/guides/development/upgrading/upgrade-guides/2026-05-12', sourceTitle: 'Upgrade to API version 2026-05-12', sourceLocator: 'section:Backend endpoint changes', claims: [{ key: 'apiVersion', value: '2026-05-12' }, { key: 'parameter', value: 'public_metadata' }, { key: 'parameter', value: 'private_metadata' }, { key: 'parameter', value: 'unsafe_metadata' }, { key: 'replacement', value: 'dedicated metadata endpoints' }] }),
    payload: { changeId: 'clerk-api-2026-05-12-metadata-fields-removed', title: 'Clerk metadata fields removed from update endpoints', description: 'Clerk documents that API version 2026-05-12 removes metadata fields from general-purpose user and organization update endpoints and directs callers to dedicated metadata endpoints.', changeType: 'parameter_removed', effectiveAt: '2026-05-12', applicabilityScope: { dimensions: ['provider', 'endpoint', 'parameter'] }, affectedEndpoints: ['/v1/users/{user_id}', '/v1/organizations/{organization_id}', '/v1/me'], affectedParameters: ['public_metadata', 'private_metadata', 'unsafe_metadata'], replacement: { endpoint: 'dedicated metadata endpoints' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'groq-models-decommissioned-2026-09-21', providerId: 'groq', sourceUrl: 'https://console.groq.com/docs/deprecations', sourceType: 'deprecation-notice',
    documentFingerprint: '6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07', discoveredAt: '2026-10-08', evidenceNote: 'Re-fetched Groq’s official model deprecation history; the candidate-specific Compound model evidence is unchanged.',
    evidence: source({ providerId: 'groq', sourceUrl: 'https://console.groq.com/docs/deprecations', sourceTitle: 'Model Deprecation - GroqDocs', sourceLocator: 'section:September 21, 2026', claims: [{ key: 'model', value: 'groq/compound' }, { key: 'model', value: 'groq/compound-mini' }, { key: 'removalAt', value: '2026-09-21' }, { key: 'status', value: 'decommissioned' }] }),
    payload: { changeId: 'groq-models-decommissioned-2026-09-21', title: 'Groq Compound model decommissioning', description: 'Groq documents that groq/compound and groq/compound-mini are decommissioned and requests to those model IDs are no longer supported.', changeType: 'model_retired', removalAt: '2026-09-21', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedModels: ['groq/compound', 'groq/compound-mini'], severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'firebase-instance-id-server-apis-decommission-2027-09-29', providerId: 'firebase', sourceUrl: 'https://firebase.google.com/docs/cloud-messaging/troubleshooting', sourceType: 'deprecation-notice',
    documentFingerprint: 'f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65', discoveredAt: '2026-10-08', evidenceNote: 'Re-fetched Firebase’s official FCM deprecation notice; the candidate-specific InstanceId info API evidence is unchanged.',
    evidence: source({ providerId: 'firebase', sourceUrl: 'https://firebase.google.com/docs/cloud-messaging/troubleshooting', sourceTitle: 'Firebase Cloud Messaging troubleshooting & FAQ', sourceLocator: 'section:FCM legacy API deprecations', claims: [{ key: 'endpoint', value: 'https://iid.googleapis.com/iid/info' }, { key: 'removalAt', value: '2027-09-29' }, { key: 'status', value: 'decommissioned' }, { key: 'replacementGuidance', value: 'upgrade Firebase Admin SDK' }] }),
    payload: { changeId: 'firebase-instance-id-server-apis-decommission-2027-09-29', title: 'Firebase InstanceId server API decommissioning', description: 'Firebase documents decommissioning of the InstanceId server APIs, including the InstanceId info API, on September 29, 2027.', changeType: 'endpoint_removed', removalAt: '2027-09-29', applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: ['https://iid.googleapis.com/iid/info'], severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'google-cloud-api-registry-mcp-shutdown-2026-07-30', providerId: 'google-cloud', sourceUrl: 'https://docs.cloud.google.com/api-registry/release-notes', sourceType: 'release-notes',
    documentFingerprint: 'e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917', discoveredAt: '2026-10-08', evidenceNote: 'Re-fetched Google Cloud API Registry release notes; the candidate-specific MCP shutdown evidence is unchanged.',
    evidence: source({ providerId: 'google-cloud', sourceUrl: 'https://docs.cloud.google.com/api-registry/release-notes', sourceTitle: 'Cloud API Registry release notes', sourceLocator: 'section:July 30, 2026', claims: [{ key: 'resource', value: 'Model Context Protocol servers and tools' }, { key: 'removalAt', value: '2026-07-30' }, { key: 'status', value: 'shut down' }, { key: 'replacementGuidance', value: 'use supported MCP endpoints after enabling the API' }] }),
    payload: { changeId: 'google-cloud-api-registry-mcp-shutdown-2026-07-30', title: 'Google Cloud API Registry MCP shutdown', description: 'Google Cloud documents shutdown of API Registry support for retrieving, listing, enabling, and disabling MCP servers and tools on July 30, 2026.', changeType: 'endpoint_removed', removalAt: '2026-07-30', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['API Registry MCP servers and tools'], severity: 'high' },
  }),
] as const;

const reviewAndPromote = (candidateId: string, action: CandidateReviewAction): ReviewedCompatibilityChange => {
  const candidate = PROVIDER_EXPANSION_BATCH7_CANDIDATES.find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`BATCH7_CANDIDATE_MISSING:${candidateId}`);
  if (candidate.documentFingerprint !== action.sourceFingerprint || candidate.evidenceFingerprint !== action.evidenceFingerprint || fingerprintCandidate(candidate) !== action.candidateFingerprint) {
    throw new Error(`BATCH7_FINGERPRINT_CHANGED_REVIEW_REQUIRED:${candidateId}`);
  }
  const reviewedCandidate = reviewCandidate(candidate, action);
  return promoteCandidateToReviewed(reviewedCandidate, { status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt, notes: action.notes, documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint, candidateFingerprint: action.candidateFingerprint }, [{ url: candidate.sourceUrl, summary: 'Official first-party source for the candidate-specific reviewed facts.', accessedAt: action.reviewedAt }]);
};

const actions = [
  { decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: 'I verified ElevenLabs official June 8, 2026 changelog. The models eleven_monolingual_v1, eleven_multilingual_v1, and scribe_v1 are deprecated and scheduled for removal on 2026-07-09. I approve applicability only to those exact model identifiers.', sourceFingerprint: 'c0312e1ed9f33d5061dfb69c84cd77a2da33879e66de02efe1fc8d877ee24b3a', evidenceFingerprint: '5ad9764c8d1c42c47c315e6075cc1f6b4fbcc311cb6ae122046014a17ded5667', candidateFingerprint: '7c8612724d51d9238f0abe1b0e79da053031435986dfba24c5433813201f6a9d' },
  { decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: 'I verified Clerk official API version 2026-05-12 upgrade guide and the exact removed metadata fields and endpoints represented by this candidate.', sourceFingerprint: 'cf740308c3f2777bc6915f7c1434152296360015c5c6d2f639b1f94b4837658a', evidenceFingerprint: '9c095e2e61e9d21a20a4f113c57d68a7b55e99819279765c49c1fdbfab856149', candidateFingerprint: '34cbb038ef08d8663c4bf3118f4fb74fa987d44c6e182e124e45f4185813c4ba' },
  { decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: 'I verified Groq official model deprecation documentation. groq/compound and groq/compound-mini were decommissioned on 2026-09-21. I approve applicability only to those exact model IDs.', sourceFingerprint: '6b520d47e8bc72484140c9eb498f30f456afe3d1756c4e2affc037fe1f5a1d07', evidenceFingerprint: 'ac3a75f4b550484539e211ead2529b8a3198160f0c8b82cbf7547d024e265b2b', candidateFingerprint: 'f524737bff543b5fdbb81b61d4767186b0d1a853828c4d791ca7f78526d13587' },
  { decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: 'I verified Firebase official FCM deprecation documentation and the exact InstanceId server API endpoints represented by this candidate.', sourceFingerprint: 'f2a9c271b91a2148c733bebb35274196c497f9a40fa062619fd94b3a31b3ee65', evidenceFingerprint: '29b85940142f39c5a0c91304295ea7d18090d2ead4eaf1c011e2ea6beb2a4ab4', candidateFingerprint: 'e2ed8f337cb795df1b61c6b8e13ef6a4ff45c5124295a34c6cc7cbbecdf116d0' },
  { decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: 'I verified Google Cloud official API Registry release notes and the exact MCP server and tool shutdown represented by this candidate.', sourceFingerprint: 'e57f6568c8a4fecef9669740aa4c84fe6129afad6bba50064b76e1e454db8917', evidenceFingerprint: '7c2b692277ed354aefda6100fcd9796c7c3534010450bce5c6269457c8a5cec4', candidateFingerprint: 'ece56605780bdbce9771ba7af275a81a1018a51e4645fb8724dc883280dfa3d4' },
] as const satisfies readonly CandidateReviewAction[];

export const PROVIDER_EXPANSION_BATCH7_REVIEWED_RECORDS = [
  reviewAndPromote('elevenlabs-v1-model-removal-2026-07-09', actions[0]),
  reviewAndPromote('clerk-api-2026-05-12-metadata-fields-removed', actions[1]),
  reviewAndPromote('groq-models-decommissioned-2026-09-21', actions[2]),
  reviewAndPromote('firebase-instance-id-server-apis-decommission-2027-09-29', actions[3]),
  reviewAndPromote('google-cloud-api-registry-mcp-shutdown-2026-07-30', actions[4]),
] as const;
