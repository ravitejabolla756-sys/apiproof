import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { LOCAL_REVIEWED_PRODUCTION_RECORDS, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';

const record = LOCAL_REVIEWED_PRODUCTION_RECORDS[0]!;
const usage = (id: string, providerId: string, model: string | undefined, staticEvidence: boolean) => normalizeCompatibilityUsage({
  id, providerId, model, evidenceKind: 'sdk', confidence: staticEvidence ? 0.99 : 0.4, static: staticEvidence,
  location: { file: 'fixtures/openai-model.ts', line: staticEvidence ? 12 : 18, column: 1, symbol: 'model' },
}, { language: 'typescript', versionConfidence: 'unknown', versionSource: 'unknown' });

describe('local OpenAI production-promotion proof', () => {
  it('contains exactly the reviewed provider/model record with generic high severity', () => {
    expect(record).toMatchObject({
      providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', removalAt: '2025-07-14',
      affectedModels: ['gpt-4.5-preview'], replacement: { model: 'gpt-4.1' }, severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'model'] }, review: { status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-05', provenance: 'official' },
    });
    expect(record.affectedPackages).toBeUndefined();
    expect(record.affectedVersionRange).toBeUndefined();
    expect(record.apiOperationPatterns).toEqual([]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(1);
  });

  it.each([
    ['affected', 'openai', 'gpt-4.5-preview', true, 'AFFECTED'],
    ['unaffected', 'openai', 'gpt-4.1', true, 'NOT_AFFECTED'],
    ['dynamic', 'openai', undefined, false, 'NEEDS_REVIEW'],
    ['unrelated-model', 'openai', 'gpt-4o', true, 'NOT_AFFECTED'],
    ['unrelated-provider', 'anthropic', 'gpt-4.5-preview', true, 'NEEDS_REVIEW'],
  ] as const)('evaluates %s with no cross-scope claim', (id, providerId, model, staticEvidence, expected) => {
    const result = evaluateRegisteredNormalizedCompatibility({ providerId, usageIR: [usage(id, providerId, model, staticEvidence)], completeEvidence: !staticEvidence ? false : true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(result).toHaveLength(providerId === 'openai' ? 1 : 0);
    if (result[0]) expect(result[0].status).toBe(expected);
  });

  it('binds each compatibility result to a proof snapshot', () => {
    for (const [id, model, expected] of [['affected', 'gpt-4.5-preview', 'AFFECTED'], ['unaffected', 'gpt-4.1', 'NOT_AFFECTED'], ['dynamic', undefined, 'NEEDS_REVIEW'] ] as const) {
      const result = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [usage(id, 'openai', model, id !== 'dynamic')], completeEvidence: id !== 'dynamic' }, PRODUCTION_COMPATIBILITY_REGISTRY);
      const [proof] = buildCompatibilityProofSnapshot({ repositoryId: 'local-openai-production', baselineSha: 'd'.repeat(40), scanId: `proof-${id}`, results: result, mode: 'test' });
      expect(proof?.status).toBe(expected);
    }
  });
});
