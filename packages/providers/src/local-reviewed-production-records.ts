import { defaultSeverityForChangeType } from '@apiproof/shared';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';
import {
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_CANDIDATE,
  LOCAL_REVIEWED_OPENAI_ASSISTANTS_REVIEW,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW,
} from './local-reviewed-candidate-reviews.js';
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

const reviewedAnthropicOpusRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW,
  [{
    url: LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_CANDIDATE.sourceUrl,
    summary: 'Anthropic documents the Claude Opus 4.1 retirement date and names claude-opus-4-8 as the replacement.',
    accessedAt: LOCAL_REVIEWED_ANTHROPIC_OPUS_4_1_REVIEW.reviewedAt,
  }],
);

const reviewedAnthropicParameterRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_CANDIDATE,
  LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW,
  [{
    url: LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_CANDIDATE.sourceUrl,
    summary: 'Anthropic documents temperature, top_p, and top_k non-default values returning HTTP 400 for Claude Opus 4.7 and later models and Claude Mythos Preview; omit them and use prompting.',
    accessedAt: LOCAL_REVIEWED_ANTHROPIC_OPUS_4_7_PARAMETER_REVIEW.reviewedAt,
  }],
);

if (reviewedAnthropicOpusRecord.providerId !== 'anthropic'
  || reviewedAnthropicOpusRecord.changeId !== 'anthropic-claude-opus-4-1-retirement-2026-08-05'
  || reviewedAnthropicOpusRecord.applicabilityScope.dimensions.join(',') !== 'provider,model'
  || reviewedAnthropicOpusRecord.affectedModels.join(',') !== 'claude-opus-4-1-20250805'
  || reviewedAnthropicOpusRecord.removalAt !== '2026-08-05'
  || reviewedAnthropicOpusRecord.replacement?.model !== 'claude-opus-4-8'
  || reviewedAnthropicOpusRecord.severity !== 'high'
  || reviewedAnthropicOpusRecord.affectedPackages !== undefined
  || reviewedAnthropicOpusRecord.affectedVersionRange !== undefined
  || reviewedAnthropicOpusRecord.apiOperationPatterns.length !== 0
  || reviewedAnthropicOpusRecord.affectedEndpoints.length !== 0) {
  throw new Error('LOCAL_REVIEWED_ANTHROPIC_FACTS_INVALID:anthropic-claude-opus-4-1-retirement-2026-08-05');
}

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

if (reviewedAnthropicParameterRecord.providerId !== 'anthropic'
  || reviewedAnthropicParameterRecord.changeId !== 'anthropic-opus-4-7-parameter-restrictions'
  || reviewedAnthropicParameterRecord.applicabilityScope.dimensions.join(',') !== 'provider,model,parameter'
  || reviewedAnthropicParameterRecord.affectedModels.join(',') !== 'claude-opus-4-7,claude-mythos-preview'
  || reviewedAnthropicParameterRecord.affectedParameters.join(',') !== 'temperature,top_p,top_k'
  || reviewedAnthropicParameterRecord.parameterConditions?.map((condition) => `${condition.parameter}:${condition.predicate}`).join(',') !== 'temperature:non-default,top_p:non-default,top_k:non-default'
  || reviewedAnthropicParameterRecord.severity !== 'high'
  || reviewedAnthropicParameterRecord.affectedPackages !== undefined
  || reviewedAnthropicParameterRecord.affectedVersionRange !== undefined
  || reviewedAnthropicParameterRecord.apiOperationPatterns.length !== 0
  || reviewedAnthropicParameterRecord.affectedEndpoints.length !== 0
  || !reviewedAnthropicParameterRecord.description.includes('Claude Opus 4.7 and later')
  || !reviewedAnthropicParameterRecord.evidence.some((source) => source.summary.includes('HTTP 400'))) {
  throw new Error('LOCAL_REVIEWED_ANTHROPIC_PARAMETER_FACTS_INVALID:anthropic-opus-4-7-parameter-restrictions');
}

/** Explicitly reviewed local records; insertion into an external production store remains separate. */
export const LOCAL_REVIEWED_PRODUCTION_RECORDS = [reviewedGpt45Record, reviewedAssistantsRecord, reviewedAnthropicOpusRecord, reviewedAnthropicParameterRecord] as const;
