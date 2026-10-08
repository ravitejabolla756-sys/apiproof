import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import type { CompatibilityUsage } from '@apiproof/shared';

const CHANGE_ID = 'aws-cloudwatch-evidently-end-of-support-2025-10-16';

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'aws-evidently', providerId: 'aws', resource: 'Amazon CloudWatch Evidently', evidenceKind: 'sdk', confidence: 0.99, static: true,
  location: { file: 'src/aws.ts', line: 12, column: 1 }, ...overrides,
});

const evaluate = (items: CompatibilityUsage[], completeEvidence = true) => evaluateRegisteredNormalizedCompatibility({
  providerId: 'aws', usageIR: items.map((item) => normalizeCompatibilityUsage(item, { language: 'typescript' })), completeEvidence,
}, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID)!;

describe('AWS CloudWatch Evidently reviewed production rule', () => {
  it('inserts exactly one reviewed AWS rule with deterministic metadata', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('aws')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID)).toMatchObject({
      providerId: 'aws', changeType: 'endpoint_removed', removalAt: '2025-10-16', severity: 'high',
      affectedResources: ['Amazon CloudWatch Evidently'], applicabilityScope: { dimensions: ['provider', 'resource'] },
      review: { status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official' },
    });
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).toEqual([...PRODUCTION_COMPATIBILITY_REGISTRY.changes].sort((a, b) => a.changeId.localeCompare(b.changeId)).map((change) => change.changeId));
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).size).toBe(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.size).toBe(15);
  });

  it('evaluates affected, unaffected, unresolved, and isolated resource evidence', () => {
    expect(evaluate([usage()]).status).toBe('AFFECTED');
    expect(evaluate([usage({ id: 'rds', resource: 'Amazon RDS' })]).status).toBe('NOT_AFFECTED');
    expect(evaluate([usage({ id: 'dynamic', static: false, confidence: 0.35 })], false).status).toBe('NEEDS_REVIEW');

    const wrongProvider = normalizeCompatibilityUsage(usage({ providerId: 'unrelated-provider' }), { language: 'typescript' });
    const wrongProviderResult = evaluateRegisteredNormalizedCompatibility({ providerId: 'unrelated-provider', usageIR: [wrongProvider], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(wrongProviderResult.some((result) => result.changeId === CHANGE_ID && result.status === 'AFFECTED')).toBe(false);
    expect(evaluate([usage(), usage()]).matchedUsages).toHaveLength(1);
  });

  it('produces equivalent TypeScript and Python normalized resource results', () => {
    const ts = normalizeCompatibilityUsage(usage({ id: 'typescript' }), { language: 'typescript' });
    const py = normalizeCompatibilityUsage(usage({ id: 'python' }), { language: 'python' });
    const tsResult = evaluateRegisteredNormalizedCompatibility({ providerId: 'aws', usageIR: [ts], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID)!;
    const pyResult = evaluateRegisteredNormalizedCompatibility({ providerId: 'aws', usageIR: [py], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID)!;
    expect(tsResult.status).toBe('AFFECTED');
    expect(pyResult.status).toBe('AFFECTED');
  });
});
