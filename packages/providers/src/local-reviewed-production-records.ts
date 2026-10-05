import { defaultSeverityForChangeType } from '@apiproof/shared';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';
import { LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE, LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW } from './local-reviewed-candidate-reviews.js';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './official-change-candidates.js';

const CANDIDATE_ID = 'openai-gpt-4-5-preview-removal-2025-07-14';
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CANDIDATE_ID);
if (!candidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${CANDIDATE_ID}`);

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: 'I verified the official OpenAI deprecation source, the gpt-4.5-preview identifier, deprecation date 2025-04-14, removal date 2025-07-14, replacement model gpt-4.1, and the current stored source/candidate fingerprints. I approve authoritative applicability at provider + model scope only. I do not assert any SDK package, SDK version range, or exact SDK operation.',
  sourceFingerprint: candidate.sourceFingerprint,
  candidateFingerprint: fingerprintCandidate(candidate),
};

const reviewedCandidate = reviewCandidate(candidate, reviewAction);
const changeType = reviewedCandidate.payload.changeType;
if (!changeType) throw new Error(`LOCAL_REVIEWED_CHANGE_TYPE_MISSING:${CANDIDATE_ID}`);

const promotionInput = {
  ...reviewedCandidate,
  payload: {
    ...reviewedCandidate.payload,
    severity: defaultSeverityForChangeType(changeType),
    replacement: { model: 'gpt-4.1' },
  },
};

if (promotionInput.providerId !== 'openai'
  || promotionInput.payload.applicabilityScope?.dimensions.join(',') !== 'provider,model'
  || promotionInput.payload.affectedModels?.join(',') !== 'gpt-4.5-preview'
  || promotionInput.payload.removalAt !== '2025-07-14'
  || promotionInput.payload.replacement?.model !== 'gpt-4.1') {
  throw new Error(`LOCAL_REVIEWED_OPENAI_FACTS_INVALID:${CANDIDATE_ID}`);
}

const reviewedGpt45Record = promoteCandidateToReviewed(
  promotionInput,
  { status: 'reviewed', reviewer: reviewAction.reviewer, reviewerKind: 'human', reviewedAt: reviewAction.reviewedAt, notes: reviewAction.notes },
  [{ url: candidate.sourceUrl, summary: 'Official OpenAI deprecation source.', accessedAt: reviewAction.reviewedAt }],
);

const assistantsSourceUrl = 'https://developers.openai.com/api/docs/deprecations';
const reviewedAssistantsRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE,
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW,
  [{
    url: assistantsSourceUrl,
    summary: 'Official source states the Assistants API removal date and names the Responses API and Conversations API as replacements.',
    accessedAt: LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW.reviewedAt,
  }],
);

if (reviewedAssistantsRecord.providerId !== 'openai'
  || reviewedAssistantsRecord.applicabilityScope.dimensions.join(',') !== 'provider,resource'
  || reviewedAssistantsRecord.affectedResources?.join(',') !== 'Assistants API'
  || reviewedAssistantsRecord.removalAt !== '2026-08-26'
  || reviewedAssistantsRecord.replacement?.resources?.join(',') !== 'Responses API,Conversations API'
  || reviewedAssistantsRecord.affectedPackages !== undefined
  || reviewedAssistantsRecord.affectedVersionRange !== undefined
  || reviewedAssistantsRecord.apiOperationPatterns.length !== 0
  || reviewedAssistantsRecord.affectedEndpoints.length !== 0) {
  throw new Error('LOCAL_REVIEWED_ASSISTANTS_FACTS_INVALID:openai-assistants-api-sunset-2026-08-26');
}

/** Explicitly reviewed local records; insertion into an external production store remains separate. */
export const LOCAL_REVIEWED_PRODUCTION_RECORDS = [reviewedGpt45Record, reviewedAssistantsRecord] as const;
