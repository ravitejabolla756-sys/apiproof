import { describe, expect, it } from 'vitest';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('production compatibility proof API contract', () => {
  it('exposes reviewed OpenAI and Anthropic records through the production registry', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
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
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('slack-files-upload-removal-2025-11-12')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('shopify-checkout-api-shutdown-2025-04-01')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('launchdarkly-api-version-20220603-eol-2025-04-15')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has('aws-cloudwatch-evidently-end-of-support-2025-10-16')).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).toEqual([
      'anthropic-claude-opus-4-1-retirement-2026-08-05',
      'anthropic-opus-4-7-parameter-restrictions',
      'aws-cloudwatch-evidently-end-of-support-2025-10-16',
      'clerk-api-2026-05-12-metadata-fields-removed',
      'cloudflare-service-key-auth-removal-2026-09-30',
      'elevenlabs-v1-model-removal-2026-07-09',
      'firebase-instance-id-server-apis-decommission-2027-09-29',
      'github-organization-security-fields-removed-2026-04-21',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'google-cloud-api-registry-mcp-shutdown-2026-07-30',
      'groq-models-decommissioned-2026-09-21',
      'launchdarkly-api-version-20220603-eol-2025-04-15',
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'shopify-checkout-api-shutdown-2025-04-01',
      'slack-files-upload-removal-2025-11-12',
      'supabase-management-logs-all-removal-2026-09-23',
      'supabase-openapi-anon-key-access-2026-03-11',
      'twilio-regional-api-domain-removal-2026-04-28',
      'twilio-studio-engagements-endpoint-deprecated',
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
      if (candidate.candidateId === 'slack-files-upload-removal-2025-11-12' || candidate.candidateId === 'shopify-checkout-api-shutdown-2025-04-01') continue;
      if (candidate.candidateId === 'openai-gpt-4-5-preview-removal-2025-07-14' || candidate.candidateId === 'openai-assistants-api-sunset-2026-08-26' || candidate.candidateId === 'anthropic-claude-opus-4-1-retirement-2026-08-05' || candidate.candidateId === 'anthropic-opus-4-7-parameter-restrictions' || candidate.candidateId === 'github-organization-security-fields-removed-2026-04-21' || candidate.candidateId === 'github-synchronous-sbom-endpoint-removal-2026-11-13' || candidate.candidateId === 'launchdarkly-api-version-20220603-eol-2025-04-15' || candidate.candidateId === 'twilio-regional-api-domain-removal-2026-04-28' || candidate.candidateId === 'twilio-studio-engagements-endpoint-deprecated' || candidate.candidateId === 'supabase-management-logs-all-removal-2026-09-23' || candidate.candidateId === 'supabase-openapi-anon-key-access-2026-03-11' || candidate.candidateId === 'aws-cloudwatch-evidently-end-of-support-2025-10-16' || candidate.candidateId === 'cloudflare-service-key-auth-removal-2026-09-30' || candidate.candidateId === 'elevenlabs-v1-model-removal-2026-07-09' || candidate.candidateId === 'clerk-api-2026-05-12-metadata-fields-removed' || candidate.candidateId === 'groq-models-decommissioned-2026-09-21' || candidate.candidateId === 'firebase-instance-id-server-apis-decommission-2027-09-29' || candidate.candidateId === 'google-cloud-api-registry-mcp-shutdown-2026-07-30') continue;
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(false);
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.some((change) => change.changeId === candidate.payload.changeId)).toBe(false);
    }
  });
});
