import { describe, expect, it } from 'vitest';
import { evaluateCompatibility } from '@apiproof/analyzers';
import { evaluateCompatibilityCheck, type CompatibilityUsage } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/chat.ts', line: 12, column: 3, symbol: 'client.chat.completions.create' }, ...overrides,
});

const proof = (overrides: Partial<Parameters<typeof evaluateCompatibility>[0]> = {}, usageOverrides: Partial<CompatibilityUsage> = {}) => evaluateCompatibility({ providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', usages: [usage(usageOverrides)], completeEvidence: true, ...overrides }, COMPATIBILITY_FIXTURES[0], { compatibilityProviders: new Set(['openai', 'anthropic']) });
const base = (overrides: Partial<Parameters<typeof evaluateCompatibilityCheck>[0]> = {}) => ({ checkId: 'check-1', repositoryId: 'repo-1', baselineSha: 'a'.repeat(64), changedFiles: ['src/chat.ts'], proofs: [proof()], completeEvidence: true, ...overrides });

describe('provider-neutral compatibility check projection', () => {
  it('fails when an affected proof is present and preserves evidence', () => {
    const result = evaluateCompatibilityCheck(base());
    expect(result.status).toBe('FAIL');
    expect(result.findings[0]).toMatchObject({ providerId: 'openai', changeId: 'fixture-openai-parameter', file: 'src/chat.ts', line: 12, officialSourceUrl: 'https://platform.openai.com/docs' });
    expect(result.liveGitHubWritePerformed).toBe(false);
  });

  it('passes when every proof is not affected', () => {
    const result = evaluateCompatibilityCheck(base({ proofs: [proof({ resolvedVersion: '3.0.0' })] }));
    expect(result.status).toBe('PASS');
    expect(result.summary).toEqual({ affected: 0, notAffected: 1, needsReview: 0 });
  });

  it('keeps uncertainty as NEEDS_REVIEW instead of upgrading it to FAIL', () => {
    const result = evaluateCompatibilityCheck(base({ proofs: [proof({ resolvedVersion: null, declaredVersion: null, versionConfidence: 'unknown', versionSource: 'unknown' })] }));
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('COMPATIBILITY_REQUIRES_REVIEW');
  });

  it('warns when there are no proofs or evidence is incomplete', () => {
    expect(evaluateCompatibilityCheck(base({ proofs: [] })).status).toBe('WARN');
    expect(evaluateCompatibilityCheck(base({ proofs: [proof({ resolvedVersion: '3.0.0' })], completeEvidence: false })).status).toBe('WARN');
  });

  it('sorts findings deterministically and deduplicates changed files', () => {
    const first = proof();
    const second = proof({ providerId: 'anthropic' }, { providerId: 'anthropic', id: 'u2', packageName: '@anthropic-ai/sdk' });
    const result = evaluateCompatibilityCheck(base({ proofs: [second, first], changedFiles: ['z.ts', 'a.ts', 'z.ts'] }));
    expect(result.findings.map((finding) => finding.providerId)).toEqual(['anthropic', 'openai']);
    expect(result.changedFiles).toEqual(['a.ts', 'z.ts']);
  });
});
