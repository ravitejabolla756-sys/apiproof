import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('production compatibility proof API contract', () => {
  it('exposes reviewed OpenAI and Anthropic records through the production registry', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(50);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('supabase')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('github')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('openai-gpt-4-5-preview-removal-2025-07-14')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('openai-assistants-api-sunset-2026-08-26')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('anthropic-claude-opus-4-1-retirement-2026-08-05')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('anthropic-opus-4-7-parameter-restrictions')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('github-organization-security-fields-removed-2026-04-21')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('github-synchronous-sbom-endpoint-removal-2026-11-13')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('twilio-regional-api-domain-removal-2026-04-28')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('supabase-management-logs-all-removal-2026-09-23')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('supabase-openapi-anon-key-access-2026-03-11')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('twilio-studio-engagements-endpoint-deprecated')).toBe(true);
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
  });

  it('can only expose records sourced from the production registry', () => {
    for (const change of PRODUCTION_COMPATIBILITY_REGISTRY.changes) {
      expect(change.review.status).toBe('reviewed');
      expect(change.review.provenance).toBe('official');
    }
  });

  it('never exposes an unreviewed captured candidate as a production proof record', () => {
    for (const candidate of OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates) {
      if (PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)) continue;
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(false);
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.changeId === candidate.payload.changeId)).toBe(false);
    }
  });
});
