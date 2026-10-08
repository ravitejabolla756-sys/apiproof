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

const GITHUB_SYNCHRONOUS_SBOM_CANDIDATE_ID = 'github-synchronous-sbom-endpoint-removal-2026-11-13';
const githubSynchronousSbomCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(GITHUB_SYNCHRONOUS_SBOM_CANDIDATE_ID);
if (!githubSynchronousSbomCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${GITHUB_SYNCHRONOUS_SBOM_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official GitHub changelog for synchronous SBOM API removal. I approve authoritative applicability at provider + endpoint scope for /{owner}/{repo}/dependency-graph/sbom only. The documented replacement is /{owner}/{repo}/dependency-graph/sbom/generate-report using asynchronous report generation. I do not assert an Octokit package, package version, SDK method, GraphQL applicability, or API-version scope.',
  sourceFingerprint: 'f509f8d68a1bd919c655c0d367a998f233829c53a5c4e7431cd9b45bea1d16f0',
  evidenceFingerprint: '4fa080a36ae032f8b589028bbc74233d8aa43a6a1625bc2037d85f9b1cd5f81f',
  candidateFingerprint: 'd88ec47a8f030ce6f4e318c70ddc6880ee310ac8c6c107ee8e5af06c94680bec',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_CANDIDATE = reviewCandidate(githubSynchronousSbomCandidate, LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION);

export const LOCAL_REVIEWED_GITHUB_SYNCHRONOUS_SBOM_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_GITHUB_SYNCHRONOUS_SBOM_REVIEW_ACTION.candidateFingerprint,
});

const TWILIO_REGIONAL_DOMAIN_CANDIDATE_ID = 'twilio-regional-api-domain-removal-2026-04-28';
const twilioRegionalDomainCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(TWILIO_REGIONAL_DOMAIN_CANDIDATE_ID);
if (!twilioRegionalDomainCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${TWILIO_REGIONAL_DOMAIN_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official Twilio changelog and migration guide. I approve provider + domain applicability for the seven exact deprecated regional API hosts. The replacement is api.twilio.com. I do not assert SDK package, SDK version, SDK constructor, SDK method, or broader wildcard hostname applicability.',
  sourceFingerprint: 'c21edcc6438491332e641f4f6706ce98830d191009c326555af7bc728d7719ed',
  evidenceFingerprint: 'd6219d4929018c959dbd916b38773325cc8ce3a709f7ddb8d68dc5a3e838e3d6',
  candidateFingerprint: '6646a65d4ac5bd2ed3f549013766ed95beedd5bfc4c7b5c78ab0c4a117bb0143',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_CANDIDATE = reviewCandidate(twilioRegionalDomainCandidate, LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION);

export const LOCAL_REVIEWED_TWILIO_REGIONAL_DOMAIN_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_TWILIO_REGIONAL_DOMAIN_REVIEW_ACTION.candidateFingerprint,
});

const SUPABASE_LOGS_ALL_CANDIDATE_ID = 'supabase-management-logs-all-removal-2026-09-23';
const supabaseLogsAllCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(SUPABASE_LOGS_ALL_CANDIDATE_ID);
if (!supabaseLogsAllCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${SUPABASE_LOGS_ALL_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official Supabase changelog for removal of the Management API analytics/endpoints/logs.all operation. I approve authoritative applicability at provider + endpoint scope for logs.all only. The documented replacement is analytics/endpoints/logs and requires ClickHouse SQL. I do not assert SDK package, SDK version, SDK method, or undocumented endpoint variants.',
  sourceFingerprint: '1cd6ddf38800302ff4df662b1dc5cab8dd171a848647ad223150efc0a2fc29c8',
  evidenceFingerprint: 'b6f56792e51270c86280e4a8b5e619d1f871b9dc91ea0cd86379c971a2de9f23',
  candidateFingerprint: '39f2f68655b0713137fe5ce81101af481fd2914c78c698752e042e88466fbd4e',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_SUPABASE_LOGS_ALL_CANDIDATE = reviewCandidate(supabaseLogsAllCandidate, LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION);

export const LOCAL_REVIEWED_SUPABASE_LOGS_ALL_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_SUPABASE_LOGS_ALL_REVIEW_ACTION.candidateFingerprint,
});

const SUPABASE_OPENAPI_ANON_KEY_CANDIDATE_ID = 'supabase-openapi-anon-key-access-2026-03-11';
const supabaseOpenApiAnonKeyCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(SUPABASE_OPENAPI_ANON_KEY_CANDIDATE_ID);
if (!supabaseOpenApiAnonKeyCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${SUPABASE_OPENAPI_ANON_KEY_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official Supabase changelog for removal of OpenAPI access using the anon key. I approve authoritative applicability at provider + endpoint + auth_or_header scope for OpenAPI access at /rest/v1/ when the credential class is anon key. Service-role and new secret API keys remain allowed. I do not assert SDK package, SDK version, SDK method, or an undocumented literal header representation.',
  sourceFingerprint: 'f8cc1c82fdef5b686930280bd95860dc7413c45a5e6d1db8edf2744a8c110f96',
  evidenceFingerprint: 'e162ea328b8db825a739fce6174efaa03637d86ef408ea81a173988886b7ff6c',
  candidateFingerprint: '33b4ebe9cdfef34571301ccfb2cd4e764fd0fe28564260c5066a8661dec2cfa5',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_CANDIDATE = reviewCandidate(supabaseOpenApiAnonKeyCandidate, LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION);

export const LOCAL_REVIEWED_SUPABASE_OPENAPI_ANON_KEY_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_SUPABASE_OPENAPI_ANON_KEY_REVIEW_ACTION.candidateFingerprint,
});

const TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE_ID = 'twilio-studio-engagements-endpoint-deprecated';
const twilioStudioEngagementsCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE_ID);
if (!twilioStudioEngagementsCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official Twilio Studio REST API documentation. I approve authoritative applicability for the deprecated/nonfunctional Engagements resource and the documented Executions replacement. I do not assert a removal date, publication date, SDK package, SDK version, SDK method, or other metadata that Twilio does not explicitly establish.',
  sourceFingerprint: '05d8a88476bf4182c9569e42b96932d9c0036294d6da28426d28c6c0451d7a80',
  evidenceFingerprint: '0501efa9e9427c234e8450893c1208645f90f7fa35a6475635fb9a9196835ad6',
  candidateFingerprint: '699aabd98ad389d1ff0a39b8a4bfac0df78dbaf544850c96697dd88cf7abc1e7',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_CANDIDATE = reviewCandidate(twilioStudioEngagementsCandidate, LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION);

export const LOCAL_REVIEWED_TWILIO_STUDIO_ENGAGEMENTS_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_TWILIO_STUDIO_ENGAGEMENTS_REVIEW_ACTION.candidateFingerprint,
});

const SLACK_FILES_UPLOAD_CANDIDATE_ID = 'slack-files-upload-removal-2025-11-12';
const slackFilesUploadCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(SLACK_FILES_UPLOAD_CANDIDATE_ID);
if (!slackFilesUploadCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${SLACK_FILES_UPLOAD_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: 'I verified the official Slack changelog for the retirement of files.upload. I verified that files.upload is retired on 2025-11-12 and that Slack directs developers to the sequenced files.getUploadURLExternal followed by files.completeUploadExternal upload flow. I approve authoritative applicability at provider + operation scope only. I do not assert any SDK package, SDK version range, SDK-specific method mapping, endpoint path, model alias, or dynamically constructed operation.',
  sourceFingerprint: '24840b8e5e4d093c41b747ba459cfb13444201061a6b1f3040df75da433cdd5f',
  evidenceFingerprint: '7bcaa779622bea78c632c52a2296c7c41bd7aa373887a784866743e501f3b6e9',
  candidateFingerprint: '2d53d350d578f37984e7a579512ecc9ea9512fdc006733000cd05e7ff2883372',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_SLACK_FILES_UPLOAD_CANDIDATE = reviewCandidate(slackFilesUploadCandidate, LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION);

export const LOCAL_REVIEWED_SLACK_FILES_UPLOAD_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_SLACK_FILES_UPLOAD_REVIEW_ACTION.candidateFingerprint,
});

const SHOPIFY_CHECKOUT_API_CANDIDATE_ID = 'shopify-checkout-api-shutdown-2025-04-01';
const shopifyCheckoutApiCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(SHOPIFY_CHECKOUT_API_CANDIDATE_ID);
if (!shopifyCheckoutApiCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${SHOPIFY_CHECKOUT_API_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: 'I verified Shopify\'s official changelog for the shutdown of the Storefront Checkout mutations and REST Checkout endpoints on 2025-04-01. I verified the Storefront Cart API replacement and Checkout Sheet Kit guidance for mobile apps. I approve authoritative applicability at provider + resource scope for Storefront Checkout mutations and REST Checkout endpoints only. The source explicitly states this is unrelated to the checkout.liquid to Checkout Extensibility migration. I do not assert any npm package, package version, SDK method, endpoint path, GraphQL operation, checkout.liquid applicability, or unrelated Storefront/Admin API applicability.',
  sourceFingerprint: '1f9fd1ff6fef62f1aeb3f77937865de9fab30c9051697ca2f68606cf16512379',
  evidenceFingerprint: 'a00b491e6be2deda68588c345fb28ceecfe5f3dfa612fcdc0428439529d4eb10',
  candidateFingerprint: '07edb79c844497651422e941eac1d62e269ee26ac466bcb48bd8336b1fe0cf0b',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE = reviewCandidate(shopifyCheckoutApiCandidate, LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION);

export const LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_SHOPIFY_CHECKOUT_API_REVIEW_ACTION.candidateFingerprint,
});

const LAUNCHDARKLY_API_VERSION_CANDIDATE_ID = 'launchdarkly-api-version-20220603-eol-2025-04-15';
const launchDarklyApiVersionCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(LAUNCHDARKLY_API_VERSION_CANDIDATE_ID);
if (!launchDarklyApiVersionCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${LAUNCHDARKLY_API_VERSION_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: 'I verified LaunchDarkly\'s official REST API version changelog. API version 20220603 is marked EOL on 2025-04-15, and 20240415 is identified as the current version. I approve authoritative applicability at provider + api_version scope only. I do not assert any SDK package, SDK version, SDK method, endpoint-specific applicability, client-library behavior, or undocumented API version. The previously rejected broad claim that all API versions except 20240415 retire on 2026-12-31 is not part of this review.',
  sourceFingerprint: 'e7fc7da9aee943cb863b3f7dd995d452f8862a1373f0af3967cd3b3f23e55fda',
  evidenceFingerprint: 'ef593fa2ae35eac21cabdc1e418361b7cfd7ba58c33f705399d885554346257d',
  candidateFingerprint: '663aab621a5cfb1f53ec1b258499d41744f9c70308a1ee1b22c4a2e04108fdce',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_CANDIDATE = reviewCandidate(launchDarklyApiVersionCandidate, LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION);

export const LOCAL_REVIEWED_LAUNCHDARKLY_API_VERSION_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_LAUNCHDARKLY_API_VERSION_REVIEW_ACTION.candidateFingerprint,
});

const AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE_ID = 'aws-cloudwatch-evidently-end-of-support-2025-10-16';
const awsCloudWatchEvidentlyCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE_ID);
if (!awsCloudWatchEvidentlyCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: "I verified AWS's official CloudWatch document history notice that support for Amazon CloudWatch Evidently ends on 2025-10-16 and that the console and Evidently resources become unavailable after end of support. I approve provider + resource applicability for Amazon CloudWatch Evidently only. I do not assert a replacement service, SDK package, SDK version, or SDK operation.",
  sourceFingerprint: 'd9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9',
  evidenceFingerprint: '3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c',
  candidateFingerprint: 'b5d9edc8aa05ef59598bfe100656a3fe151af9c1b2f8111ddbf5e24f6b3c6d0d',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_CANDIDATE = reviewCandidate(awsCloudWatchEvidentlyCandidate, LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION);

export const LOCAL_REVIEWED_AWS_CLOUDWATCH_EVIDENTLY_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_AWS_CLOUDWATCH_EVIDENTLY_REVIEW_ACTION.candidateFingerprint,
});

const CLOUDFLARE_SERVICE_KEY_CANDIDATE_ID = 'cloudflare-service-key-auth-removal-2026-09-30';
const cloudflareServiceKeyCandidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CLOUDFLARE_SERVICE_KEY_CANDIDATE_ID);
if (!cloudflareServiceKeyCandidate) throw new Error(`LOCAL_REVIEWED_CANDIDATE_MISSING:${CLOUDFLARE_SERVICE_KEY_CANDIDATE_ID}`);

/** Explicit user-supplied local review; production insertion remains a separate registry step. */
export const LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION = {
  decision: 'approve-for-promotion-review',
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: "I verified Cloudflare's official API deprecation notice for removal of X-Auth-User-Service-Key on 2026-09-30 and the API Token replacement. I approve provider + auth_or_header applicability only for that exact header mechanism. I do not assert any endpoint, SDK package, SDK version, SDK method, or broader authentication behavior.",
  sourceFingerprint: 'd42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9',
  evidenceFingerprint: '9abd5f0455c3333c23638475e04813a8d20c21c153d5c85e7ab9abc300348ca8',
  candidateFingerprint: 'e2d017c98bbd004f9101346c6f604102adc558cc468467ebf57dd92ae3f2abfb',
} as const satisfies CandidateReviewAction;

export const LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_CANDIDATE = reviewCandidate(cloudflareServiceKeyCandidate, LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION);

export const LOCAL_REVIEWED_CLOUDFLARE_SERVICE_KEY_REVIEW = CandidateReviewSchema.parse({
  status: 'reviewed',
  reviewer: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.reviewer,
  reviewerKind: 'human',
  reviewedAt: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.reviewedAt,
  notes: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.notes,
  documentFingerprint: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.sourceFingerprint,
  evidenceFingerprint: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.evidenceFingerprint,
  candidateFingerprint: LOCAL_CLOUDFLARE_SERVICE_KEY_REVIEW_ACTION.candidateFingerprint,
});
