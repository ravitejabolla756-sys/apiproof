import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  compileProductionChangeRegistry,
  fingerprintCandidate,
  reviewCandidate,
} from '@apiproof/providers';
import {
  CandidateReviewActionSchema,
  buildCompatibilityProofSnapshot,
  defaultSeverityForChangeType,
} from '@apiproof/shared';
import type { CompatibilityUsage, ReviewedCompatibilityChange, UsageLanguage } from '@apiproof/shared';

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26');
if (!candidate) throw new Error('OPENAI_ASSISTANTS_CANDIDATE_MISSING');

const officialSourceUrl = 'https://developers.openai.com/api/docs/deprecations';
const policy = { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true };

/** Test-only projection of the official facts; it is never added to the production registry. */
const reviewedTestProjection: ReviewedCompatibilityChange = {
  providerId: 'openai',
  changeId: candidate.payload.changeId ?? candidate.candidateId,
  title: candidate.payload.title,
  description: candidate.payload.description,
  changeType: 'endpoint_removed',
  removalAt: '2026-08-26',
  officialSourceUrl,
  sourceType: 'deprecation-notice',
  applicabilityScope: { dimensions: ['provider', 'resource'] },
  affectedPackages: undefined,
  affectedVersionRange: undefined,
  apiOperationPatterns: [],
  affectedParameters: [],
  affectedResponseFields: [],
  affectedEndpoints: [],
  affectedModels: [],
  affectedResources: ['Assistants API'],
  authOrHeaderPatterns: [],
  severity: defaultSeverityForChangeType('endpoint_removed'),
  review: { status: 'reviewed', reviewer: 'test-only human-review simulation', reviewedAt: '2026-10-05', provenance: 'official' },
  evidence: [{ url: officialSourceUrl, summary: 'OpenAI documents Assistants API removal and names Responses API and Conversations API as replacements.', accessedAt: '2026-10-05' }],
};

const usage = (overrides: Partial<CompatibilityUsage> = {}, language: UsageLanguage = 'typescript') => normalizeCompatibilityUsage({
  id: 'assistants-usage', providerId: 'openai', resource: 'Assistants API', evidenceKind: 'sdk', confidence: 0.99, static: true,
  location: { file: 'src/assistants.ts', line: 18, column: 3, symbol: 'Assistants API' }, ...overrides,
}, { language, versionSource: 'unknown', versionConfidence: 'unknown' });

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-05',
  notes: 'I verified the official Assistants API deprecation and removal facts. I approve authoritative applicability at provider + resource scope only; no SDK package, version range, or SDK operation is asserted.',
  sourceFingerprint: candidate.sourceFingerprint,
  candidateFingerprint: fingerprintCandidate(candidate),
  evidenceFingerprint: candidate.evidenceFingerprint,
};

describe('OpenAI Assistants candidate review preparation', () => {
  it('keeps the candidate pending and accepts the proposed generic resource projection only in test context', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.payload.applicabilityScope).toEqual({ dimensions: ['provider', 'resource'] });
    expect(candidate.payload.affectedResources).toEqual(['Assistants API']);
    expect(candidate.documentFingerprint).toBe('8073f6e0f1b66dd6424f8686e270e7bc3f745912a208091223fe2ad6263fb77a');
    expect(candidate.evidenceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(() => CandidateReviewActionSchema.parse(reviewAction)).not.toThrow();
    expect(() => compileProductionChangeRegistry([reviewedTestProjection])).not.toThrow();
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(candidate.candidateId)).toBe(true);
  });

  it('accepts the refreshed evidence binding locally without mutating the registry', () => {
    const reviewed = reviewCandidate(candidate, reviewAction);
    expect(reviewed.state).toBe('reviewed');
    expect(reviewed.evidenceFingerprint).toBe(candidate.evidenceFingerprint);
    expect(candidate.state).toBe('needs_review');
  });

  it.each([
    ['affected', usage(), 'AFFECTED'],
    ['responses-only', usage({ id: 'responses-usage', resource: 'Responses API', location: { file: 'src/responses.ts', line: 22, column: 3, symbol: 'Responses API' } }), 'NOT_AFFECTED'],
    ['dynamic-wrapper', usage({ id: 'dynamic-usage', resource: undefined, confidence: 0.4, static: false }), 'NEEDS_REVIEW'],
    ['unrelated-openai-resource', usage({ id: 'unrelated-openai', resource: 'Files API', location: { file: 'src/files.ts', line: 9, column: 3, symbol: 'Files API' } }), 'NOT_AFFECTED'],
  ] as const)('evaluates %s with complete evidence rules', (_label, item, expected) => {
    const result = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [item], completeEvidence: expected !== 'NEEDS_REVIEW' }, reviewedTestProjection, policy);
    expect(result.status).toBe(expected);
  });

  it('does not create an OpenAI claim for another provider', () => {
    const result = evaluateNormalizedCompatibility({ providerId: 'anthropic', usageIR: [usage({ providerId: 'anthropic' })], completeEvidence: true }, reviewedTestProjection, policy);
    expect(result.status).not.toBe('AFFECTED');
    expect(result.reasonCodes).toContain('PROVIDER_COMPATIBILITY_NOT_ENABLED');
  });

  it('evaluates the same resource semantics for TypeScript and Python IR', () => {
    for (const language of ['typescript', 'python'] as const) {
      const result = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage({}, language)], completeEvidence: true }, reviewedTestProjection, policy);
      expect(result.status, language).toBe('AFFECTED');
      expect(result.matchedUsages[0]?.resource).toBe('Assistants API');
    }
  });

  it('builds proof snapshots for affected, not-affected, and needs-review outcomes', () => {
    const results = [
      evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage()], completeEvidence: true }, reviewedTestProjection, policy),
      evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage({ id: 'responses', resource: 'Responses API', location: { file: 'src/responses.ts', line: 22, column: 3, symbol: 'Responses API' } })], completeEvidence: true }, reviewedTestProjection, policy),
      evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage({ id: 'dynamic', resource: undefined, static: false, confidence: 0.4, location: { file: 'src/wrapper.ts', line: 31, column: 3, symbol: 'client.create' } })], completeEvidence: false }, reviewedTestProjection, policy),
    ];
    const proofs = results.flatMap((result, index) => buildCompatibilityProofSnapshot({ repositoryId: 'openai-assistants-review-fixture', baselineSha: 'a'.repeat(40), scanId: `assistants-review-proof-${index}`, results: [result], mode: 'test' }));
    expect(proofs.map((proof) => proof.status)).toEqual(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']);
    expect(proofs.every((proof) => proof.changeId === candidate.candidateId)).toBe(true);
  });
});
