import { describe, expect, it } from 'vitest';
import { buildRepositoryUsageGraph, buildRepositoryUsageGraphIndex, planIncrementalAnalysis, summarizeIncrementalLookupComplexity, type NormalizedUsageIR } from '@apiproof/shared';

const usage = (overrides: Partial<NormalizedUsageIR> = {}): NormalizedUsageIR => ({
  id: 'usage-1', language: 'typescript', providerId: 'openai', packageName: 'openai', declaredVersion: '^4.0.0', resolvedVersion: '4.2.0', versionSource: 'lockfile', versionConfidence: 'exact', operation: 'chat.completions.create', resource: 'chat', method: 'create', parameters: ['model'], responseFields: [], authEvidence: [], dynamic: false, location: { file: 'src/ai.ts', line: 10, column: 1, symbol: 'client.chat.completions.create' }, confidence: 0.99, evidence: [{ kind: 'sdk-call', detail: 'chat.completions.create', file: 'src/ai.ts', line: 10, provenance: 'static-source' }], ...overrides,
});

const graph = () => buildRepositoryUsageGraph({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), files: [{ path: 'src/ai.ts', digest: 'b'.repeat(64), kind: 'source' }, { path: 'pnpm-lock.yaml', digest: 'c'.repeat(64), kind: 'lockfile' }], usageIR: [usage(), usage({ id: 'usage-2', providerId: 'twilio', packageName: 'twilio', operation: 'messages.create', location: { file: 'src/sms.ts', line: 4, column: 1, symbol: 'client.messages.create' } })], compatibilityResults: [] });

describe('incremental usage graph', () => {
  it('builds deterministic repository-to-usage indexes without duplicating source rules', () => {
    const result = graph();
    expect(result.repositoryId).toBe('repo-1');
    expect(result.baselineSha).toBe('a'.repeat(64));
    expect(result.usages.map((item) => item.usageId)).toEqual(['usage-1', 'usage-2']);
    expect(result.files.map((file) => file.path)).toEqual(['pnpm-lock.yaml', 'src/ai.ts']);
  });

  it('selects changed-file usage nodes and preserves unaffected providers', () => {
    const result = planIncrementalAnalysis({ graph: graph(), changedFiles: ['src/ai.ts'] });
    expect(result.reanalyzeFiles).toEqual(['src/ai.ts']);
    expect(result.impactedUsageIds).toEqual(['usage-1']);
    expect(result.reasonCodes).toContain('CHANGED_FILES');
  });

  it('selects package-dependent usages when lockfile state changes', () => {
    const result = planIncrementalAnalysis({ graph: graph(), changedFiles: ['pnpm-lock.yaml'], changedDependencyPackages: ['openai'] });
    expect(result.impactedUsageIds).toEqual(['usage-1']);
    expect(result.reanalyzeFiles).toEqual(['src/ai.ts']);
  });

  it('selects provider state changes and is stable regardless of input order', () => {
    const first = planIncrementalAnalysis({ graph: graph(), changedFiles: ['src/sms.ts', 'src/ai.ts'], changedProviderIds: ['twilio', 'openai'] });
    const second = planIncrementalAnalysis({ graph: graph(), changedFiles: ['src/ai.ts', 'src/sms.ts'], changedProviderIds: ['openai', 'twilio'] });
    expect(first).toEqual(second);
    expect(first.impactedUsageIds).toEqual(['usage-1', 'usage-2']);
  });

  it('builds deterministic indexes for file, package, provider, and change lookups', () => {
    const index = buildRepositoryUsageGraphIndex(graph());
    expect(index.byFile.get('src/ai.ts')).toEqual(['usage-1']);
    expect(index.byPackage.get('openai')).toEqual(['usage-1']);
    expect(index.byProvider.get('twilio')).toEqual(['usage-2']);
    expect(index.byUsageId.get('usage-1')?.providerId).toBe('openai');
  });

  it('reports indexed candidate work instead of provider-by-node comparisons', () => {
    const result = summarizeIncrementalLookupComplexity(graph(), { changedFiles: [], changedProviderIds: ['openai'] });
    expect(result.strategy).toBe('indexed');
    expect(result.candidateUsageNodes).toBe(1);
    expect(result.naiveProviderComparisons).toBe(2);
    expect(result.indexedLookups).toBe(1);
  });

  it('rejects duplicate usage identities instead of producing ambiguous graph edges', () => {
    expect(() => buildRepositoryUsageGraph({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), files: [], usageIR: [usage(), usage()] })).toThrow('USAGE_GRAPH_DUPLICATE_USAGE_ID');
  });
});
