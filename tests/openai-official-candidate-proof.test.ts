import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, compileProductionChangeRegistry } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26');

if (!candidate) throw new Error('OPENAI_OFFICIAL_CANDIDATE_MISSING');

/**
 * This is deliberately a test-only reviewed projection. It proves that the
 * engine can explain the real candidate after an authorized human review has
 * supplied an SDK scope, but does not mutate, promote, or register the
 * candidate for production.
 */
const reviewedTestProjection: ReviewedCompatibilityChange = {
  providerId: candidate.providerId,
  changeId: candidate.payload.changeId ?? candidate.candidateId,
  title: candidate.payload.title,
  description: candidate.payload.description,
  changeType: candidate.payload.changeType ?? 'endpoint_removed',
  publishedAt: candidate.payload.publishedAt,
  effectiveAt: candidate.payload.effectiveAt,
  removalAt: candidate.payload.removalAt,
  officialSourceUrl: candidate.sourceUrl,
  sourceType: candidate.sourceType,
  applicabilityScope: { dimensions: ['provider', 'resource'] },
  // The official source proves the resource but does not establish SDK fields.
  affectedPackages: undefined,
  apiOperationPatterns: [],
  affectedParameters: candidate.payload.affectedParameters ?? [],
  affectedResponseFields: candidate.payload.affectedResponseFields ?? [],
  affectedEndpoints: candidate.payload.affectedEndpoints ?? [],
  affectedModels: candidate.payload.affectedModels ?? [],
  affectedResources: ['Assistants API'], authOrHeaderPatterns: [],
  replacement: candidate.payload.replacement,
  severity: 'high',
  review: { status: 'reviewed', reviewer: 'test-only human-review simulation', reviewedAt: '2026-10-05', provenance: 'official' },
  evidence: [{
    url: candidate.sourceUrl,
    summary: 'OpenAI documents the Assistants API removal date and recommends the Responses API and Conversations API.',
    accessedAt: '2026-10-05',
  }],
};

const policy = { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true };

const usage = (overrides: Partial<CompatibilityUsage> = {}) =>
  normalizeCompatibilityUsage({
    id: 'openai-assistants-usage',
    providerId: 'openai',
    packageName: 'openai',
    resource: 'Assistants API',
    operation: 'beta.assistants.create',
    evidenceKind: 'sdk',
    confidence: 0.99,
    static: true,
    location: { file: 'src/assistants.ts', line: 18, column: 3, symbol: 'client.beta.assistants.create' },
    ...overrides,
  }, { language: 'typescript', resolvedVersion: '4.55.0', versionSource: 'lockfile', versionConfidence: 'exact' });

describe('real OpenAI candidate compatibility proof', () => {
  it('keeps the official change in the candidate registry and out of production', () => {
    expect(candidate).toMatchObject({
      providerId: 'openai',
      state: 'needs_review',
      sourceType: 'deprecation-notice',
      sourceUrl: 'https://developers.openai.com/api/docs/deprecations',
      sourceFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
      documentFingerprint: '8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a',
      payload: { removalAt: '2026-08-26', applicabilityScope: { dimensions: ['provider', 'resource'] }, affectedResources: ['Assistants API'], severity: 'high' },
    });
    expect(() => compileProductionChangeRegistry(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates)).toThrow();
  });

  it('proves affected, not-affected, and needs-review outcomes from normalized IR in test context only', () => {
    const affected = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage()], completeEvidence: true }, reviewedTestProjection, policy);
    const unaffected = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage({ id: 'responses-usage', resource: 'Responses API', operation: 'responses.create', location: { file: 'src/responses.ts', line: 22, column: 3, symbol: 'client.responses.create' } })], completeEvidence: true }, reviewedTestProjection, policy);
    const uncertain = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage({ id: 'dynamic-assistants-usage', confidence: 0.4, static: false })], completeEvidence: false }, reviewedTestProjection, policy);

    expect(affected).toMatchObject({ status: 'AFFECTED', versionAssessment: 'not-constrained', exactFile: 'src/assistants.ts', exactLine: 18, reasonCodes: ['VERSION_NOT_CONSTRAINED', 'MATCHED_STATIC_USAGE'] });
    expect(unaffected).toMatchObject({ status: 'NOT_AFFECTED', reasonCodes: ['CHANGED_API_NOT_USED'] });
    expect(uncertain).toMatchObject({ status: 'NEEDS_REVIEW', reasonCodes: ['INSUFFICIENT_STATIC_EVIDENCE'] });
  });

  it('builds a repository-bound proof without registering or exposing the candidate', () => {
    const result = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage()], completeEvidence: true }, reviewedTestProjection, policy);
    const [proof] = buildCompatibilityProofSnapshot({
      repositoryId: 'openai-compatibility-proof-fixture',
      baselineSha: 'a'.repeat(40),
      scanId: 'test-openai-assistants-api-sunset',
      results: [result],
      mode: 'test',
    });
    expect(proof).toMatchObject({
      providerId: 'openai',
      packageName: 'openai',
      resolvedVersion: '4.55.0',
      changeId: 'openai-assistants-api-sunset-2026-08-26',
      officialSourceUrl: candidate.sourceUrl,
      status: 'AFFECTED',
      exactFile: 'src/assistants.ts',
      exactLine: 18,
      recommendedNextAction: 'MIGRATION_NOT_AVAILABLE',
    });
  });
});
