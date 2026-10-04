import { describe, expect, it } from 'vitest';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { compileProductionChangeRegistry } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

describe('registered normalized compatibility path', () => {
  it('evaluates reviewed registry changes and binds the result to a proof snapshot', () => {
    const change = { ...COMPATIBILITY_FIXTURES[0]!, review: { ...COMPATIBILITY_FIXTURES[0]!.review, status: 'reviewed' as const, provenance: 'official' as const, reviewer: 'Manual reviewer' } };
    const registry = compileProductionChangeRegistry([change]);
    const usageIR = [normalizeCompatibilityUsage({ id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.98, static: true, location: { file: 'src/chat.ts', line: 12, column: 1 } }, { language: 'typescript', resolvedVersion: '4.2.0', versionSource: 'lockfile', versionConfidence: 'exact' })];
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR, completeEvidence: true }, registry);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'AFFECTED', provenance: 'official', changeId: change.changeId });
    expect(buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', results })).toHaveLength(1);
  });

  it('returns no claims for a provider with no registered reviewed changes', () => {
    const registry = compileProductionChangeRegistry([]);
    expect(evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [], completeEvidence: true }, registry)).toEqual([]);
  });
});
