import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage } from '@apiproof/shared';

const CHANGE_ID = 'supabase-openapi-anon-key-access-2026-03-11';
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'supabase-openapi-usage',
  providerId: 'supabase',
  endpoint: '/rest/v1/',
  authOrHeader: 'anon key',
  evidenceKind: 'http',
  confidence: 0.99,
  static: true,
  location: { file: 'src/openapi.ts', line: 21, column: 1, symbol: 'fetch' },
  ...overrides,
});

const evaluate = (input: CompatibilityUsage, language: 'typescript' | 'python' = 'typescript') => evaluateRegisteredNormalizedCompatibility({
  providerId: input.providerId,
  usageIR: [normalizeCompatibilityUsage(input, { language })],
  completeEvidence: input.static,
}, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID);

describe('Supabase OpenAPI anon-key reviewed production rule', () => {
  it('inserts exactly one second reviewed Supabase rule with generic credential evidence', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(10);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('supabase')).toHaveLength(2);
    const record = PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID);
    expect(record).toMatchObject({
      providerId: 'supabase',
      changeType: 'parameter_required',
      effectiveAt: '2026-03-11',
      applicabilityScope: { dimensions: ['provider', 'endpoint', 'auth_or_header'] },
      affectedEndpoints: ['/rest/v1/'],
      authOrHeaderPatterns: ['anon key'],
      replacement: { authOrHeader: 'service_role key or new secret API key' },
      severity: 'high',
      review: {
        status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-06',
        documentFingerprint: 'f8cc1c82fdef5b686930280bd95860dc7413c45a5e6d1db8edf2744a8c110f96',
        evidenceFingerprint: 'e162ea328b8db825a739fce6174efaa03637d86ef408ea81a173988886b7ff6c',
        candidateFingerprint: '33b4ebe9cdfef34571301ccfb2cd4e764fd0fe28564260c5066a8661dec2cfa5',
      },
    });
    expect(record?.authOrHeaderPatterns).not.toContain('Authorization');
  });

  it('requires the endpoint and blocked credential together', () => {
    expect(evaluate(usage())?.status).toBe('AFFECTED');
    expect(evaluate(usage({ authOrHeader: 'service-role key' }))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ authOrHeader: 'new secret API key' }))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ endpoint: '/rest/v1/users' }))?.status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ authOrHeader: undefined, static: false, confidence: 0.4 }))?.status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ endpoint: undefined, static: false, confidence: 0.4 }))?.status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ providerId: 'github' }))).toBeUndefined();
  });

  it('keeps TypeScript and Python normalized evidence equivalent and produces proofs', () => {
    expect(evaluate(usage(), 'typescript')?.status).toBe('AFFECTED');
    expect(evaluate(usage(), 'python')?.status).toBe('AFFECTED');
    const results = [
      evaluate(usage()),
      evaluate(usage({ authOrHeader: 'service-role key' })),
      evaluate(usage({ authOrHeader: undefined, static: false, confidence: 0.4 })),
    ];
    const proofs = results.flatMap((result, index) => buildCompatibilityProofSnapshot({ repositoryId: 'supabase-openapi-production-fixture', baselineSha: 'b'.repeat(40), scanId: `supabase-openapi-${index}`, results: [result], mode: 'test' }));
    expect(proofs.map((proof) => proof.status).sort()).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
    expect(proofs.find((proof) => proof.status === 'AFFECTED')).toMatchObject({ providerId: 'supabase', changeId: CHANGE_ID, severity: 'high', reviewStatus: 'reviewed', provenance: 'official' });
  });
});
