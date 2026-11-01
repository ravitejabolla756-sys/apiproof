import type { CandidateReviewAction, ReviewedCompatibilityChange } from '@apiproof/shared';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './official-change-candidates.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';

/**
 * Closes the reviewed-rule breadth gap for the remaining launch providers.
 * Each promotion is bound to the already captured official candidate and its
 * fingerprints; no new applicability is inferred during promotion.
 */
const REVIEW_ACTIONS = {
  'aws-javascript-sdk-v2-end-of-support-2025-09-08': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official AWS SDK for JavaScript documentation and approve applicability only to the documented v2 end-of-support boundary. SDK package, method, and runtime wrapper scope remain unasserted unless the candidate states them explicitly.',
    sourceFingerprint: 'bec4b8242da094871c63c99ff85af19db395c36deb19b5010c571992d5d8c986',
    evidenceFingerprint: '5d00a123fc5df1451bc07b82fa71879df16c34d7678c3f800ed3ece040b2447f',
    candidateFingerprint: '251f0a0d232258a75e6e70781b0c82d5cedbc3cbe72899859a1fb5e5dfca4ff0',
  },
  'sendgrid-web-api-v2-mail-send-migration': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official SendGrid v2-to-v3 migration guide and approve only the exact legacy mail-send endpoint and documented v3 replacement represented by this candidate. No universal shutdown date is inferred.',
    sourceFingerprint: '891b427123d231e7c5867b4d43f5a89a7ab141c2b99a3fca264a9bfab7a37a8f',
    evidenceFingerprint: '005f6f4acc58f5cc2d279b2c36c52f8ab50ccbdd05f1ab41c53b70842292283f',
    candidateFingerprint: '7a4d41b469aeabf6a098c82e5fccc04440d1a5e0f05090652339691539edc786',
  },
  'shopify-api-2025-10-version-retired-2026-10-16': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official Shopify API versioning documentation and approve only the stated retirement boundary and replacement version. URL, header, SDK, and dynamic-version applicability remain review-only unless explicitly represented by the candidate.',
    sourceFingerprint: '8e45f2f93cd58e746149c07be881ba78c1ae5877175803b0620b0ccb0b53eaab',
    evidenceFingerprint: '13ed80cd4f25d9c9b2657dc58da8c3e476a0683adbc61a52807bf5250f627e90',
    candidateFingerprint: '2acad2def6e7bc328161e7ed9df3ef9deb8df26d18650e2c896292d28f558d90',
  },
  'auth0-connections-enabled-clients-deprecated-2026-01-21': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official Auth0 changelog and approve the documented enabled_clients read/update deprecation, including the create-operation exception, exactly as represented by this candidate.',
    sourceFingerprint: 'c6b5d1cba8dec2411606765b3f2f32b4ba977680f2fd775d70288229fc506e9c',
    evidenceFingerprint: '68812c443b031d5d67017eb9b87343d2579730a65848094caa45c3ec2218b57f',
    candidateFingerprint: '01036ed49527b906f8f7e3b71239e5111a1c7900e6d5f26829c63f7b22270296',
  },
  'vercel-webhooks-rest-api-removed': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official Vercel integration upgrade documentation and approve only the documented removal of the Integration Webhooks REST API and the generic Webhook URL replacement.',
    sourceFingerprint: '6ddee34c9ca44a26500b8c50789c6a61a8b4be432ba976a5e3b4f659964018c8',
    evidenceFingerprint: '8577065a143668d3d89bbaba8a2fb081cef7b5478e4595890e80a6ef4278bfc1',
    candidateFingerprint: '10f3ef68f5018247839ff489d5891b5fa68ae878341fc278f2efe50115bc3021',
  },
  'launchdarkly-api-versions-retired-2026-12-31': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official LaunchDarkly status notice and approve the stated retirement of older API versions and replacement version 20240415. Client-library and dynamic-version behavior remain unasserted.',
    sourceFingerprint: '1eaf2112b759499478886c6c868b8ab0cfa4c9e563951167d5e50871405a1ad3',
    evidenceFingerprint: '8ca9516ecfa63d60cc8b49c5c4bbe2ad521b30853ef707b16e8bb85f5d8e9c3c',
    candidateFingerprint: 'ed32675c8f10a8cdbe8b5deb6ce40b9147d398ae4cbc952d28ca9cad236a5424',
  },
  'braintree-drop-in-sdk-deprecated-2026-10-01': {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29',
    notes: 'I verified the official Braintree integration documentation and approve the exact Drop-in SDK deprecation and unsupported date, with the documented platform SDK replacements. Payment-processing behavior outside this scope is not inferred.',
    sourceFingerprint: '88d2f63c1b6cef6cfcca90c70d4173354b23d6cc2ac478c514889de2ca9ba595',
    evidenceFingerprint: 'b3b449733b2273780a5a4e330e5a8564f6f8375aa03960d7666761ef09b23730',
    candidateFingerprint: 'd681b9c02732533f1bffbd43ef0c0c54dcbb6c06a86df9d8385974a226a3cc53',
  },
} as const satisfies Record<string, CandidateReviewAction>;

const promote = (candidateId: keyof typeof REVIEW_ACTIONS): ReviewedCompatibilityChange => {
  const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(candidateId);
  if (!candidate) throw new Error(`BATCH9_CANDIDATE_MISSING:${candidateId}`);
  const action = REVIEW_ACTIONS[candidateId];
  if (fingerprintCandidate(candidate) !== action.candidateFingerprint) throw new Error(`BATCH9_FINGERPRINT_CHANGED_REVIEW_REQUIRED:${candidateId}`);
  const reviewed = reviewCandidate(candidate, action);
  return promoteCandidateToReviewed(reviewed, {
    status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt,
    notes: action.notes, documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint,
    candidateFingerprint: action.candidateFingerprint,
  }, [{ url: candidate.sourceUrl, summary: `Official ${candidate.providerId} source reviewed for the bounded documented change.`, accessedAt: action.reviewedAt }]);
};

export const PROVIDER_EXPANSION_BATCH9_REVIEWED_RECORDS = (Object.keys(REVIEW_ACTIONS) as Array<keyof typeof REVIEW_ACTIONS>).map(promote) as readonly ReviewedCompatibilityChange[];
