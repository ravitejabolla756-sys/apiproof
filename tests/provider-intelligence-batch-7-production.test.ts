import { describe, expect, it } from 'vitest';
import { evaluateRegisteredCompatibility } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { CompatibilityUsage } from '@apiproof/shared';

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'batch-7-production', providerId: 'unknown', evidenceKind: 'sdk', confidence: 0.99, static: true,
  location: { file: 'fixtures/batch-7-production.ts', line: 10, column: 1 }, ...overrides,
});

const evaluate = (providerId: string, changeId: string, item: CompatibilityUsage, completeEvidence = true) => evaluateRegisteredCompatibility(
  { providerId, usages: [item], completeEvidence }, PRODUCTION_COMPATIBILITY_REGISTRY, changeId,
);

describe('Batch 7 actual production registry', () => {
  it('contains exactly the five inserted rules with deterministic isolation', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('elevenlabs')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('clerk')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('groq')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('firebase')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('google-cloud')).toHaveLength(1);
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).size).toBe(20);
  });

  it('evaluates ElevenLabs, Groq, Firebase, and Google Cloud exact identities', () => {
    expect(evaluate('elevenlabs', 'elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: 'eleven_monolingual_v1' })).status).toBe('AFFECTED');
    expect(evaluate('elevenlabs', 'elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: 'eleven_multilingual_v2' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('elevenlabs', 'elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate('groq', 'groq-models-decommissioned-2026-09-21', usage({ providerId: 'groq', model: 'groq/compound-mini' })).status).toBe('AFFECTED');
    expect(evaluate('groq', 'groq-models-decommissioned-2026-09-21', usage({ providerId: 'groq', model: 'llama-3.3-70b-versatile' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('firebase', 'firebase-instance-id-server-apis-decommission-2027-09-29', usage({ providerId: 'firebase', endpoint: 'https://iid.googleapis.com/iid/info' })).status).toBe('AFFECTED');
    expect(evaluate('firebase', 'firebase-instance-id-server-apis-decommission-2027-09-29', usage({ providerId: 'firebase', endpoint: 'https://fcm.googleapis.com/v1/projects/x/messages:send' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('google-cloud', 'google-cloud-api-registry-mcp-shutdown-2026-07-30', usage({ providerId: 'google-cloud', resource: 'API Registry MCP servers and tools' })).status).toBe('AFFECTED');
    expect(evaluate('google-cloud', 'google-cloud-api-registry-mcp-shutdown-2026-07-30', usage({ providerId: 'google-cloud', resource: 'Agent Registry' })).status).toBe('NOT_AFFECTED');
  });

  it('evaluates Clerk exact endpoint/parameter conjunction and fail-closed evidence', () => {
    expect(evaluate('clerk', 'clerk-api-2026-05-12-metadata-fields-removed', usage({ providerId: 'clerk', endpoint: '/v1/users/{user_id}', parameter: 'public_metadata' })).status).toBe('AFFECTED');
    expect(evaluate('clerk', 'clerk-api-2026-05-12-metadata-fields-removed', usage({ providerId: 'clerk', endpoint: '/v1/users/{user_id}', parameter: 'email_address' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('clerk', 'clerk-api-2026-05-12-metadata-fields-removed', usage({ providerId: 'clerk', endpoint: undefined, parameter: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate('clerk', 'clerk-api-2026-05-12-metadata-fields-removed', usage({ providerId: 'openai', endpoint: '/v1/users/{user_id}', parameter: 'public_metadata' })).status).not.toBe('AFFECTED');
  });
});
