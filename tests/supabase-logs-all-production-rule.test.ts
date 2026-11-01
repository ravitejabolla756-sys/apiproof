import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';

const CHANGE_ID = 'supabase-management-logs-all-removal-2026-09-23';
const usage = (endpoint: string | undefined, overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'supabase-logs-all-usage',
  providerId: 'supabase',
  endpoint,
  evidenceKind: 'http',
  confidence: endpoint ? 0.99 : 0.4,
  static: endpoint !== undefined,
  location: { file: 'src/logs.ts', line: 14, column: 1, symbol: 'fetch' },
  ...overrides,
});

const evaluate = (input: CompatibilityUsage) => evaluateRegisteredNormalizedCompatibility({
  providerId: input.providerId,
  usageIR: [normalizeCompatibilityUsage(input, { language: 'typescript' })],
  completeEvidence: input.static,
}, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID);

describe('Supabase logs.all reviewed production rule', () => {
  it('inserts exactly one reviewed Supabase record with preserved metadata', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(50);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('supabase')).toHaveLength(2);
    const record = PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID);
    expect(record).toMatchObject({
      providerId: 'supabase',
      changeType: 'endpoint_removed',
      publishedAt: '2026-07-23',
      removalAt: '2026-09-23',
      severity: 'high',
      affectedEndpoints: ['analytics/endpoints/logs.all'],
      replacement: { endpoint: 'analytics/endpoints/logs' },
      applicabilityScope: { dimensions: ['provider', 'endpoint'] },
      review: {
        status: 'reviewed',
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-06',
        documentFingerprint: '1cd6ddf38800302ff4df662b1dc5cab8dd171a848647ad223150efc0a2fc29c8',
        evidenceFingerprint: 'b6f56792e51270c86280e4a8b5e619d1f871b9dc91ea0cd86379c971a2de9f23',
        candidateFingerprint: '39f2f68655b0713137fe5ce81101af481fd2914c78c698752e042e88466fbd4e',
      },
    });
    expect(record?.evidence.some((source) => source.summary.includes('ClickHouse SQL'))).toBe(true);
  });

  it('matches only the exact removed endpoint and fails closed', () => {
    expect(evaluate(usage('analytics/endpoints/logs.all') )?.status).toBe('AFFECTED');
    for (const endpoint of ['analytics/endpoints/logs', 'analytics/endpoints/logs.all.extra', 'prefix-logs.all', 'analytics/endpoints/other/logs.all', 'https://example.com/path?endpoint=analytics/endpoints/logs.all']) {
      expect(evaluate(usage(endpoint))?.status).toBe('NOT_AFFECTED');
    }
    expect(evaluate(usage(undefined))?.status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage('analytics/endpoints/logs.all', { providerId: 'github' }))).toBeUndefined();
  });
});
