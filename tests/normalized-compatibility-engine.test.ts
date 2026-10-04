import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const policy = { compatibilityProviders: new Set(['openai']) };
const usage: CompatibilityUsage = { id: 'python-usage', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.95, static: true, location: { file: 'client.py', line: 8, column: 1, symbol: 'client.chat.completions.create' } };

describe('normalized IR compatibility bridge', () => {
  it('evaluates Python-shaped normalized IR through the generic compatibility engine', () => {
    const usageIR = [normalizeCompatibilityUsage(usage, { language: 'python', declaredVersion: '>=4.0.0', resolvedVersion: '4.2.0', versionSource: 'lockfile', versionConfidence: 'exact' })];
    const result = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR, completeEvidence: true }, COMPATIBILITY_FIXTURES[0], policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.exactFile).toBe('client.py');
    expect(result.resolvedVersion).toBe('4.2.0');
  });

  it('fails closed when normalized usages contain multiple providers', () => {
    const first = normalizeCompatibilityUsage(usage, { language: 'go' });
    const second = normalizeCompatibilityUsage({ ...usage, id: 'other', providerId: 'twilio' }, { language: 'go' });
    expect(() => evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [first, second] }, COMPATIBILITY_FIXTURES[0], policy)).toThrow('COMPATIBILITY_IR_PROVIDER_MISMATCH');
  });
});
