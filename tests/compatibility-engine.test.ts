import { describe, expect, it } from 'vitest';
import type { CompatibilityUsage } from '@apiproof/shared';
import { COMPATIBILITY_FIXTURES } from './fixtures/compatibility-fixtures.js';
import { evaluateCompatibility } from '@apiproof/analyzers';

const policy = { compatibilityProviders: new Set(['openai', 'anthropic', 'github', 'twilio', 'supabase']) };
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'u1', providerId: 'openai', packageName: 'openai', operation: 'chat.completions.create', parameter: 'functions',
  evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/chat.ts', line: 12, column: 3, symbol: 'chat.completions.create' }, ...overrides,
});
const change = (providerId = 'openai') => COMPATIBILITY_FIXTURES.find((item) => item.providerId === providerId)!;

describe('generic compatibility engine', () => {
  it('returns AFFECTED for exact affected version and exact usage', () => {
    const result = evaluateCompatibility({ providerId: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', versionConfidence: 'exact', usages: [usage()] , completeEvidence: true }, change(), policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.reasonCodes).toEqual(['VERSION_IN_AFFECTED_RANGE', 'MATCHED_STATIC_USAGE']);
    expect(result.officialSourceReference).toBe('https://platform.openai.com/docs');
    expect(result).toMatchObject({ providerName: 'openai', packageName: 'openai', resolvedVersion: '4.2.0', versionConfidence: 'exact', changeTitle: 'Fixture parameter removal', exactFile: 'src/chat.ts', exactLine: 12, matchedParameter: 'functions', recommendedNextAction: 'MIGRATION_NOT_AVAILABLE', migrationAvailable: false, verificationAvailable: false, provenance: 'synthetic' });
    expect(result.proofEvidence.map((item) => item.kind)).toEqual(['usage', 'version', 'official-source', 'review']);
  });

  it('returns NOT_AFFECTED for an affirmative outside-range version', () => {
    const result = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '5.1.0', usages: [usage()], completeEvidence: true }, change(), policy);
    expect(result.status).toBe('NOT_AFFECTED');
    expect(result.reasonCodes).toContain('VERSION_OUTSIDE_AFFECTED_RANGE');
  });

  it('returns NOT_AFFECTED when the changed API is not used', () => {
    const result = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [usage({ id: 'u2', operation: 'embeddings.create' })], completeEvidence: true }, change(), policy);
    expect(result.status).toBe('NOT_AFFECTED');
    expect(result.reasonCodes).toContain('CHANGED_API_NOT_USED');
  });

  it('returns NEEDS_REVIEW for unknown version plus matching usage', () => {
    const result = evaluateCompatibility({ providerId: 'openai', usages: [usage()], completeEvidence: true }, change(), policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.versionAssessment).toBe('unknown');
  });

  it('treats reviewed API-level changes without an SDK-version range as applicable when static usage is proven', () => {
    const apiChange = {
      ...change(), changeId: 'api-level-removal', changeType: 'endpoint_removed' as const,
      affectedVersionRange: undefined, apiOperationPatterns: ['beta.assistants'], affectedParameters: [],
    };
    const result = evaluateCompatibility({ providerId: 'openai', usages: [usage({ operation: 'beta.assistants.create', parameter: undefined })], completeEvidence: true }, apiChange, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.versionAssessment).toBe('not-constrained');
    expect(result.reasonCodes).toEqual(['VERSION_NOT_CONSTRAINED', 'MATCHED_STATIC_USAGE']);
  });

  it('matches raw HTTP endpoint evidence and model constraints without weakening SDK operation matching', () => {
    const endpointChange = {
      ...change(), changeId: 'endpoint-and-model', affectedParameters: [], apiOperationPatterns: [],
      affectedEndpoints: ['https://api.openai.com/v1/assistants'], affectedModels: ['legacy-model'],
    };
    const matching = usage({ operation: undefined, endpoint: 'https://api.openai.com/v1/assistants/asst_123', model: 'legacy-model' });
    const wrongModel = usage({ id: 'wrong-model', operation: undefined, endpoint: 'https://api.openai.com/v1/assistants/asst_123', model: 'current-model' });
    expect(evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [matching], completeEvidence: true }, endpointChange, policy).status).toBe('AFFECTED');
    expect(evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [wrongModel], completeEvidence: true }, endpointChange, policy).status).toBe('NOT_AFFECTED');
  });

  it('never turns a draft record into AFFECTED', () => {
    const result = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [usage()], completeEvidence: true }, { ...change(), review: { ...change().review, status: 'draft' } }, policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.recommendedNextAction).toBe('MANUAL_REVIEW');
  });

  it('requires official provenance when production policy is enabled', () => {
    const result = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [usage()], completeEvidence: true }, { ...change(), review: { ...change().review, status: 'reviewed', provenance: 'synthetic' } }, { ...policy, requireOfficialProvenance: true });
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('OFFICIAL_PROVENANCE_REQUIRED');
  });

  it('returns NEEDS_REVIEW when usage is dynamic or low confidence', () => {
    const result = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [usage({ static: false, confidence: 0.4 })], completeEvidence: false }, change(), policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('INSUFFICIENT_STATIC_EVIDENCE');
  });

  it('accepts alias/import-resolved and raw HTTP evidence without provider-specific branches', () => {
    const alias = usage({ id: 'alias', evidenceKind: 'import', operation: 'chat.completions.create', packageName: undefined });
    const http = usage({ id: 'http', evidenceKind: 'http', packageName: undefined, operation: undefined, endpoint: 'chat.completions.create' });
    expect(evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [alias], completeEvidence: true }, change(), policy).status).toBe('AFFECTED');
    expect(evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [http], completeEvidence: true }, change(), policy).status).toBe('AFFECTED');
  });

  it('isolates unrelated providers and rejects discovery-only providers', () => {
    const unrelated = evaluateCompatibility({ providerId: 'anthropic', resolvedVersion: '1.2.0', usages: [usage({ providerId: 'openai' })], completeEvidence: true }, change('anthropic'), policy);
    expect(unrelated.status).toBe('NOT_AFFECTED');
    const discoveryOnly = evaluateCompatibility({ providerId: 'cloudflare', resolvedVersion: '1.0.0', usages: [usage({ providerId: 'cloudflare' })], completeEvidence: true }, { ...change(), providerId: 'cloudflare' }, policy);
    expect(discoveryOnly.status).toBe('NEEDS_REVIEW');
    expect(discoveryOnly.reasonCodes).toContain('PROVIDER_COMPATIBILITY_NOT_ENABLED');
    const unrelatedPackage = evaluateCompatibility({ providerId: 'openai', resolvedVersion: '4.2.0', usages: [usage({ packageName: 'not-openai' })], completeEvidence: true }, change(), policy);
    expect(unrelatedPackage.status).toBe('NOT_AFFECTED');
  });

  it('preserves multiple provider changes and deduplicates equivalent evidence paths', () => {
    const first = evaluateCompatibility({ providerId: 'twilio', resolvedVersion: '4.5.0', usages: [usage({ id: 'same', providerId: 'twilio', packageName: 'twilio', operation: 'messages.create', parameter: 'from' }), usage({ id: 'same', providerId: 'twilio', packageName: 'twilio', operation: 'messages.create', parameter: 'from' })], completeEvidence: true }, change('twilio'), policy);
    const second = evaluateCompatibility({ providerId: 'supabase', resolvedVersion: '2.4.0', usages: [usage({ id: 's', providerId: 'supabase', packageName: '@supabase/supabase-js', operation: 'from', responseField: 'data.legacy' })], completeEvidence: true }, change('supabase'), policy);
    expect(first.status).toBe('AFFECTED');
    expect(first.matchedUsages).toHaveLength(1);
    expect(second.status).toBe('AFFECTED');
  });

  it('validates the fixture registry as reviewed, source-linked records', () => {
    expect(COMPATIBILITY_FIXTURES).toHaveLength(5);
    expect(new Set(COMPATIBILITY_FIXTURES.map((item) => item.providerId)).size).toBe(5);
    for (const item of COMPATIBILITY_FIXTURES) expect(item.review.status).toBe('verified');
  });
});
