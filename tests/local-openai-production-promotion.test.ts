import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { LOCAL_REVIEWED_PRODUCTION_RECORDS, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';

const modelRecord = LOCAL_REVIEWED_PRODUCTION_RECORDS.find((item) => item.changeId === 'openai-gpt-4-5-preview-removal-2025-07-14')!;
const assistantsRecord = LOCAL_REVIEWED_PRODUCTION_RECORDS.find((item) => item.changeId === 'openai-assistants-api-sunset-2026-08-26')!;
const usage = (id: string, providerId: string, model: string | undefined, staticEvidence: boolean) => normalizeCompatibilityUsage({
  id, providerId, model, evidenceKind: 'sdk', confidence: staticEvidence ? 0.99 : 0.4, static: staticEvidence,
  location: { file: 'fixtures/openai-model.ts', line: staticEvidence ? 12 : 18, column: 1, symbol: 'model' },
}, { language: 'typescript', versionConfidence: 'unknown', versionSource: 'unknown' });

describe('local OpenAI production-promotion proof', () => {
  it('contains exactly the reviewed provider/model record with generic high severity', () => {
    expect(modelRecord).toMatchObject({
      providerId: 'openai', changeId: 'openai-gpt-4-5-preview-removal-2025-07-14', removalAt: '2025-07-14',
      affectedModels: ['gpt-4.5-preview'], replacement: { model: 'gpt-4.1' }, severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'model'] }, review: { status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-05', provenance: 'official' },
    });
    expect(modelRecord.affectedPackages).toBeUndefined();
    expect(modelRecord.affectedVersionRange).toBeUndefined();
    expect(modelRecord.apiOperationPatterns).toEqual([]);
  });

  it('contains the separately reviewed resource-scoped Assistants rule without SDK scope', () => {
    expect(assistantsRecord).toMatchObject({
      providerId: 'openai', changeId: 'openai-assistants-api-sunset-2026-08-26', removalAt: '2026-08-26',
      affectedResources: ['Assistants API'], replacement: { resources: ['Responses API', 'Conversations API'] }, severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      review: {
        status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-05', provenance: 'official',
        documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
        evidenceFingerprint: '70f977467ffc1ba85e48684000a7af3eb87ee6beaad85cc0f0ce908c849809cb',
        candidateFingerprint: '9c8a0e3792e19bf6e8c231c91089c1702cd2781676df284383f4022292bc8c8d',
      },
    });
    expect(assistantsRecord.affectedPackages).toBeUndefined();
    expect(assistantsRecord.affectedVersionRange).toBeUndefined();
    expect(assistantsRecord.apiOperationPatterns).toEqual([]);
    expect(assistantsRecord.affectedEndpoints).toEqual([]);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(2);
  });

  it.each([
    ['affected', 'openai', 'gpt-4.5-preview', true, 'AFFECTED'],
    ['unaffected', 'openai', 'gpt-4.1', true, 'NOT_AFFECTED'],
    ['dynamic', 'openai', undefined, false, 'NEEDS_REVIEW'],
    ['unrelated-model', 'openai', 'gpt-4o', true, 'NOT_AFFECTED'],
    ['different provider and model', 'anthropic', 'gpt-4.5-preview', true, 'NOT_AFFECTED'],
  ] as const)('evaluates %s with no cross-scope claim', (id, providerId, model, staticEvidence, expected) => {
    const result = evaluateRegisteredNormalizedCompatibility({ providerId, usageIR: [usage(id, providerId, model, staticEvidence)], completeEvidence: !staticEvidence ? false : true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(result).toHaveLength(providerId === 'openai' ? 2 : providerId === 'anthropic' ? 1 : 0);
    const modelResult = result.find((item) => item.changeId === modelRecord.changeId);
    if (modelResult) expect(modelResult.status).toBe(expected);
    if (providerId === 'anthropic') {
      expect(result[0]?.providerId).toBe('anthropic');
      expect(result[0]?.status).toBe('NOT_AFFECTED');
      expect(result.some((item) => item.changeId.startsWith('openai-'))).toBe(false);
    }
  });

  it('evaluates both OpenAI rules without duplicate or conflicting findings', () => {
    const modelUsages = [usage('model-affected', 'openai', 'gpt-4.5-preview', true)];
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: modelUsages, completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(results.map((item) => item.changeId)).toEqual([
      'openai-assistants-api-sunset-2026-08-26',
      'openai-gpt-4-5-preview-removal-2025-07-14',
    ]);
    expect(results.find((item) => item.changeId === modelRecord.changeId)?.status).toBe('AFFECTED');
    expect(results.find((item) => item.changeId === assistantsRecord.changeId)?.status).toBe('NOT_AFFECTED');
    expect(new Set(results.map((item) => item.changeId)).size).toBe(results.length);

    const resourceUsage = normalizeCompatibilityUsage({ id: 'assistants', providerId: 'openai', resource: 'Assistants API', evidenceKind: 'sdk', confidence: 0.99, static: true, location: { file: 'fixtures/openai-assistants.ts', line: 12, column: 1, symbol: 'Assistants API' } }, { language: 'typescript' });
    const resourceResults = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [resourceUsage], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(resourceResults.find((item) => item.changeId === assistantsRecord.changeId)?.status).toBe('AFFECTED');
    expect(resourceResults.find((item) => item.changeId === modelRecord.changeId)?.status).toBe('NOT_AFFECTED');
  });

  it('binds each compatibility result to a proof snapshot', () => {
    for (const [id, model, expected] of [['affected', 'gpt-4.5-preview', 'AFFECTED'], ['unaffected', 'gpt-4.1', 'NOT_AFFECTED'], ['dynamic', undefined, 'NEEDS_REVIEW'] ] as const) {
      const result = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [usage(id, 'openai', model, id !== 'dynamic')], completeEvidence: id !== 'dynamic' }, PRODUCTION_COMPATIBILITY_REGISTRY).find((item) => item.changeId === modelRecord.changeId)!;
      const [proof] = buildCompatibilityProofSnapshot({ repositoryId: 'local-openai-production', baselineSha: 'd'.repeat(40), scanId: `proof-${id}`, results: [result], mode: 'test' });
      expect(proof?.status).toBe(expected);
    }
  });
});
