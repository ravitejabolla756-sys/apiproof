import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY, fingerprintCandidate } from '@apiproof/providers';
import { buildCompatibilityProofSnapshot, CandidateReviewActionSchema } from '@apiproof/shared';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-gpt-4-5-preview-removal-2025-07-14');
if (!candidate) throw new Error('OPENAI_GPT45_CANDIDATE_MISSING');

const reviewedTestProjection: ReviewedCompatibilityChange = {
  providerId: candidate.providerId,
  changeId: candidate.payload.changeId ?? candidate.candidateId,
  title: candidate.payload.title,
  description: candidate.payload.description,
  changeType: candidate.payload.changeType ?? 'model_retired',
  publishedAt: candidate.payload.publishedAt,
  effectiveAt: candidate.payload.effectiveAt,
  removalAt: candidate.payload.removalAt,
  officialSourceUrl: candidate.sourceUrl,
  sourceType: candidate.sourceType,
  applicabilityScope: { dimensions: ['provider', 'model'] },
  affectedPackages: ['openai'],
  apiOperationPatterns: [],
  affectedParameters: [],
  affectedResponseFields: [],
  affectedEndpoints: [],
  affectedModels: candidate.payload.affectedModels ?? ['gpt-4.5-preview'],
  affectedResources: [],
  authOrHeaderPatterns: [],
  replacement: { model: 'gpt-4.1' },
  severity: 'high',
  review: { status: 'reviewed', reviewer: 'test-only human-review simulation', reviewedAt: '2026-10-05', provenance: 'official' },
  evidence: [{ url: candidate.sourceUrl, summary: 'OpenAI documents the gpt-4.5-preview deprecation, 2025-07-14 shutdown, and gpt-4.1 replacement.', accessedAt: '2026-10-05' }],
};

const policy = { compatibilityProviders: new Set(['openai']), requireOfficialProvenance: true };
const usage = (language: 'typescript' | 'python' | 'go', model: string | undefined, overrides: Partial<CompatibilityUsage> = {}) =>
  normalizeCompatibilityUsage({
    id: `${language}-${model ?? 'dynamic'}`,
    providerId: 'openai', packageName: 'openai', model, evidenceKind: 'sdk', confidence: model ? 0.99 : 0.4,
    static: Boolean(model), location: { file: `fixture.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go'}`, line: 12, column: 1, symbol: 'model', },
    ...overrides,
  }, { language, resolvedVersion: '4.55.0', versionSource: 'lockfile', versionConfidence: 'exact' });

const proof = (result: unknown, suffix: string) => buildCompatibilityProofSnapshot({
  repositoryId: 'openai-gpt45-review-fixture', baselineSha: 'b'.repeat(40), scanId: `openai-gpt45-${suffix}`, results: [result], mode: 'test',
})[0];

describe('OpenAI gpt-4.5-preview human-review preparation', () => {
  it('matches the freshly reverified official facts without inventing SDK scope', () => {
    expect(candidate).toMatchObject({
      providerId: 'openai', state: 'needs_review', sourceUrl: 'https://developers.openai.com/api/docs/deprecations',
      sourceFingerprint: '43a958b451b0eb3578988d263341f8ed4a4a7f260e96d5cd5ed89abaf30ba522',
      payload: { publishedAt: '2025-04-14', removalAt: '2025-07-14', affectedModels: ['gpt-4.5-preview'] },
    });
    expect(candidate.payload.affectedPackages).toBeUndefined();
    expect(candidate.payload.affectedVersionRange).toBeUndefined();
  });

  it('validates but does not execute the explicit human approval input', () => {
    const input = CandidateReviewActionSchema.parse({
      decision: 'approve-for-promotion-review', reviewer: '<human identity>', reviewedAt: '2026-10-05',
      notes: 'I verified the official OpenAI source, model, shutdown date, replacement, and candidate fingerprint.',
      sourceFingerprint: candidate.sourceFingerprint, candidateFingerprint: fingerprintCandidate(candidate),
    });
    expect(input.decision).toBe('approve-for-promotion-review');
    expect(candidate.state).toBe('needs_review');
  });

  it('proves affected, not-affected, and needs-review outcomes across TS, Python, and Go IR', () => {
    for (const language of ['typescript', 'python', 'go'] as const) {
      const affected = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage(language, 'gpt-4.5-preview')], completeEvidence: true }, reviewedTestProjection, policy);
      const unaffected = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage(language, 'gpt-4.1')], completeEvidence: true }, reviewedTestProjection, policy);
      const uncertain = evaluateNormalizedCompatibility({ providerId: 'openai', usageIR: [usage(language, undefined)], completeEvidence: false }, reviewedTestProjection, policy);
      expect(affected.status).toBe('AFFECTED');
      expect(unaffected.status).toBe('NOT_AFFECTED');
      expect(uncertain.status).toBe('NEEDS_REVIEW');
      expect(proof(affected, `${language}-affected`)).toMatchObject({ status: 'AFFECTED', exactFile: `fixture.${language === 'typescript' ? 'ts' : language === 'python' ? 'py' : 'go'}` });
      expect(proof(unaffected, `${language}-unaffected`)).toMatchObject({ status: 'NOT_AFFECTED' });
      expect(proof(uncertain, `${language}-uncertain`)).toMatchObject({ status: 'NEEDS_REVIEW' });
    }
  });
});
