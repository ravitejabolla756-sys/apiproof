import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const change: ReviewedCompatibilityChange = {
  providerId: 'openai', changeId: 'language-fixture-openai-model', title: 'OpenAI model retirement fixture', description: 'Test-only projection of a model retirement candidate.', changeType: 'model_retired',
  officialSourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice', applicabilityScope: { dimensions: ['provider', 'model'] }, affectedPackages: ['openai'], affectedVersionRange: undefined,
  apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: [], affectedModels: ['gpt-4.5-preview'], affectedResources: [], authOrHeaderPatterns: [], severity: 'high',
  review: { status: 'reviewed', reviewer: 'language-fixture', reviewedAt: '2026-10-05', provenance: 'official' }, evidence: [{ url: 'https://developers.openai.com/api/docs/deprecations', summary: 'Test-only source linkage.', accessedAt: '2026-10-05' }],
};

const sourceUsage = (language: 'typescript' | 'python' | 'go'): CompatibilityUsage => ({ id: language, providerId: 'openai', packageName: 'openai', model: 'gpt-4.5-preview', evidenceKind: 'sdk', confidence: 0.95, static: true, location: { file: `fixture.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go'}`, line: 12, column: 1, symbol: 'model' } });

describe('cross-language compatibility normalization', () => {
  it('evaluates the same model retirement semantics for TypeScript, Python, and Go', () => {
    for (const language of ['typescript', 'python', 'go'] as const) {
      const usageIR = [normalizeCompatibilityUsage(sourceUsage(language), { language, resolvedVersion: '1.0.0', versionSource: 'lockfile', versionConfidence: 'exact' })];
      const result = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR, completeEvidence: true }, change, { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true });
      expect(result.status, language).toBe('AFFECTED');
      expect(result.matchedUsages[0]?.location.file).toBe(sourceUsage(language).location.file);
    }
  });
});
