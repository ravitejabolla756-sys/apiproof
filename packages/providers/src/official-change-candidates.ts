import { fingerprintCandidateEvidence } from '@apiproof/shared';
import type { CandidateChange, CandidateSourceEvidence } from '@apiproof/shared';
import { compileCandidateChangeRegistry } from './change-ingestion-registry.js';

/**
 * Read-only review queue populated from official sources. These candidates are
 * never compiled into the production compatibility registry.
 *
 * Fingerprints are captured from the complete official response body using
 * the shared canonical URL + NUL + UTF-8 body algorithm.
 */
type CandidateInput = Pick<CandidateChange, 'candidateId' | 'providerId' | 'sourceUrl' | 'sourceType' | 'sourceFingerprint' | 'discoveredAt' | 'payload'> & {
  evidenceNote: string;
  documentFingerprint?: string;
  evidenceFingerprint?: string;
  sourceEvidence?: CandidateSourceEvidence;
};

const SOURCE_TITLES: Readonly<Record<string, string>> = {
  'openai-assistants-api-sunset-2026-08-26': 'Deprecations | OpenAI API',
  'openai-gpt-4-5-preview-removal-2025-07-14': 'Deprecations | OpenAI API',
  'anthropic-claude-opus-4-1-retirement-2026-08-05': 'Model deprecations - Claude Platform Docs',
  'anthropic-opus-4-7-parameter-restrictions': 'Model deprecations - Claude Platform Docs',
  'github-organization-security-fields-removed-2026-04-21': 'Upcoming deprecation of security-related organization API fields',
  'github-synchronous-sbom-endpoint-removal-2026-11-13': 'Synchronous SBOM API deprecated',
  'twilio-regional-api-domain-removal-2026-04-28': 'Deprecation of legacy Twilio API domain patterns',
  'twilio-studio-engagements-endpoint-deprecated': 'REST API v1',
  'supabase-management-logs-all-removal-2026-09-23': 'Supabase Changelog - Breaking Changes',
  'supabase-openapi-anon-key-access-2026-03-11': 'Breaking Change: Removing access to OpenAPI spec via the anon key',
};
const SOURCE_FINGERPRINTS: Readonly<Record<string, string>> = {
  'https://developers.openai.com/api/docs/deprecations': '43a958b451b0eb3578988d263341f8ed4a4a7f260e96d5cd5ed89abaf30ba522',
  'https://docs.anthropic.com/en/docs/about-claude/model-deprecations': '98d1cc99c4ca657931d3d305f7624d78698501de7330c104708e2558e06ff2d8',
  'https://github.blog/changelog/2026-03-24-upcoming-deprecation-of-security-related-organization-api-fields/': '27e97c8b6024587bcd1a3b8254e3f63151b770de5058a11aefa23f8468faeaf3',
  'https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/': '861d60b5a47cb88c45ff4918a7719db1d3b61a241ffa7cf4e0d239f51326090e',
  'https://www.twilio.com/en-us/changelog/deprecation-of-region-specific-twilio-api-domain-patterns': 'c21edcc6438491332e641f4f6706ce98830d191009c326555af7bc728d7719ed',
  'https://www.twilio.com/docs/studio/rest-api': 'e2348b500dee24c1512c8a30d6325c2f8815fd6ec425d63c7e61fccd1a1fc618',
  'https://supabase.com/changelog?types=breaking-change': '7b792a13774b647412b97d3f959d6fad3e6389396634c05a9806a996185e4557',
  'https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key': '94e6b1b426e83af35fff4196e6c3867665e43194dd25a4fd0a53d1d74ab137c5',
};

const UNKNOWN_FIELDS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.keys(SOURCE_TITLES).map((id) => [id, ['SDK package/version applicability is not established by the captured source.', 'Runtime or wrapper behavior is not inferred.']]),
);
const SEVERITY_BASES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(SOURCE_TITLES).map((id) => [id, 'Proposed severity is based only on the source-described removal, shutdown, error response, or access restriction; human review is required.']),
);

const makeCandidate = (input: CandidateInput): CandidateChange => {
  const { evidenceNote, ...candidate } = input;
  const documentFingerprint = candidate.documentFingerprint ?? SOURCE_FINGERPRINTS[candidate.sourceUrl] ?? candidate.sourceFingerprint;
  const evidenceFingerprint = candidate.evidenceFingerprint ?? (candidate.sourceEvidence ? fingerprintCandidateEvidence(candidate.sourceEvidence) : undefined);
  return {
  ...candidate,
  sourceFingerprint: documentFingerprint,
  documentFingerprint,
  ...(candidate.sourceEvidence ? { sourceEvidence: candidate.sourceEvidence } : {}),
  ...(evidenceFingerprint ? { evidenceFingerprint } : {}),
  sourceFingerprintBasis: 'full-body',
  payload: { ...candidate.payload, applicabilityScope: candidate.payload.applicabilityScope ?? (candidate.payload.affectedModels?.length ? { dimensions: ['provider', 'model'] as const } : candidate.payload.affectedEndpoints?.length ? { dimensions: ['provider', 'endpoint'] as const } : { dimensions: ['provider'] as const }), sourceTitle: SOURCE_TITLES[candidate.candidateId], sourceFacts: [candidate.payload.description], unknowns: [...(UNKNOWN_FIELDS[candidate.candidateId] ?? [])], severityBasis: SEVERITY_BASES[candidate.candidateId] },
  state: 'needs_review',
  auditTrail: [
    { state: 'discovered', at: input.discoveredAt, actor: 'official-source-capture', note: evidenceNote },
    { state: 'normalized', at: input.discoveredAt, actor: 'candidate-normalizer', note: 'Normalized only facts stated by the official source; unsupported SDK and version scope remains unknown.' },
    { state: 'needs_review', at: input.discoveredAt, actor: 'candidate-normalizer', note: 'Human review is required before any promotion or compatibility claim.' },
  ],
  };
};

export const OFFICIAL_CHANGE_CANDIDATES: readonly CandidateChange[] = [
  makeCandidate({ candidateId: 'openai-assistants-api-sunset-2026-08-26', providerId: 'openai', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice', sourceFingerprint: '3a387018d47b0a201e3f4da10d302de14fd59d1eedd7c3da8ebed08819d09c77', documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a', discoveredAt: '2026-10-05', evidenceNote: 'Refreshed the official OpenAI deprecations page and extracted the Assistants API evidence section.', sourceEvidence: { providerId: 'openai', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceTitle: 'Deprecations | OpenAI API', sourceLocator: 'section:2025-08-20: Assistants API', claims: [{ key: 'sectionDate', value: '2025-08-20' }, { key: 'notificationDate', value: '2025-08-26' }, { key: 'resource', value: 'Assistants API' }, { key: 'removalAt', value: '2026-08-26' }, { key: 'replacement', value: 'Responses API' }, { key: 'replacement', value: 'Conversations API' }, { key: 'migrationGuide', value: 'Assistants to Conversations' }] }, payload: { changeId: 'openai-assistants-api-sunset-2026-08-26', title: 'OpenAI Assistants API sunset', description: 'OpenAI documents the Assistants API deprecation and removal from the API on 2026-08-26. The source names the Responses API and Conversations API as replacements. The source-specific section date is 2025-08-20 and its notification sentence says August 26, 2025; these dates are preserved separately. The source does not establish an SDK package, SDK operation, version scope, or endpoint path.', changeType: 'endpoint_removed', removalAt: '2026-08-26', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Assistants API'], replacement: { resources: ['Responses API', 'Conversations API'] }, severity: 'high' } }),
  makeCandidate({ candidateId: 'openai-gpt-4-5-preview-removal-2025-07-14', providerId: 'openai', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice', sourceFingerprint: '5512654c236518dd76e7a58586bda5ce14d9b70effdf26e1a8cf0b6523165c6f', discoveredAt: '2026-10-05', evidenceNote: 'Captured the official OpenAI deprecations entry for gpt-4.5-preview.', payload: { changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', title: 'OpenAI gpt-4.5-preview model removal', description: 'OpenAI documents that gpt-4.5-preview was deprecated and removed from the API on 2025-07-14, with gpt-4.1 as the recommended replacement. SDK package and version applicability are not stated.', changeType: 'model_retired', publishedAt: '2025-04-14', removalAt: '2025-07-14', affectedModels: ['gpt-4.5-preview'] } }),
  makeCandidate({ candidateId: 'anthropic-claude-opus-4-1-retirement-2026-08-05', providerId: 'anthropic', sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations', sourceType: 'deprecation-notice', sourceFingerprint: '761c74841eb6b70ed746273dff5dd242c0555f21a2dd6fa84e5c0ff1f30661fe', discoveredAt: '2026-10-05', evidenceNote: 'Captured Anthropic’s official model-deprecations table entry for claude-opus-4-1-20250805.', payload: { changeId: 'anthropic-claude-opus-4-1-retirement-2026-08-05', title: 'Anthropic Claude Opus 4.1 retirement', description: 'Anthropic lists claude-opus-4-1-20250805 as retired, deprecated June 5, 2026, with a tentative retirement date of August 5, 2026. The source lists the replacement model but does not establish an SDK version range.', changeType: 'model_retired', publishedAt: '2026-06-05', removalAt: '2026-08-05', affectedModels: ['claude-opus-4-1-20250805'] } }),
  makeCandidate({ candidateId: 'anthropic-opus-4-7-parameter-restrictions', providerId: 'anthropic', sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations', sourceType: 'deprecation-notice', sourceFingerprint: '32aa9f7fad9f4caa59fc6e14f74ddabbbace010f12ffc2bf053eff3db4fa1495', discoveredAt: '2026-10-05', evidenceNote: 'Captured Anthropic’s official API parameter deprecation section for Claude Opus 4.7 and later.', payload: { changeId: 'anthropic-opus-4-7-parameter-restrictions', title: 'Anthropic Claude Opus 4.7 parameter restrictions', description: 'Anthropic states that temperature, top_p, and top_k are deprecated for Claude Opus 4.7 and later and that non-default values return HTTP 400. SDK package and version applicability are not stated.', changeType: 'parameter_removed', affectedModels: ['claude-opus-4-7'], affectedParameters: ['temperature', 'top_p', 'top_k'], severity: 'high' } }),
  makeCandidate({ candidateId: 'github-organization-security-fields-removed-2026-04-21', providerId: 'github', sourceUrl: 'https://github.blog/changelog/2026-03-24-upcoming-deprecation-of-security-related-organization-api-fields/', sourceType: 'official-changelog', sourceFingerprint: '6fc47ac92835a2a1117f59790a4e16ea03e8d71b4aa2b56a2c8820c11c53766f', discoveredAt: '2026-10-05', evidenceNote: 'Captured GitHub’s official changelog notice listing seven organization REST API fields and their removal date.', payload: { changeId: 'github-organization-security-fields-removed-2026-04-21', title: 'GitHub organization security fields removal', description: 'GitHub states that seven security-related fields are deprecated and removed from get/update organization REST API endpoints on 2026-04-21, with Code Security configurations as the replacement.', changeType: 'response_field_removed', publishedAt: '2026-03-24', removalAt: '2026-04-21', affectedResponseFields: ['advanced_security_enabled_for_new_repositories', 'dependabot_alerts_enabled_for_new_repositories', 'dependabot_security_updates_enabled_for_new_repositories', 'dependency_graph_enabled_for_new_repositories', 'secret_scanning_enabled_for_new_repositories', 'secret_scanning_push_protection_enabled_for_new_repositories', 'secret_scanning_validity_checks_enabled'], severity: 'high' } }),
  makeCandidate({ candidateId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', providerId: 'github', sourceUrl: 'https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/', sourceType: 'official-changelog', sourceFingerprint: 'ed5df24cbd18fa32b063058ffc84b894f1350f8a530961e526fb01fa13b69808', discoveredAt: '2026-10-05', evidenceNote: 'Captured GitHub’s official synchronous SBOM API deprecation notice and replacement endpoint.', payload: { changeId: 'github-synchronous-sbom-endpoint-removal-2026-11-13', title: 'GitHub synchronous SBOM API removal', description: 'GitHub states that the synchronous dependency-graph SBOM endpoint is deprecated and slated for removal on 2026-11-13. The documented replacement is the asynchronous generate-report endpoint.', changeType: 'endpoint_removed', publishedAt: '2026-05-12', removalAt: '2026-11-13', affectedEndpoints: ['/{owner}/{repo}/dependency-graph/sbom'], replacement: { endpoint: '/{owner}/{repo}/dependency-graph/sbom/generate-report' }, severity: 'high' } }),
  makeCandidate({ candidateId: 'twilio-regional-api-domain-removal-2026-04-28', providerId: 'twilio', sourceUrl: 'https://www.twilio.com/en-us/changelog/deprecation-of-region-specific-twilio-api-domain-patterns', sourceType: 'official-changelog', sourceFingerprint: 'd14bdf946ea1f9b8ce027454e8f8516fbb1f41f1f8a3ff34a26fd11d395c2e8a', discoveredAt: '2026-10-05', evidenceNote: 'Captured Twilio’s official API-domain deprecation notice and its April 28, 2026 deadline.', payload: { changeId: 'twilio-regional-api-domain-removal-2026-04-28', title: 'Twilio regional API domain removal', description: 'Twilio states that seven region-specific API domain patterns stop working on 2026-04-28 and directs users to api.twilio.com or documented regional edge domains.', changeType: 'endpoint_removed', removalAt: '2026-04-28', affectedEndpoints: ['api.ie1.twilio.com', 'api.au1.twilio.com', 'api.br1.twilio.com', 'api.de1.twilio.com', 'api.jp1.twilio.com', 'api.sg1.twilio.com', 'api.us2.twilio.com'], replacement: { endpoint: 'api.twilio.com' }, severity: 'high' } }),
  makeCandidate({ candidateId: 'twilio-studio-engagements-endpoint-deprecated', providerId: 'twilio', sourceUrl: 'https://www.twilio.com/docs/studio/rest-api', sourceType: 'official-documentation', sourceFingerprint: '4e69a2e22e3a1c4fe2d4f85f1761d1c87b03466499409350bdca38c609d5a5a0', discoveredAt: '2026-10-05', evidenceNote: 'Captured Twilio’s official Studio REST API documentation describing the deprecated Engagements endpoint and Executions replacement.', payload: { changeId: 'twilio-studio-engagements-endpoint-deprecated', title: 'Twilio Studio Engagements endpoint deprecation', description: 'Twilio states that the beta Engagements endpoint is deprecated and no longer functions; Flow Executions and the Executions endpoint replace it. No exact removal date or SDK version range is stated.', changeType: 'endpoint_removed', affectedEndpoints: ['/Engagements'], replacement: { endpoint: '/Executions' }, severity: 'high' } }),
  makeCandidate({ candidateId: 'supabase-management-logs-all-removal-2026-09-23', providerId: 'supabase', sourceUrl: 'https://supabase.com/changelog?types=breaking-change', sourceType: 'official-changelog', sourceFingerprint: '7fabb795ef946d3933112f0d3fdd5d1849289babd48cfcfa9b70b46e0f540d16', discoveredAt: '2026-10-05', evidenceNote: 'Captured Supabase’s official breaking-change changelog entry for Management API logs.all.', payload: { changeId: 'supabase-management-logs-all-removal-2026-09-23', title: 'Supabase Management API logs.all removal', description: 'Supabase states that the Management API logs.all analytics endpoint is removed on 2026-09-23 and directs scripts to the ClickHouse-backed logs endpoint.', changeType: 'endpoint_removed', removalAt: '2026-09-23', affectedEndpoints: ['logs.all'], replacement: { endpoint: 'logs' }, severity: 'high' } }),
  makeCandidate({ candidateId: 'supabase-openapi-anon-key-access-2026-03-11', providerId: 'supabase', sourceUrl: 'https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key', sourceType: 'official-changelog', sourceFingerprint: '66642c5661fe1269f94e1ab9aa5df61c4e6cc83bdd02fe3e1ce9b70c5ae6d79e', discoveredAt: '2026-10-05', evidenceNote: 'Captured Supabase’s official changelog notice about anon-key access to the Data API OpenAPI endpoint.', payload: { changeId: 'supabase-openapi-anon-key-access-2026-03-11', title: 'Supabase OpenAPI access via anon key', description: 'Supabase states that access to the Data API OpenAPI endpoint via the anon key is deprecated beginning 2026-03-11, while service-role and secret-key access remains available.', changeType: 'parameter_required', effectiveAt: '2026-03-11', affectedEndpoints: ['/rest/v1/'], affectedParameters: ['anon key'], replacement: { parameter: 'secret API key' }, severity: 'high' } }),
];

export const OFFICIAL_CHANGE_CANDIDATE_REGISTRY = compileCandidateChangeRegistry(OFFICIAL_CHANGE_CANDIDATES);
