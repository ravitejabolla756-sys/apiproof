import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateRegisteredCompatibility, evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';

const PARAMETER_RULE = 'anthropic-opus-4-7-parameter-restrictions';
const RETIREMENT_RULE = 'anthropic-claude-opus-4-1-retirement-2026-08-05';
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'production-anthropic-usage', providerId: 'anthropic', model: 'claude-opus-4-7', parameter: 'temperature',
  parameterValueStatus: 'disallowed', evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/anthropic.ts', line: 18, column: 3, symbol: 'client.messages.create' }, ...overrides,
});

describe('Anthropic Opus 4.7 production rule', () => {
  it('has deterministic four-record ordering and two Anthropic records', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
      'auth0-connections-enabled-clients-deprecated-2026-01-21',
      'auth0-enabled-clients-field-deprecation-2026-07-13',
      'auth0-legacy-enabled-clients-management-deprecation-2026-07-13',
      'aws-cloudwatch-evidently-end-of-support-2025-10-16',
      'aws-javascript-sdk-v2-end-of-support-2025-09-08',
      'braintree-drop-in-sdk-deprecated-2026-10-01',
      'braintree-transparent-redirect-deprecation',
      'clerk-api-2026-05-12-metadata-fields-removed',
      'clerk-core-3-after-switch-organization-url-removed',
      'cloudflare-account-roles-api-deprecated-2026-07-21',
      'cloudflare-dns-record-type-update-removal-2026-06-30',
      'cloudflare-foundation-dns-field-removal-2026-11-23',
      'cloudflare-service-key-auth-removal-2026-09-30',
      'cloudflare-service-key-authentication-removed-2026-09-30',
      'cloudflare-workers-kv-legacy-namespace-routes-removed-2026-10-15',
      'cloudflare-workers-kv-legacy-routes-2026-10-15',
      'cloudflare-zone-settings-batch-api-eol-2027-03-31',
      'elevenlabs-legacy-dubbing-endpoints-deprecated',
      'elevenlabs-v1-model-removal-2026-07-09',
      'firebase-instance-id-server-apis-decommission-2027-09-29',
      'firebase-vertexai-import-alias-removed-2025-07-17',
      'firebase-vertexai-symbols-removed-2025-07-17',
      'github-organization-security-fields-removed-2026-04-21',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'google-cloud-api-registry-mcp-operations-removed-2026-07-30',
      'google-cloud-api-registry-mcp-shutdown-2026-07-30',
      'groq-models-decommissioned-2026-09-21',
      'groq-qwen-3-6-27b-retired-2026-09-14',
      'launchdarkly-api-version-20220603-eol-2025-04-15',
      'launchdarkly-api-versions-retired-2026-12-31',
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'openai-gpt-4-series-model-retirement-2027-01-14',
      'sendgrid-v2-mail-send-migration-to-v3',
      'sendgrid-web-api-v2-mail-send-migration',
      'shopify-api-2025-10-version-retired-2026-10-16',
      'shopify-checkout-api-shutdown-2025-04-01',
      'slack-files-upload-removal-2025-11-12',
      'slack-files-upload-retired-2025-03-11',
      'stripe-plans-api-replaced-by-prices',
      'stripe-sources-api-deprecated',
      'stripe-subscription-period-fields-removed-2025-03-31',
      'supabase-management-logs-all-removal-2026-09-23',
      'supabase-openapi-anon-key-access-2026-03-11',
      'twilio-regional-api-domain-removal-2026-04-28',
      'twilio-studio-engagements-endpoint-deprecated',
      'vercel-legacy-integration-webhook-endpoints-removal-2021-08-20',
      'vercel-webhooks-rest-api-removed',
    ]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(3);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(50);
  });

  it('evaluates the actual registry for exact, absent, allowed, unknown, Mythos, unrelated, and dynamic cases', () => {
    const evaluate = (input: CompatibilityUsage, completeEvidence = true) => evaluateRegisteredCompatibility({ providerId: 'anthropic', usages: [input], completeEvidence }, PRODUCTION_COMPATIBILITY_REGISTRY, PARAMETER_RULE);
    expect(evaluate(usage()).status).toBe('AFFECTED');
    expect(evaluate(usage({ id: 'absent', parameter: undefined, parameterValueStatus: undefined })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ id: 'allowed', parameterValueStatus: 'allowed' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ id: 'unknown', parameterValueStatus: 'unknown' })).status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ id: 'mythos', model: 'claude-mythos-preview' })).status).toBe('AFFECTED');
    expect(evaluate(usage({ id: 'unrelated', model: 'claude-sonnet-4-6', parameter: undefined, parameterValueStatus: undefined })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ id: 'possible-later', model: 'claude-opus-4-8' }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ id: 'dynamic-model', model: undefined, static: false, confidence: 0.5 }), false).status).toBe('NEEDS_REVIEW');
  });

  it('keeps the two Anthropic rules isolated without duplicate or cross-matched findings', () => {
    const retirement = evaluateRegisteredCompatibility({ providerId: 'anthropic', usages: [usage({ model: 'claude-opus-4-1-20250805', parameter: undefined, parameterValueStatus: undefined })], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, RETIREMENT_RULE);
    const parameter = evaluateRegisteredCompatibility({ providerId: 'anthropic', usages: [usage()], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, PARAMETER_RULE);
    expect(retirement.status).toBe('AFFECTED');
    expect(parameter.status).toBe('AFFECTED');
    const anthropicChanges = PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic') ?? [];
    expect(new Set(anthropicChanges.map((change) => change.changeId)).size).toBe(anthropicChanges.length);
    expect(anthropicChanges.map((change) => change.changeId)).toEqual([RETIREMENT_RULE, PARAMETER_RULE]);
  });

  it('preserves OpenAI behavior and excludes Anthropic rules from OpenAI normalized evaluation', () => {
    const gpt45 = evaluateRegisteredCompatibility({ providerId: 'openai', usages: [{ ...usage({ id: 'gpt45', providerId: 'openai', model: 'gpt-4.5-preview', parameter: undefined, parameterValueStatus: undefined }) }], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, 'openai-gpt-4-5-preview-removal-2025-07-14');
    const assistants = evaluateRegisteredCompatibility({ providerId: 'openai', usages: [{ ...usage({ id: 'assistants', providerId: 'openai', model: undefined, parameter: undefined, parameterValueStatus: undefined, resource: 'Assistants API' }) }], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, 'openai-assistants-api-sunset-2026-08-26');
    const responses = evaluateRegisteredCompatibility({ providerId: 'openai', usages: [{ ...usage({ id: 'responses', providerId: 'openai', model: undefined, parameter: undefined, parameterValueStatus: undefined, resource: 'Responses API' }) }], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, 'openai-assistants-api-sunset-2026-08-26');
    const openaiResults = evaluateRegisteredNormalizedCompatibility({
      providerId: 'openai',
      usageIR: [normalizeCompatibilityUsage({ ...usage({ id: 'openai-normalized', providerId: 'openai', model: 'gpt-4.1', parameter: undefined, parameterValueStatus: undefined }) }, { language: 'typescript' })],
      completeEvidence: true,
    }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(gpt45.status).toBe('AFFECTED');
    expect(assistants.status).toBe('AFFECTED');
    expect(responses.status).toBe('NOT_AFFECTED');
    expect(openaiResults.every((result) => result.providerId === 'openai')).toBe(true);
  });

  it('exposes the inserted rule and proof fields through the generic proof contract', () => {
    const result = evaluateRegisteredCompatibility({ providerId: 'anthropic', usages: [usage()], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY, PARAMETER_RULE);
    const proofs = buildCompatibilityProofSnapshot({ repositoryId: 'anthropic-production', baselineSha: 'e'.repeat(40), scanId: 'anthropic-production-proof', results: [result] });
    expect(proofs).toHaveLength(1);
    expect(proofs[0]).toMatchObject({ providerId: 'anthropic', changeId: PARAMETER_RULE, status: 'AFFECTED', matchedModel: 'claude-opus-4-7', matchedParameter: 'temperature', matchedParameterValueStatus: 'disallowed', reviewStatus: 'reviewed', provenance: 'official', officialSourceReference: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations' });
    expect(proofs[0]?.proofEvidence.some((evidence) => evidence.kind === 'official-source' && evidence.detail.includes('HTTP 400'))).toBe(true);
  });
});
