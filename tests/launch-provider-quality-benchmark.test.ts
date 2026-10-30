import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, summarizeQualityBenchmark } from '@apiproof/providers';
import type { CandidateChange, CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const LAUNCH_PROVIDER_IDS = [
  'stripe', 'twilio', 'openai', 'firebase', 'github', 'aws', 'google-cloud', 'slack', 'sendgrid', 'shopify',
  'auth0', 'clerk', 'supabase', 'vercel', 'cloudflare', 'launchdarkly', 'elevenlabs', 'groq', 'braintree',
] as const;

const projection = (candidate: CandidateChange): ReviewedCompatibilityChange => {
  const payload = candidate.payload;
  return {
    providerId: candidate.providerId,
    changeId: payload.changeId ?? candidate.candidateId,
    title: payload.title,
    description: payload.description,
    changeType: payload.changeType ?? 'endpoint_removed',
    publishedAt: payload.publishedAt,
    effectiveAt: payload.effectiveAt,
    removalAt: payload.removalAt,
    officialSourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType,
    applicabilityScope: payload.applicabilityScope ?? { dimensions: ['provider'] },
    affectedPackages: payload.affectedPackages ?? [],
    affectedVersionRange: payload.affectedVersionRange,
    apiOperationPatterns: payload.apiOperationPatterns ?? [],
    affectedParameters: payload.affectedParameters ?? [],
    affectedResponseFields: payload.affectedResponseFields ?? [],
    affectedEndpoints: payload.affectedEndpoints ?? [],
    affectedDomains: payload.affectedDomains ?? [],
    affectedModels: payload.affectedModels ?? [],
    affectedResources: payload.affectedResources ?? [],
    authOrHeaderPatterns: payload.authOrHeaderPatterns ?? [],
    parameterConditions: payload.parameterConditions,
    apiVersionMetadata: payload.apiVersionMetadata,
    enumMetadata: payload.enumMetadata,
    replacement: payload.replacement,
    severity: payload.severity ?? 'high',
    review: { status: 'reviewed', reviewer: 'fixture-benchmark-only', reviewedAt: '2026-10-29', provenance: 'official' },
    evidence: [{ url: candidate.sourceUrl, summary: 'Test-only projection of an official candidate; not a production approval.', accessedAt: '2026-10-29' }],
  };
};

const usageFor = (candidate: CandidateChange, id: string, mode: 'affected' | 'unaffected' | 'uncertain'): CompatibilityUsage => {
  const payload = candidate.payload;
  const unrelated = mode === 'unaffected';
  return {
    id,
    providerId: candidate.providerId,
    packageName: unrelated ? 'unrelated-package' : payload.affectedPackages?.[0],
    model: unrelated ? 'unrelated-model' : payload.affectedModels?.[0],
    endpoint: unrelated ? '/unrelated-endpoint' : payload.affectedEndpoints?.[0],
    domain: unrelated ? 'unrelated.example.com' : payload.affectedDomains?.[0],
    resource: unrelated ? 'unrelated-resource' : payload.affectedResources?.[0],
    operation: unrelated ? 'unrelated.operation' : payload.apiOperationPatterns?.[0],
    parameter: unrelated ? 'unrelatedParameter' : payload.affectedParameters?.[0],
    responseField: unrelated ? 'unrelated_field' : payload.affectedResponseFields?.[0],
    authOrHeader: unrelated ? 'unrelated-credential' : payload.authOrHeaderPatterns?.[0],
    apiVersion: unrelated ? 'unrelated-version' : payload.apiVersionMetadata?.version,
    evidenceKind: payload.affectedEndpoints?.length || payload.affectedDomains?.length ? 'http' : 'sdk',
    confidence: mode === 'uncertain' ? 0.4 : 0.95,
    static: mode !== 'uncertain',
    location: { file: `fixtures/${candidate.providerId}/${id}.ts`, line: 10, column: 1 },
  };
};

describe('launch-provider offline quality benchmark', () => {
  it('covers affected, unaffected, and uncertain outcomes for all 19 launch providers', () => {
    const cases = LAUNCH_PROVIDER_IDS.map((providerId) => {
      const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.find((item) => item.providerId === providerId);
      expect(candidate, providerId).toBeDefined();
      return candidate!;
    }).flatMap((candidate) => {
      const change = projection(candidate);
      return (['affected', 'unaffected', 'uncertain'] as const).map((mode) => ({ candidate, change, mode }));
    });

    const results = cases.map(({ candidate, change, mode }) => {
      const payload = candidate.payload;
      const usage = normalizeCompatibilityUsage(usageFor(candidate, mode, mode), {
        language: 'typescript',
        versionSource: 'lockfile',
        versionConfidence: 'exact',
        resolvedVersion: mode === 'unaffected' ? '1.0.0' : payload.affectedVersionRange ? '2.1.0' : null,
      });
      const actual = evaluateNormalizedCompatibility(
        { providerId: candidate.providerId, usageIR: [usage], completeEvidence: true },
        change,
        { compatibilityProviders: new Set([candidate.providerId]), requireOfficialProvenance: true },
      ).status;
      return { providerId: candidate.providerId, mode, actual };
    });

    const report = summarizeQualityBenchmark(results.map((result) => ({
      providerId: result.providerId,
      expected: result.mode === 'affected' ? 'AFFECTED' : result.mode === 'unaffected' ? 'NOT_AFFECTED' : 'NEEDS_REVIEW',
      actual: result.actual,
    })));

    expect(report).toMatchObject({
      totalCases: 57,
      correctCases: 57,
      incorrectCases: 0,
      accuracy: 1,
      affectedCases: 19,
      affectedDetected: 19,
      unaffectedCases: 19,
      falsePositiveCases: 0,
      uncertainCases: 19,
      uncertainPreserved: 19,
      providersCovered: [...LAUNCH_PROVIDER_IDS].sort(),
    });
  });
});
