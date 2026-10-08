import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateCompatibility } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';
import { BATCH_7_REVIEWED_CANDIDATES } from '../packages/providers/src/batch-7-reviewed-candidate-reviews.js';

describe('provider intelligence Batch 7 reviewed projections', () => {
  it('applies all five exact human decisions through reviewCandidate', () => {
    expect(BATCH_7_REVIEWED_CANDIDATES).toHaveLength(5);
    expect(BATCH_7_REVIEWED_CANDIDATES.map(({ reviewedCandidate }) => reviewedCandidate.state)).toEqual([
      'reviewed', 'reviewed', 'reviewed', 'reviewed', 'reviewed',
    ]);
    expect(BATCH_7_REVIEWED_CANDIDATES.map(({ productionProjection }) => productionProjection.changeId)).toEqual([
      'elevenlabs-v1-model-removal-2026-07-09',
      'clerk-api-2026-05-12-metadata-fields-removed',
      'groq-models-decommissioned-2026-09-21',
      'firebase-instance-id-server-apis-decommission-2027-09-29',
      'google-cloud-api-registry-mcp-shutdown-2026-07-30',
    ]);
  });

  it('keeps the canonical candidates and production registry isolated', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    for (const { reviewedCandidate } of BATCH_7_REVIEWED_CANDIDATES) {
      expect(reviewedCandidate.auditTrail.at(-1)?.actor).toBe('Ravi Teja');
      expect(reviewedCandidate.auditTrail.at(-1)?.state).toBe('reviewed');
      expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(reviewedCandidate.payload.changeId ?? reviewedCandidate.candidateId)).toBe(true);
    }
  });

  it('evaluates exact, replacement/unrelated, and unresolved evidence in test-only projections', () => {
    const usage = (overrides: Partial<CompatibilityUsage>): CompatibilityUsage => ({
      id: 'batch-7', providerId: 'unknown', evidenceKind: 'sdk', confidence: 0.99, static: true,
      location: { file: 'fixtures/batch-7.ts', line: 10, column: 1 }, ...overrides,
    });
    const byId = new Map(BATCH_7_REVIEWED_CANDIDATES.map(({ reviewedCandidate, productionProjection }) => [reviewedCandidate.candidateId, productionProjection]));
    const evaluate = (candidateId: string, item: CompatibilityUsage, completeEvidence = true) => {
      const record = byId.get(candidateId)!;
      return evaluateCompatibility({ providerId: item.providerId, usages: [item], completeEvidence }, record, { compatibilityProviders: new Set([record.providerId]), requireOfficialProvenance: true });
    };
    expect(evaluate('elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: 'eleven_monolingual_v1' })).status).toBe('AFFECTED');
    expect(evaluate('elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: 'eleven_multilingual_v2' })).status).toBe('NOT_AFFECTED');
    expect(evaluate('elevenlabs-v1-model-removal-2026-07-09', usage({ providerId: 'elevenlabs', model: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate('clerk-api-2026-05-12-metadata-fields-removed', usage({ providerId: 'clerk', endpoint: '/v1/users/{user_id}', parameter: 'public_metadata' })).status).toBe('AFFECTED');
    expect(evaluate('groq-models-decommissioned-2026-09-21', usage({ providerId: 'groq', model: 'groq/compound-mini' })).status).toBe('AFFECTED');
    expect(evaluate('firebase-instance-id-server-apis-decommission-2027-09-29', usage({ providerId: 'firebase', endpoint: 'https://iid.googleapis.com/iid/info' })).status).toBe('AFFECTED');
    expect(evaluate('google-cloud-api-registry-mcp-shutdown-2026-07-30', usage({ providerId: 'google-cloud', resource: 'API Registry MCP servers and tools' })).status).toBe('AFFECTED');
    expect(evaluate('google-cloud-api-registry-mcp-shutdown-2026-07-30', usage({ providerId: 'google-cloud', resource: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluate('groq-models-decommissioned-2026-09-21', usage({ providerId: 'openai', model: 'groq/compound' })).status).not.toBe('AFFECTED');
    expect(evaluate('firebase-instance-id-server-apis-decommission-2027-09-29', usage({ providerId: 'firebase', endpoint: 'https://iid.googleapis.com/iid/info?lookalike=true' })).status).toBe('NOT_AFFECTED');
  });
});
