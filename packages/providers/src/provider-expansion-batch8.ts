import type { CandidateChange, CandidateReviewAction, CandidateSourceEvidence, ReviewedCompatibilityChange } from '@apiproof/shared';
import { fingerprintCandidate, reviewCandidate } from './candidate-review.js';
import { promoteCandidateToReviewed } from './change-ingestion-registry.js';
import { makeExpansionCandidate } from './expansion-candidate-normalizer.js';

const source = (value: CandidateSourceEvidence): CandidateSourceEvidence => value;

export const PROVIDER_EXPANSION_BATCH8_CANDIDATES: readonly CandidateChange[] = [
  makeExpansionCandidate({
    candidateId: 'stripe-sources-api-deprecated', providerId: 'stripe',
    sourceUrl: 'https://docs.stripe.com/api/versioning', sourceType: 'official-api-reference',
    documentFingerprint: 'e866e66c127c9232b508a4fa7a215f3828b5849ac7840d1e2487b991623b3bb5', discoveredAt: '2026-10-15',
    evidenceNote: 'Captured Stripe’s official API versioning reference and retained the Sources API deprecation and PaymentMethods replacement guidance.',
    evidence: source({ providerId: 'stripe', sourceUrl: 'https://docs.stripe.com/api/versioning', sourceTitle: 'Versioning | Stripe API Reference', sourceLocator: 'section:Sources Deprecated', claims: [
      { key: 'resource', value: 'Source objects and Sources API endpoints' }, { key: 'status', value: 'deprecated' },
      { key: 'replacement', value: 'PaymentMethods API' }, { key: 'affectedEndpoint', value: 'POST /v1/sources' },
      { key: 'affectedEndpoint', value: 'GET /v1/sources/:id' },
    ] }),
    payload: { changeId: 'stripe-sources-api-deprecated', title: 'Stripe Sources API deprecated', description: 'Stripe marks Source objects and the Sources API as deprecated and recommends the PaymentMethods API. This candidate is limited to the documented Sources endpoints and does not assert a removal date, SDK boundary, or impact on unrelated payment APIs.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint', 'resource'] }, affectedEndpoints: ['POST /v1/sources', 'GET /v1/sources/:id', 'POST /v1/customers/:id/sources', 'DELETE /v1/customers/:id/sources/:id'], affectedResources: ['Source objects', 'Sources API'], replacement: { resources: ['PaymentMethods API'] }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'stripe-plans-api-replaced-by-prices', providerId: 'stripe',
    sourceUrl: 'https://docs.stripe.com/api/versioning', sourceType: 'official-api-reference',
    documentFingerprint: 'dcea7d9e797483926f208bee00c085f7b6b5411288bfba473335ef2f098a4e68', discoveredAt: '2026-10-15',
    evidenceNote: 'Captured Stripe’s official API versioning reference and retained the Plans-to-Prices replacement statement and documented Plans endpoints.',
    evidence: source({ providerId: 'stripe', sourceUrl: 'https://docs.stripe.com/api/versioning', sourceTitle: 'Versioning | Stripe API Reference', sourceLocator: 'section:Plans', claims: [
      { key: 'resource', value: 'Plans API' }, { key: 'status', value: 'replaced by Prices API' }, { key: 'replacement', value: 'Prices API' },
      { key: 'affectedEndpoint', value: 'POST /v1/plans' }, { key: 'affectedEndpoint', value: 'GET /v1/plans/:id' },
    ] }),
    payload: { changeId: 'stripe-plans-api-replaced-by-prices', title: 'Stripe Plans API replaced by Prices API', description: 'Stripe states that the Plans API is replaced by the Prices API. This candidate is limited to the documented Plans endpoints and does not assert a removal date, SDK boundary, or impact on unrelated Products or Prices operations.', changeType: 'endpoint_removed', applicabilityScope: { dimensions: ['provider', 'endpoint', 'resource'] }, affectedEndpoints: ['POST /v1/plans', 'GET /v1/plans/:id', 'DELETE /v1/plans/:id'], affectedResources: ['Plans API'], replacement: { resources: ['Prices API', 'Products API'] }, severity: 'medium' },
  }),
  makeExpansionCandidate({
    candidateId: 'slack-files-upload-removal-2025-11-12', providerId: 'slack',
    sourceUrl: 'https://api.slack.com/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay', sourceType: 'deprecation-notice',
    documentFingerprint: '24840b8e5e4d093c41b747ba459cfb13444201061a6b1f3040df75da433cdd5f', discoveredAt: '2026-10-08',
    evidenceNote: 'Captured the official Slack changelog article; its revised source states that files.upload sunset on November 12, 2025 and names the sequenced replacement methods.',
    evidence: source({ providerId: 'slack', sourceUrl: 'https://api.slack.com/changelog/2024-04-a-better-way-to-upload-files-is-here-to-stay', sourceTitle: 'The files.upload method is retiring, to be replaced by sequenced Web API methods', sourceLocator: 'section:When does this happen?', claims: [
      { key: 'operation', value: 'files.upload' }, { key: 'removalAt', value: '2025-11-12' }, { key: 'status', value: 'sunset and no longer accessible' },
      { key: 'replacement', value: 'files.getUploadURLExternal and files.completeUploadExternal' },
    ] }),
    payload: { changeId: 'slack-files-upload-removal-2025-11-12', title: 'Slack files.upload retirement', description: 'Slack documents that files.upload sunsets on November 12, 2025 and directs applications to files.getUploadURLExternal followed by files.completeUploadExternal.', changeType: 'endpoint_removed', removalAt: '2025-11-12', applicabilityScope: { dimensions: ['provider', 'operation'] }, apiOperationPatterns: ['files.upload'], replacement: { operation: 'files.getUploadURLExternal and files.completeUploadExternal' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'openai-gpt-4-series-model-retirement-2027-01-14', providerId: 'openai',
    sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice',
    documentFingerprint: '79b57b628df0d4ebd86c35ec97c32b65915695ec332bc4afd0c31973abf9cb84', discoveredAt: '2026-10-15',
    evidenceNote: 'Captured OpenAI’s official deprecations entry for GPT-4 series model snapshots scheduled for API removal on January 14, 2027.',
    evidence: source({ providerId: 'openai', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceTitle: 'Deprecations | OpenAI API', sourceLocator: 'section:2026-10-14: GPT-4 series model deprecations', claims: [
      { key: 'notificationDate', value: '2026-10-14' }, { key: 'removalAt', value: '2027-01-14' }, { key: 'model', value: 'gpt-4o-2024-08-06' },
      { key: 'model', value: 'gpt-4o-2024-11-20' }, { key: 'model', value: 'gpt-4o-mini-2024-07-18' }, { key: 'model', value: 'gpt-4.1-2025-04-14' },
      { key: 'replacement', value: 'gpt-6-luna' },
    ] }),
    payload: { changeId: 'openai-gpt-4-series-model-retirement-2027-01-14', title: 'OpenAI GPT-4 series model retirement', description: 'OpenAI documents removal of four named GPT-4 model snapshots on January 14, 2027 and lists gpt-6-luna as the recommended replacement. This candidate does not assert SDK, package, alias, or fine-tuned-model applicability.', changeType: 'model_retired', removalAt: '2027-01-14', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedModels: ['gpt-4o-2024-08-06', 'gpt-4o-2024-11-20', 'gpt-4o-mini-2024-07-18', 'gpt-4.1-2025-04-14'], replacement: { model: 'gpt-6-luna' }, severity: 'high' },
  }),
  makeExpansionCandidate({
    candidateId: 'cloudflare-service-key-auth-removal-2026-09-30', providerId: 'cloudflare',
    sourceUrl: 'https://developers.cloudflare.com/fundamentals/api/reference/deprecations/', sourceType: 'deprecation-notice',
    documentFingerprint: 'd42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9', discoveredAt: '2026-10-08',
    evidenceNote: 'Re-fetched the official Cloudflare API deprecations page; the candidate-specific Service Key evidence is unchanged.',
    evidence: source({ providerId: 'cloudflare', sourceUrl: 'https://developers.cloudflare.com/fundamentals/api/reference/deprecations/', sourceTitle: 'API deprecations', sourceLocator: 'section:Service Key Authentication', claims: [
      { key: 'removalAt', value: '2026-09-30' }, { key: 'auth', value: 'X-Auth-User-Service-Key' }, { key: 'replacement', value: 'API Token' },
    ] }),
    payload: { changeId: 'cloudflare-service-key-auth-removal-2026-09-30', title: 'Cloudflare Service Key authentication removal', description: 'Cloudflare documents removal of Service Key authentication and replacement with scoped API Tokens.', changeType: 'parameter_removed', removalAt: '2026-09-30', applicabilityScope: { dimensions: ['provider', 'auth_or_header', 'resource'] }, authOrHeaderPatterns: ['X-Auth-User-Service-Key'], affectedResources: ['Cloudflare API'], replacement: { authOrHeader: 'API Token' }, severity: 'high' },
  }),
] as const;

const reviewAndPromote = (candidate: CandidateChange, notes: string): ReviewedCompatibilityChange => {
  const action: CandidateReviewAction = {
    decision: 'approve-for-promotion-review', reviewer: 'Ravi Teja', reviewedAt: '2026-10-29', notes,
    sourceFingerprint: candidate.documentFingerprint ?? candidate.sourceFingerprint,
    evidenceFingerprint: candidate.evidenceFingerprint,
    candidateFingerprint: fingerprintCandidate(candidate),
  };
  const reviewedCandidate = reviewCandidate(candidate, action);
  return promoteCandidateToReviewed(reviewedCandidate, {
    status: 'reviewed', reviewer: action.reviewer, reviewerKind: 'human', reviewedAt: action.reviewedAt, notes: action.notes,
    documentFingerprint: action.sourceFingerprint, evidenceFingerprint: action.evidenceFingerprint, candidateFingerprint: action.candidateFingerprint,
  }, [{ url: candidate.sourceUrl, summary: `Official ${candidate.providerId} source reviewed for the bounded documented change; no SDK or wrapper scope is inferred.`, accessedAt: action.reviewedAt }]);
};

const candidateAt = (index: number): CandidateChange => {
  const candidate = PROVIDER_EXPANSION_BATCH8_CANDIDATES[index];
  if (!candidate) throw new Error(`BATCH8_CANDIDATE_MISSING:${index}`);
  return candidate;
};

export const PROVIDER_EXPANSION_BATCH8_REVIEWED_RECORDS = [
  reviewAndPromote(candidateAt(0), 'I verified the official Stripe versioning reference and approve only the documented Sources API boundary and PaymentMethods replacement.'),
  reviewAndPromote(candidateAt(1), 'I verified the official Stripe versioning reference and approve only the documented Plans-to-Prices replacement boundary.'),
  reviewAndPromote(candidateAt(2), 'I verified the official Slack changelog and approve only the files.upload retirement and documented replacement sequence.'),
  reviewAndPromote(candidateAt(3), 'I verified the official OpenAI deprecations entry and approve only the four named model snapshots and stated removal date.'),
  reviewAndPromote(candidateAt(4), 'I verified the official Cloudflare deprecations entry and approve only the documented Service Key header boundary.'),
] as const;
