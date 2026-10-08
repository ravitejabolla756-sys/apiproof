import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';

const CHANGE_ID = 'twilio-studio-engagements-endpoint-deprecated';

const usage = (endpoint: string | undefined, overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'twilio-studio-endpoint-usage',
  providerId: 'twilio',
  endpoint,
  evidenceKind: 'http',
  confidence: endpoint ? 0.99 : 0.4,
  static: endpoint !== undefined,
  location: { file: 'src/studio.ts', line: 22, column: 1, symbol: 'fetch' },
  ...overrides,
});

const evaluate = (input: CompatibilityUsage) => evaluateRegisteredNormalizedCompatibility({
  providerId: input.providerId,
  usageIR: [normalizeCompatibilityUsage(input, { language: 'typescript' })],
  completeEvidence: input.static,
}, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID);

describe('Twilio Studio Engagements reviewed production rule', () => {
  it('is the tenth reviewed record and preserves the date uncertainty', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('twilio')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID)).toMatchObject({
      providerId: 'twilio',
      changeType: 'endpoint_removed',
      publishedAt: undefined,
      effectiveAt: undefined,
      removalAt: undefined,
      severity: 'high',
      affectedEndpoints: ['/Engagements'],
      replacement: { endpoint: '/Executions' },
      applicabilityScope: { dimensions: ['provider', 'endpoint'] },
      review: {
        status: 'reviewed',
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-06',
        documentFingerprint: '05d8a88476bf4182c9569e42b96932d9c0036294d6da28426d28c6c0451d7a80',
        evidenceFingerprint: '0501efa9e9427c234e8450893c1208645f90f7fa35a6475635fb9a9196835ad6',
        candidateFingerprint: '699aabd98ad389d1ff0a39b8a4bfac0df78dbaf544850c96697dd88cf7abc1e7',
      },
    });
  });

  it('matches the exact deprecated endpoint and fails closed', () => {
    expect(evaluate(usage('/Engagements'))?.status).toBe('AFFECTED');
    expect(evaluate(usage('/Executions'))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage('/Engagements/extra'))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage('prefix/Engagements'))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage(undefined))?.status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage('/Engagements', { providerId: 'openai' }))).toBeUndefined();
  });

  it('keeps the normalized TypeScript and Python evaluations equivalent', () => {
    const input = usage('/Engagements');
    const evaluateLanguage = (language: 'typescript' | 'python') => evaluateRegisteredNormalizedCompatibility({
      providerId: input.providerId,
      usageIR: [normalizeCompatibilityUsage(input, { language })],
      completeEvidence: true,
    }, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID)?.status;
    expect(evaluateLanguage('typescript')).toBe('AFFECTED');
    expect(evaluateLanguage('python')).toBe('AFFECTED');
  });
});
