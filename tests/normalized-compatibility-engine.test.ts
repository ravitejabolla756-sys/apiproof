import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';

const policy = { compatibilityProviders: new Set(['openai']) };
const usage: CompatibilityUsage = { id: 'python-usage', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions', evidenceKind: 'sdk', confidence: 0.95, static: true, location: { file: 'client.py', line: 8, column: 1, symbol: 'client.chat.completions.create' } };
const apiVersionChange = {
  providerId: 'stripe', changeId: 'fixture-stripe-api-version', title: 'Fixture API version retirement',
  description: 'Synthetic API-version retirement record for evaluator tests.', changeType: 'api_version_retired',
  officialSourceUrl: 'https://docs.stripe.com/changelog', sourceType: 'official-changelog',
  applicabilityScope: { dimensions: ['provider', 'api_version'] }, affectedPackages: [], apiOperationPatterns: [],
  affectedParameters: [], affectedResponseFields: [], affectedEndpoints: [], affectedModels: [], affectedResources: [],
  authOrHeaderPatterns: [], apiVersionMetadata: { version: '2024-10-01', replacement: '2025-03-31.basil' }, severity: 'high',
  review: { status: 'verified', reviewer: 'Compatibility fixture', reviewedAt: '2026-01-01', provenance: 'official' },
  evidence: [{ url: 'https://docs.stripe.com/changelog', summary: 'Synthetic test source reference.', accessedAt: '2026-01-01' }],
} as const;

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

  it('matches literal API-version evidence and rejects a different version', () => {
    const configured = normalizeCompatibilityUsage({
      id: 'stripe-configured-client', providerId: 'stripe', packageName: 'stripe', apiVersion: '2024-10-01',
      operation: 'Stripe',
      evidenceKind: 'sdk', confidence: 0.95, static: true,
      location: { file: 'stripe.ts', line: 4, column: 1, symbol: 'Stripe' },
    }, { language: 'typescript' });
    const replacement = normalizeCompatibilityUsage({
      id: 'stripe-replacement-client', providerId: 'stripe', packageName: 'stripe', operation: 'Stripe', apiVersion: '2025-03-31.basil',
      evidenceKind: 'sdk', confidence: 0.95, static: true,
      location: { file: 'stripe.ts', line: 4, column: 1, symbol: 'Stripe' },
    }, { language: 'typescript' });
    const stripePolicy = { compatibilityProviders: new Set(['stripe']), requireOfficialProvenance: true };

    expect(evaluateNormalizedCompatibility({ providerId: 'stripe', usageIR: [configured], completeEvidence: true }, apiVersionChange, stripePolicy).status).toBe('AFFECTED');
    expect(evaluateNormalizedCompatibility({ providerId: 'stripe', usageIR: [replacement], completeEvidence: true }, apiVersionChange, stripePolicy).status).toBe('NOT_AFFECTED');
  });
});
