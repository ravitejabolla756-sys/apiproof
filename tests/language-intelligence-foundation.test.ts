import { describe, expect, it, vi } from 'vitest';
import {
  MigrationVerifier,
  LanguageAnalyzerRegistry,
  LanguageChangeStrategyRegistry,
} from '@apiproof/core';
import {
  RegressionTestCandidateSchema,
  RepositoryWorkspaceSchema,
  UnifiedFindingSchema,
  WorkspacePackageSchema,
} from '@apiproof/shared';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';

describe('language-aware intelligence foundation', () => {
  it('registers an existing TypeScript analyzer without changing its language contract', () => {
    const analyzer = new TypeScriptRepositoryAnalyzer();
    const registry = new LanguageAnalyzerRegistry<TypeScriptRepositoryAnalyzer>();
    registry.register(analyzer);
    expect(registry.get('typescript')).toBe(analyzer);
    expect(registry.supportedLanguages()).toEqual(['typescript']);
    expect(analyzer.language).toBe('typescript');
  });

  it('keeps syntax-specific strategies for one stable vendor change identity', () => {
    const registry = new LanguageChangeStrategyRegistry();
    registry.register({ changeId: 'stripe-subscription-coupon-removed', language: 'typescript', adapterId: 'ts-morph', detectionRuleId: 'object-property-coupon', migrationStrategyId: 'stripe-discounts-ts-v1' });
    registry.register({ changeId: 'stripe-subscription-coupon-removed', language: 'python', adapterId: 'python-ast', detectionRuleId: 'keyword-argument-coupon', migrationStrategyId: 'stripe-discounts-py-v1' });
    expect(registry.get('stripe-subscription-coupon-removed', 'typescript')?.detectionRuleId).toBe('object-property-coupon');
    expect(registry.get('stripe-subscription-coupon-removed', 'python')?.detectionRuleId).toBe('keyword-argument-coupon');
    expect(() => registry.register({ changeId: 'stripe-subscription-coupon-removed', language: 'python', adapterId: 'other', detectionRuleId: 'other', migrationStrategyId: 'other' })).toThrow('LANGUAGE_CHANGE_STRATEGY_DUPLICATE');
  });

  it('represents packages from different monorepo ecosystems under one repository workspace', () => {
    expect(RepositoryWorkspaceSchema.parse({
      repositoryId: 'repo-1', workspaceId: 'ws-1', packages: [
        { id: 'web', repositoryId: 'repo-1', path: 'apps/web', language: 'typescript', manifestPaths: ['apps/web/package.json'], dependencies: [{ name: 'stripe', declaredVersion: '^17', ecosystem: 'npm' }] },
        { id: 'billing', repositoryId: 'repo-1', path: 'services/billing', language: 'go', manifestPaths: ['services/billing/go.mod'], dependencies: [{ name: 'stripe-go', declaredVersion: 'v81', ecosystem: 'go' }] },
      ],
    }).packages.map((pkg) => [pkg.id, pkg.language])).toEqual([['web', 'typescript'], ['billing', 'go']]);
    expect(WorkspacePackageSchema.safeParse({ id: 'bad', repositoryId: 'repo-1', path: '../outside', language: 'python', manifestPaths: ['pyproject.toml'], dependencies: [] }).success).toBe(false);
  });

  it('uses one normalized finding shape for external and internal API changes', () => {
    const base = { usageId: 'usage-1', changeId: 'payment-create-v2', location: { file: 'services/payments.py', start: { line: 8, column: 1 }, end: { line: 8, column: 25 } }, symbol: 'PaymentService.create', reason: 'Signature changed.', confidence: 0.8, versionAssessment: 'unknown' as const, matchedRule: 'python-keyword-call', affected: true as const, reasonCodes: ['AFFECTED_METHOD_USED'] as const, evidence: [{ kind: 'method-call' as const, symbol: 'PaymentService.create' }] };
    const external = UnifiedFindingSchema.parse({ ...base, provider: 'stripe', language: 'python', packagePath: 'services/payments' });
    const internal = UnifiedFindingSchema.parse({ ...base, provider: 'internal-payments', language: 'java', packagePath: 'services/payments-java' });
    expect(external.changeId).toBe(internal.changeId);
    expect([external.provider, internal.provider]).toEqual(['stripe', 'internal-payments']);
  });

  it('keeps generated regression tests candidate-only and unable to satisfy production evidence gates', () => {
    const candidate = { id: 'candidate-1', status: 'candidate', language: 'typescript', path: '.myowl/candidates/change.test.ts', content: 'test("candidate", () => {});', contentDigest: 'a'.repeat(64), targetFiles: ['src/billing.ts'], generatedBy: 'llm' };
    expect(RegressionTestCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(RegressionTestCandidateSchema.safeParse({ ...candidate, status: 'VERIFICATION_PASSED', provenanceToken: 'forged' }).success).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => MigrationVerifier.verify({ repositoryId: 'gh-1', baselineSha: 'b'.repeat(40), changeId: 'payment-create-v2', patchDigest: 'c'.repeat(64), proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true })).toThrow('VERIFICATION_EXECUTION_EVIDENCE_REQUIRED');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
