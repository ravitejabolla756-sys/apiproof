import { describe, expect, it } from 'vitest';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';
import { evaluateCompatibility } from '@apiproof/analyzers';

const usage = {
  id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions',
  evidenceKind: 'sdk' as const, confidence: 0.98, static: true,
  location: { file: 'src/chat.ts', line: 12, column: 3, symbol: 'chat.completions.create' },
};

const result = (provenance: 'official' | 'synthetic' = 'official') => evaluateCompatibility(
  { providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', versionSource: 'lockfile', versionConfidence: 'exact', usages: [usage], completeEvidence: true },
  { ...COMPATIBILITY_FIXTURES[0]!, review: { ...COMPATIBILITY_FIXTURES[0]!.review, provenance } },
  { compatibilityProviders: new Set(['openai']) },
);

describe('repository-bound compatibility proof snapshots', () => {
  it('binds proofs to the repository baseline and deduplicates deterministically', () => {
    const proof = buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', results: [result(), result()] })[0];
    expect(proof).toMatchObject({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', providerId: 'openai', status: 'AFFECTED', exactFile: 'src/chat.ts' });
    expect(buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', results: [result(), result()] })).toHaveLength(1);
  });

  it('omits synthetic or draft records in production mode', () => {
    expect(buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', results: [result('synthetic')] })).toEqual([]);
  });

  it('permits synthetic records only in explicit test mode', () => {
    expect(buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), scanId: 'scan-1', results: [result('synthetic')], mode: 'test' })).toHaveLength(1);
  });

  it('accepts a real Git commit SHA as the proof baseline', () => {
    expect(buildCompatibilityProofSnapshot({ repositoryId: 'repo-1', baselineSha: 'a'.repeat(40), scanId: 'scan-1', results: [result()] })).toHaveLength(1);
  });
});
