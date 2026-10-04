import { describe, expect, it } from 'vitest';
import { evaluateCompatibility } from '@apiproof/analyzers';
import { evaluateRedGreenVerification, type CompatibilityUsage } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/chat.ts', line: 12, column: 3, symbol: 'client.chat.completions.create' }, ...overrides,
});
const proof = (changed: Partial<CompatibilityUsage> = {}) => evaluateCompatibility({ providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', usages: [usage(changed)], completeEvidence: true }, COMPATIBILITY_FIXTURES[0], { compatibilityProviders: new Set(['openai']) });
const gates = [{ name: 'build' as const, passed: true, outputDigest: 'a'.repeat(64) }, { name: 'typecheck' as const, passed: true, outputDigest: 'b'.repeat(64) }, { name: 'test' as const, passed: true, outputDigest: 'c'.repeat(64) }] as const;
const base = (overrides: Record<string, unknown> = {}) => ({ verificationId: 'verify-1', repositoryId: 'repo-1', baselineSha: 'd'.repeat(64), changeId: 'fixture-openai-parameter', beforeProof: proof(), afterProof: proof({ id: 'u2', operation: 'embeddings.create', parameter: undefined }), patch: { applied: true, patchDigest: 'e'.repeat(64), targetFiles: ['src/chat.ts'], sourceDigests: { 'src/chat.ts': 'f'.repeat(64) }, resultingDigests: { 'src/chat.ts': '0'.repeat(64) } }, gates, ...overrides });

describe('provider-neutral red/green verification', () => {
  it('passes only when before, patch, after, and all gates are proven', () => {
    const result = evaluateRedGreenVerification(base() as never);
    expect(result.status).toBe('VERIFICATION_PASSED');
    expect(result.before.status).toBe('AFFECTED');
    expect(result.after.status).toBe('NOT_AFFECTED');
    expect(result.patch.targetFiles).toEqual(['src/chat.ts']);
    expect(result.evidenceDigest).toHaveLength(64);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('fails closed when compatibility remains affected or a gate fails', () => {
    const result = evaluateRedGreenVerification(base({ afterProof: proof(), gates: [{ name: 'build', passed: false, outputDigest: null }, gates[1], gates[2]] }) as never);
    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.reasonCodes).toContain('AFTER_COMPATIBILITY_NOT_CLEARED');
    expect(result.reasonCodes).toContain('VERIFICATION_GATE_FAILED');
  });

  it('requires exact target-file digest binding and preserves repository identity', () => {
    const result = evaluateRedGreenVerification(base({ repositoryId: 'repo-2', patch: { ...base().patch, sourceDigests: {} } }) as never);
    expect(result.status).toBe('VERIFICATION_FAILED');
    expect(result.reasonCodes).toContain('TARGET_DIGEST_BINDING_MISMATCH');
    expect(result.repositoryId).toBe('repo-2');
  });

  it('uses NEEDS_REVIEW for proof identity mismatch rather than claiming failure is proven', () => {
    const result = evaluateRedGreenVerification(base({ changeId: 'other-change' }) as never);
    expect(result.status).toBe('VERIFICATION_NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('PROOF_CHANGE_MISMATCH');
  });
});
