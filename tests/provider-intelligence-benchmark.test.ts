import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const reviewed = (base: Pick<ReviewedCompatibilityChange, 'providerId' | 'changeId' | 'title' | 'changeType' | 'affectedPackages' | 'apiOperationPatterns' | 'affectedParameters' | 'affectedResponseFields' | 'affectedEndpoints' | 'affectedModels' | 'officialSourceUrl' | 'sourceType'>): ReviewedCompatibilityChange => ({
  ...base, description: 'Test-only projection of an official candidate for the internal benchmark.', applicabilityScope: { dimensions: ['provider', ...(base.affectedPackages.length ? ['package'] : []), ...(base.affectedModels.length ? ['model'] : []), ...(base.affectedEndpoints.length ? ['endpoint'] : []), ...(base.affectedParameters.length ? ['operation', 'parameter'] : []), ...(base.affectedResponseFields.length ? ['operation', 'response_field'] : [])] as never }, affectedResources: [], authOrHeaderPatterns: [], severity: 'high', review: { status: 'reviewed', reviewer: 'benchmark-only', reviewedAt: '2026-10-05', provenance: 'official' }, evidence: [{ url: base.officialSourceUrl, summary: 'Test-only official-source linkage.', accessedAt: '2026-10-05' }],
});

const records = [
  reviewed({ providerId: 'openai', changeId: 'bench-openai-model', title: 'OpenAI model retirement', changeType: 'model_retired', affectedPackages: ['openai'], apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: [], affectedModels: ['gpt-4.5-preview'], officialSourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice' }),
  reviewed({ providerId: 'anthropic', changeId: 'bench-anthropic-model', title: 'Anthropic model retirement', changeType: 'model_retired', affectedPackages: ['@anthropic-ai/sdk'], apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: [], affectedModels: ['claude-opus-4-1-20250805'], officialSourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/model-deprecations', sourceType: 'deprecation-notice' }),
  reviewed({ providerId: 'github', changeId: 'bench-github-sbom', title: 'GitHub SBOM endpoint', changeType: 'endpoint_removed', affectedPackages: ['@octokit/rest'], apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: ['/{owner}/{repo}/dependency-graph/sbom'], affectedModels: [], officialSourceUrl: 'https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/', sourceType: 'official-changelog' }),
  reviewed({ providerId: 'twilio', changeId: 'bench-twilio-domain', title: 'Twilio regional domain', changeType: 'endpoint_removed', affectedPackages: ['twilio'], apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: ['api.ie1.twilio.com'], affectedModels: [], officialSourceUrl: 'https://www.twilio.com/en-us/changelog/deprecation-of-region-specific-twilio-api-domain-patterns', sourceType: 'official-changelog' }),
  reviewed({ providerId: 'supabase', changeId: 'bench-supabase-logs', title: 'Supabase logs endpoint', changeType: 'endpoint_removed', affectedPackages: ['@supabase/supabase-js'], apiOperationPatterns: [], affectedParameters: [], affectedResponseFields: [], affectedEndpoints: ['logs.all'], affectedModels: [], officialSourceUrl: 'https://supabase.com/changelog?types=breaking-change', sourceType: 'official-changelog' }),
];

const cases = records.flatMap((change) => {
  const affected = change.providerId === 'openai' ? { model: 'gpt-4.5-preview' } : change.providerId === 'anthropic' ? { model: 'claude-opus-4-1-20250805' } : { endpoint: change.affectedEndpoints[0] };
  const usage = (id: string, overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({ id, providerId: change.providerId, packageName: change.affectedPackages[0], evidenceKind: 'sdk', confidence: 0.95, static: true, location: { file: `fixtures/${change.providerId}/${id}.ts`, line: 10, column: 1 }, ...affected, ...overrides });
  return [
    { expected: 'AFFECTED' as const, usage: usage('affected') },
    { expected: 'NOT_AFFECTED' as const, usage: usage('unrelated', { operation: 'unrelated.operation', model: undefined, endpoint: undefined }) },
    { expected: 'NEEDS_REVIEW' as const, usage: usage('dynamic', { static: false, confidence: 0.4 }) },
    { expected: 'NOT_AFFECTED' as const, usage: usage('wrong-provider-package', { packageName: '@unrelated/provider-sdk' }) },
    { expected: 'AFFECTED' as const, usage: usage('wrapper-helper', { location: { file: `fixtures/${change.providerId}/wrapper.ts`, line: 42, column: 5, symbol: 'wrappedProviderCall' } }) },
  ].map((item) => ({ ...item, change }));
});

describe('provider intelligence benchmark fixtures', () => {
  it('evaluates 25 internal fixtures with no expected-status mismatches', () => {
    const results = cases.map(({ change, usage, expected }) => ({ expected, actual: evaluateNormalizedCompatibility({ providerId: change.providerId, usageIR: [normalizeCompatibilityUsage(usage, { language: 'typescript', resolvedVersion: '1.0.0', versionSource: 'lockfile', versionConfidence: 'exact' })], completeEvidence: true }, change, { compatibilityProviders: new Set([change.providerId]), requireOfficialProvenance: true }).status }));
    expect(results).toHaveLength(25);
    expect(results.filter(({ expected, actual }) => expected !== actual)).toEqual([]);
    expect(results.filter(({ actual }) => actual === 'AFFECTED')).toHaveLength(10);
    expect(results.filter(({ actual }) => actual === 'NOT_AFFECTED')).toHaveLength(10);
    expect(results.filter(({ actual }) => actual === 'NEEDS_REVIEW')).toHaveLength(5);
  });
});
