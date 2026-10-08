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
  LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_CANDIDATE,
  LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_REVIEW,
  LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_CANDIDATE,
  LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_REVIEW,
  LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_CANDIDATE,
  LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_REVIEW,
  LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE,
  LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_REVIEW,
  LOCAL_REVIEWED_SUPABASE_LOGS_ALL_CANDIDATE,
  LOCAL_REVIEWED_SUPABASE_LOGS_ALL_REVIEW,
  LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_CANDIDATE,
  LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_REVIEW,
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE,
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW,
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE,
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW,
  LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE,
  LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW,
  LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE,
  LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_REVIEW,
  LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_CANDIDATE,
  LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_REVIEW,
} from './local-reviewed-candidate-reviews.js';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from './official-change-candidates.js';
import { BATCH_7_REVIEWED_CANDIDATES } from './batch-7-reviewed-candidate-reviews.js';

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

const reviewedGithubOrganizationSecurityRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_CANDIDATE,
  LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_REVIEW,
  [{
    url: LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_CANDIDATE.sourceUrl,
    summary: 'GitHub removes seven organization REST API response fields on April 21, 2026 and directs integrations to GitHub Code Security configurations.',
    accessedAt: LOCAL_REVIEWED_GITHUB_ORGANIZATION_SECURITY_REVIEW.reviewedAt,
  }],
);

const reviewedGithubSynchronousSbomRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_CANDIDATE,
  LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_REVIEW,
  [{
    url: LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_CANDIDATE.sourceUrl,
    summary: 'GitHub deprecated the synchronous SBOM REST endpoint and documents asynchronous report generation with a pollable report URL.',
    accessedAt: LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_REVIEW.reviewedAt,
  }],
);

const reviewedTwilioRegionalDomainRecordBase = promoteCandidateToReviewed(
  LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_CANDIDATE,
  LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_REVIEW,
  [{
    url: LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_CANDIDATE.sourceUrl,
    summary: 'Twilio documents seven deprecated regional API domains and directs applications to api.twilio.com.',
    accessedAt: LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_REVIEW.reviewedAt,
  }],
);
const reviewedTwilioRegionalDomainRecord = { ...reviewedTwilioRegionalDomainRecordBase, publishedAt: '2026-02-04' };

const reviewedSupabaseLogsAllRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SUPABASE_LOGS_ALL_CANDIDATE,
  LOCAL_REVIEWED_SUPABASE_LOGS_ALL_REVIEW,
  [{
    url: LOCAL_REVIEWED_SUPABASE_LOGS_ALL_CANDIDATE.sourceUrl,
    summary: 'Supabase removes analytics/endpoints/logs.all and directs integrations to analytics/endpoints/logs using ClickHouse SQL.',
    accessedAt: LOCAL_REVIEWED_SUPABASE_LOGS_ALL_REVIEW.reviewedAt,
  }],
);

const reviewedSupabaseOpenApiAnonKeyRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_CANDIDATE,
  LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_REVIEW,
  [{
    url: LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_CANDIDATE.sourceUrl,
    summary: 'Supabase restricts OpenAPI access at /rest/v1/ for the anon key; service-role and new secret API keys remain allowed while ordinary Data API requests are unaffected.',
    accessedAt: LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_REVIEW.reviewedAt,
  }],
);

const reviewedTwilioStudioEngagementsRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE,
  LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_REVIEW,
  [{
    url: LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE.sourceUrl,
    summary: 'Twilio documents that Engagements were renamed to Executions; /Engagements is deprecated and no longer functions, and /Executions is the replacement.',
    accessedAt: LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_REVIEW.reviewedAt,
  }],
);

const reviewedSlackFilesUploadRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE,
  LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW,
  [{
    url: LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE.sourceUrl,
    summary: 'Slack documents that files.upload sunsets on November 12, 2025 and directs applications to files.getUploadURLExternal followed by files.completeUploadExternal.',
    accessedAt: LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW.reviewedAt,
  }],
);

const reviewedShopifyCheckoutApiRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE,
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW,
  [{
    url: LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE.sourceUrl,
    summary: 'Shopify shuts down Storefront Checkout mutations and REST Checkout endpoints on April 1, 2025 and directs applications to the Storefront Cart API or Checkout Sheet Kit for mobile apps.',
    accessedAt: LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW.reviewedAt,
  }],
);

const reviewedLaunchDarklyApiVersionRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE,
  LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW,
  [{
    url: LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE.sourceUrl,
    summary: 'LaunchDarkly identifies REST API version 20220603 as EOL on April 15, 2025 and identifies 20240415 as the current API version.',
    accessedAt: LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW.reviewedAt,
  }],
);

const reviewedAwsCloudWatchEvidentlyRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE,
  LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_REVIEW,
  [{
    url: LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE.sourceUrl,
    summary: 'AWS documents that support for Amazon CloudWatch Evidently ends on 2025-10-16 and that the Evidently console and resources become unavailable after end of support; no replacement service is stated in the captured notice.',
    accessedAt: LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_REVIEW.reviewedAt,
  }],
);

const reviewedCloudflareServiceKeyRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_CANDIDATE,
  LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_REVIEW,
  [{
    url: LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_CANDIDATE.sourceUrl,
    summary: 'Cloudflare removes X-Auth-User-Service-Key authentication on 2026-09-30 and directs integrations to API Tokens.',
    accessedAt: LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_REVIEW.reviewedAt,
  }],
);

if (reviewedCloudflareServiceKeyRecord.providerId !== 'cloudflare'
  || reviewedCloudflareServiceKeyRecord.changeId !== 'cloudflare-service-key-auth-removal-2026-09-30'
  || reviewedCloudflareServiceKeyRecord.removalAt !== '2026-09-30'
  || reviewedCloudflareServiceKeyRecord.severity !== 'high'
  || reviewedCloudflareServiceKeyRecord.applicabilityScope.dimensions.join(',') !== 'provider,auth_or_header'
  || reviewedCloudflareServiceKeyRecord.authOrHeaderPatterns?.join(',') !== 'X-Auth-User-Service-Key'
  || reviewedCloudflareServiceKeyRecord.replacement?.authOrHeader !== 'API Token'
  || reviewedCloudflareServiceKeyRecord.review.status !== 'reviewed'
  || reviewedCloudflareServiceKeyRecord.review.reviewer !== 'Ravi Teja'
  || reviewedCloudflareServiceKeyRecord.review.reviewedAt !== '2026-10-08'
  || reviewedCloudflareServiceKeyRecord.review.provenance !== 'official'
  || reviewedCloudflareServiceKeyRecord.review.documentFingerprint !== 'd42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9'
  || reviewedCloudflareServiceKeyRecord.review.evidenceFingerprint !== '9abd5f0455c3333c23638475e04813a8d20c21c153d5c85e7ab9abc300348ca8'
  || reviewedCloudflareServiceKeyRecord.review.candidateFingerprint !== 'e2d017c98bbd004f9101346c6f604102adc558cc468467ebf57dd92ae3f2abfb'
  || reviewedCloudflareServiceKeyRecord.affectedPackages !== undefined
  || reviewedCloudflareServiceKeyRecord.affectedVersionRange !== undefined
  || reviewedCloudflareServiceKeyRecord.affectedEndpoints.length !== 0
  || reviewedCloudflareServiceKeyRecord.apiOperationPatterns.length !== 0) {
  throw new Error('LOCAL_REVIEWED_CLOUDFLARE_FACTS_INVALID:cloudflare-service-key-auth-removal-2026-09-30');
}

if (reviewedAwsCloudWatchEvidentlyRecord.providerId !== 'aws'
  || reviewedAwsCloudWatchEvidentlyRecord.changeId !== 'aws-cloudwatch-evidently-end-of-support-2025-10-16'
  || reviewedAwsCloudWatchEvidentlyRecord.applicabilityScope.dimensions.join(',') !== 'provider,resource'
  || reviewedAwsCloudWatchEvidentlyRecord.affectedResources?.join(',') !== 'Amazon CloudWatch Evidently'
  || reviewedAwsCloudWatchEvidentlyRecord.removalAt !== '2025-10-16'
  || reviewedAwsCloudWatchEvidentlyRecord.severity !== 'high'
  || reviewedAwsCloudWatchEvidentlyRecord.review.status !== 'reviewed'
  || reviewedAwsCloudWatchEvidentlyRecord.review.reviewer !== 'Ravi Teja'
  || reviewedAwsCloudWatchEvidentlyRecord.review.reviewedAt !== '2026-10-08'
  || reviewedAwsCloudWatchEvidentlyRecord.review.provenance !== 'official'
  || reviewedAwsCloudWatchEvidentlyRecord.review.documentFingerprint !== 'd9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9'
  || reviewedAwsCloudWatchEvidentlyRecord.review.evidenceFingerprint !== '3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c'
  || reviewedAwsCloudWatchEvidentlyRecord.review.candidateFingerprint !== 'b5d9edc8aa05ef59598bfe100656a3fe151af9c1b2f8111ddbf5e24f6b3c6d0d'
  || reviewedAwsCloudWatchEvidentlyRecord.affectedPackages !== undefined
  || reviewedAwsCloudWatchEvidentlyRecord.affectedVersionRange !== undefined
  || reviewedAwsCloudWatchEvidentlyRecord.apiOperationPatterns.length !== 0
  || reviewedAwsCloudWatchEvidentlyRecord.affectedEndpoints.length !== 0) {
  throw new Error('LOCAL_REVIEWED_AWS_FACTS_INVALID:aws-cloudwatch-evidently-end-of-support-2025-10-16');
}

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

if (reviewedGithubOrganizationSecurityRecord.providerId !== 'github'
  || reviewedGithubOrganizationSecurityRecord.changeId !== 'github-organization-security-fields-removed-2026-04-21'
  || reviewedGithubOrganizationSecurityRecord.changeType !== 'response_field_removed'
  || reviewedGithubOrganizationSecurityRecord.publishedAt !== '2026-03-24'
  || reviewedGithubOrganizationSecurityRecord.removalAt !== '2026-04-21'
  || reviewedGithubOrganizationSecurityRecord.severity !== 'medium'
  || reviewedGithubOrganizationSecurityRecord.applicabilityScope.dimensions.join(',') !== 'provider,resource,response_field'
  || reviewedGithubOrganizationSecurityRecord.affectedResponseFields.length !== 7
  || reviewedGithubOrganizationSecurityRecord.replacement?.resources?.join(',') !== 'GitHub Code Security configurations'
  || reviewedGithubOrganizationSecurityRecord.affectedPackages !== undefined
  || reviewedGithubOrganizationSecurityRecord.affectedVersionRange !== undefined
  || reviewedGithubOrganizationSecurityRecord.apiOperationPatterns.length !== 0
  || reviewedGithubOrganizationSecurityRecord.affectedEndpoints.length !== 0) {
  throw new Error('LOCAL_REVIEWED_GITHUB_FACTS_INVALID:github-organization-security-fields-removed-2026-04-21');
}

if (reviewedGithubSynchronousSbomRecord.providerId !== 'github'
  || reviewedGithubSynchronousSbomRecord.changeId !== 'github-synchronous-sbom-endpoint-removal-2026-11-13'
  || reviewedGithubSynchronousSbomRecord.changeType !== 'endpoint_removed'
  || reviewedGithubSynchronousSbomRecord.publishedAt !== '2026-05-12'
  || reviewedGithubSynchronousSbomRecord.removalAt !== '2026-11-13'
  || reviewedGithubSynchronousSbomRecord.severity !== 'high'
  || reviewedGithubSynchronousSbomRecord.applicabilityScope.dimensions.join(',') !== 'provider,endpoint'
  || reviewedGithubSynchronousSbomRecord.affectedEndpoints.join(',') !== '/{owner}/{repo}/dependency-graph/sbom'
  || reviewedGithubSynchronousSbomRecord.replacement?.endpoint !== '/{owner}/{repo}/dependency-graph/sbom/generate-report'
  || reviewedGithubSynchronousSbomRecord.affectedPackages !== undefined
  || reviewedGithubSynchronousSbomRecord.affectedVersionRange !== undefined
  || reviewedGithubSynchronousSbomRecord.apiOperationPatterns.length !== 0) {
  throw new Error('LOCAL_REVIEWED_GITHUB_SBOM_FACTS_INVALID:github-synchronous-sbom-endpoint-removal-2026-11-13');
}

if (reviewedTwilioRegionalDomainRecord.providerId !== 'twilio'
  || reviewedTwilioRegionalDomainRecord.changeId !== 'twilio-regional-api-domain-removal-2026-04-28'
  || reviewedTwilioRegionalDomainRecord.changeType !== 'endpoint_removed'
  || reviewedTwilioRegionalDomainRecord.publishedAt !== '2026-02-04'
  || reviewedTwilioRegionalDomainRecord.removalAt !== '2026-04-28'
  || reviewedTwilioRegionalDomainRecord.severity !== 'high'
  || reviewedTwilioRegionalDomainRecord.applicabilityScope.dimensions.join(',') !== 'provider,domain'
  || reviewedTwilioRegionalDomainRecord.affectedDomains?.join(',') !== 'api.ie1.twilio.com,api.au1.twilio.com,api.br1.twilio.com,api.de1.twilio.com,api.jp1.twilio.com,api.sg1.twilio.com,api.us2.twilio.com'
  || reviewedTwilioRegionalDomainRecord.replacement?.domain !== 'api.twilio.com'
  || reviewedTwilioRegionalDomainRecord.affectedPackages !== undefined
  || reviewedTwilioRegionalDomainRecord.affectedVersionRange !== undefined
  || reviewedTwilioRegionalDomainRecord.apiOperationPatterns.length !== 0) {
  throw new Error('LOCAL_REVIEWED_TWILIO_FACTS_INVALID:twilio-regional-api-domain-removal-2026-04-28');
}

if (reviewedSupabaseLogsAllRecord.providerId !== 'supabase'
  || reviewedSupabaseLogsAllRecord.changeId !== 'supabase-management-logs-all-removal-2026-09-23'
  || reviewedSupabaseLogsAllRecord.changeType !== 'endpoint_removed'
  || reviewedSupabaseLogsAllRecord.publishedAt !== '2026-07-23'
  || reviewedSupabaseLogsAllRecord.removalAt !== '2026-09-23'
  || reviewedSupabaseLogsAllRecord.severity !== 'high'
  || reviewedSupabaseLogsAllRecord.applicabilityScope.dimensions.join(',') !== 'provider,endpoint'
  || reviewedSupabaseLogsAllRecord.affectedEndpoints.join(',') !== 'analytics/endpoints/logs.all'
  || reviewedSupabaseLogsAllRecord.replacement?.endpoint !== 'analytics/endpoints/logs'
  || reviewedSupabaseLogsAllRecord.affectedPackages !== undefined
  || reviewedSupabaseLogsAllRecord.affectedVersionRange !== undefined
  || reviewedSupabaseLogsAllRecord.apiOperationPatterns.length !== 0
  || !reviewedSupabaseLogsAllRecord.evidence.some((source) => source.summary.includes('ClickHouse SQL'))) {
  throw new Error('LOCAL_REVIEWED_SUPABASE_FACTS_INVALID:supabase-management-logs-all-removal-2026-09-23');
}

if (reviewedSupabaseOpenApiAnonKeyRecord.providerId !== 'supabase'
  || reviewedSupabaseOpenApiAnonKeyRecord.changeId !== 'supabase-openapi-anon-key-access-2026-03-11'
  || reviewedSupabaseOpenApiAnonKeyRecord.effectiveAt !== '2026-03-11'
  || reviewedSupabaseOpenApiAnonKeyRecord.applicabilityScope.dimensions.join(',') !== 'provider,endpoint,auth_or_header'
  || reviewedSupabaseOpenApiAnonKeyRecord.affectedEndpoints.join(',') !== '/rest/v1/'
  || reviewedSupabaseOpenApiAnonKeyRecord.authOrHeaderPatterns.join(',') !== 'anon key'
  || reviewedSupabaseOpenApiAnonKeyRecord.replacement?.authOrHeader !== 'service_role key or new secret API key'
  || reviewedSupabaseOpenApiAnonKeyRecord.severity !== 'high'
  || reviewedSupabaseOpenApiAnonKeyRecord.affectedPackages !== undefined
  || reviewedSupabaseOpenApiAnonKeyRecord.affectedVersionRange !== undefined
  || reviewedSupabaseOpenApiAnonKeyRecord.apiOperationPatterns.length !== 0) {
  throw new Error('LOCAL_REVIEWED_SUPABASE_OPENAPI_FACTS_INVALID:supabase-openapi-anon-key-access-2026-03-11');
}

if (reviewedTwilioStudioEngagementsRecord.providerId !== 'twilio'
  || reviewedTwilioStudioEngagementsRecord.changeId !== 'twilio-studio-engagements-endpoint-deprecated'
  || reviewedTwilioStudioEngagementsRecord.changeType !== 'endpoint_removed'
  || reviewedTwilioStudioEngagementsRecord.publishedAt !== undefined
  || reviewedTwilioStudioEngagementsRecord.effectiveAt !== undefined
  || reviewedTwilioStudioEngagementsRecord.removalAt !== undefined
  || reviewedTwilioStudioEngagementsRecord.applicabilityScope.dimensions.join(',') !== 'provider,endpoint'
  || reviewedTwilioStudioEngagementsRecord.affectedEndpoints.join(',') !== '/Engagements'
  || reviewedTwilioStudioEngagementsRecord.replacement?.endpoint !== '/Executions'
  || reviewedTwilioStudioEngagementsRecord.severity !== 'high'
  || reviewedTwilioStudioEngagementsRecord.affectedPackages !== undefined
  || reviewedTwilioStudioEngagementsRecord.affectedVersionRange !== undefined
  || reviewedTwilioStudioEngagementsRecord.apiOperationPatterns.length !== 0) {
  throw new Error('LOCAL_REVIEWED_TWILIO_STUDIO_FACTS_INVALID:twilio-studio-engagements-endpoint-deprecated');
}

if (reviewedSlackFilesUploadRecord.providerId !== 'slack'
  || reviewedSlackFilesUploadRecord.changeId !== 'slack-files-upload-removal-2025-11-12'
  || reviewedSlackFilesUploadRecord.changeType !== 'method_removed'
  || reviewedSlackFilesUploadRecord.removalAt !== '2025-11-12'
  || reviewedSlackFilesUploadRecord.severity !== 'high'
  || reviewedSlackFilesUploadRecord.applicabilityScope.dimensions.join(',') !== 'provider,operation'
  || reviewedSlackFilesUploadRecord.apiOperationPatterns.join(',') !== 'files.upload'
  || reviewedSlackFilesUploadRecord.replacement?.operation !== 'files.getUploadURLExternal and files.completeUploadExternal'
  || reviewedSlackFilesUploadRecord.review.status !== 'reviewed'
  || reviewedSlackFilesUploadRecord.review.reviewer !== 'Ravi Teja'
  || reviewedSlackFilesUploadRecord.review.reviewedAt !== '2026-10-08'
  || reviewedSlackFilesUploadRecord.review.provenance !== 'official'
  || reviewedSlackFilesUploadRecord.affectedPackages !== undefined
  || reviewedSlackFilesUploadRecord.affectedVersionRange !== undefined
  || reviewedSlackFilesUploadRecord.affectedEndpoints.length !== 0) {
  throw new Error('LOCAL_REVIEWED_SLACK_FACTS_INVALID:slack-files-upload-removal-2025-11-12');
}

if (reviewedShopifyCheckoutApiRecord.providerId !== 'shopify'
  || reviewedShopifyCheckoutApiRecord.changeId !== 'shopify-checkout-api-shutdown-2025-04-01'
  || reviewedShopifyCheckoutApiRecord.changeType !== 'endpoint_removed'
  || reviewedShopifyCheckoutApiRecord.publishedAt !== '2025-03-02'
  || reviewedShopifyCheckoutApiRecord.removalAt !== '2025-04-01'
  || reviewedShopifyCheckoutApiRecord.severity !== 'high'
  || reviewedShopifyCheckoutApiRecord.applicabilityScope.dimensions.join(',') !== 'provider,resource'
  || reviewedShopifyCheckoutApiRecord.affectedResources.join(',') !== 'Storefront Checkout mutations,REST Checkout endpoints'
  || reviewedShopifyCheckoutApiRecord.replacement?.resources?.join(',') !== 'Storefront Cart API,Checkout Sheet Kit'
  || reviewedShopifyCheckoutApiRecord.review.status !== 'reviewed'
  || reviewedShopifyCheckoutApiRecord.review.reviewer !== 'Ravi Teja'
  || reviewedShopifyCheckoutApiRecord.review.reviewedAt !== '2026-10-08'
  || reviewedShopifyCheckoutApiRecord.review.provenance !== 'official'
  || reviewedShopifyCheckoutApiRecord.affectedPackages !== undefined
  || reviewedShopifyCheckoutApiRecord.affectedVersionRange !== undefined
  || reviewedShopifyCheckoutApiRecord.apiOperationPatterns.length !== 0
  || reviewedShopifyCheckoutApiRecord.affectedEndpoints.length !== 0
  || reviewedShopifyCheckoutApiRecord.review.notes?.includes('checkout.liquid to Checkout Extensibility migration') !== true) {
  throw new Error('LOCAL_REVIEWED_SHOPIFY_FACTS_INVALID:shopify-checkout-api-shutdown-2025-04-01');
}

if (reviewedLaunchDarklyApiVersionRecord.providerId !== 'launchdarkly'
  || reviewedLaunchDarklyApiVersionRecord.changeId !== 'launchdarkly-api-version-20220603-eol-2025-04-15'
  || reviewedLaunchDarklyApiVersionRecord.changeType !== 'api_version_retired'
  || reviewedLaunchDarklyApiVersionRecord.removalAt !== '2025-04-15'
  || reviewedLaunchDarklyApiVersionRecord.severity !== 'high'
  || reviewedLaunchDarklyApiVersionRecord.applicabilityScope.dimensions.join(',') !== 'provider,api_version'
  || reviewedLaunchDarklyApiVersionRecord.apiVersionMetadata?.version !== '20220603'
  || reviewedLaunchDarklyApiVersionRecord.apiVersionMetadata?.replacement !== '20240415'
  || reviewedLaunchDarklyApiVersionRecord.review.status !== 'reviewed'
  || reviewedLaunchDarklyApiVersionRecord.review.reviewer !== 'Ravi Teja'
  || reviewedLaunchDarklyApiVersionRecord.review.reviewedAt !== '2026-10-08'
  || reviewedLaunchDarklyApiVersionRecord.review.provenance !== 'official'
  || reviewedLaunchDarklyApiVersionRecord.affectedPackages !== undefined
  || reviewedLaunchDarklyApiVersionRecord.affectedVersionRange !== undefined
  || reviewedLaunchDarklyApiVersionRecord.apiOperationPatterns.length !== 0
  || reviewedLaunchDarklyApiVersionRecord.affectedEndpoints.length !== 0
  || reviewedLaunchDarklyApiVersionRecord.affectedResources.length !== 0) {
  throw new Error('LOCAL_REVIEWED_LAUNCHDARKLY_FACTS_INVALID:launchdarkly-api-version-20220603-eol-2025-04-15');
}

/** Explicitly reviewed local records; insertion into an external production store remains separate. */
export const LOCAL_REVIEWED_PRODUCTION_RECORDS = [
  reviewedGpt45Record, reviewedAssistantsRecord, reviewedAnthropicOpusRecord, reviewedAnthropicParameterRecord,
  reviewedGithubOrganizationSecurityRecord, reviewedGithubSynchronousSbomRecord, reviewedTwilioRegionalDomainRecord,
  reviewedTwilioStudioEngagementsRecord, reviewedSupabaseLogsAllRecord, reviewedSupabaseOpenApiAnonKeyRecord,
  reviewedSlackFilesUploadRecord, reviewedShopifyCheckoutApiRecord, reviewedLaunchDarklyApiVersionRecord,
  reviewedAwsCloudWatchEvidentlyRecord, reviewedCloudflareServiceKeyRecord,
  ...BATCH_7_REVIEWED_CANDIDATES.map(({ productionProjection }) => productionProjection),
] as const;
