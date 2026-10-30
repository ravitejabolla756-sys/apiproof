import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage, TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { OFFICIAL_CHANGE_CANDIDATE_REGISTRY } from '@apiproof/providers';
import type { CandidateChange, CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';

const packageFor = (candidate: CandidateChange): string => candidate.providerId === 'anthropic' ? '@anthropic-ai/sdk' : candidate.providerId === 'supabase' ? '@supabase/supabase-js' : candidate.providerId === 'github' ? '@octokit/rest' : candidate.providerId;

const reviewedProjection = (candidate: CandidateChange): ReviewedCompatibilityChange => ({
  providerId: candidate.providerId, changeId: candidate.payload.changeId ?? candidate.candidateId, title: candidate.payload.title,
  description: candidate.payload.description, changeType: candidate.payload.changeType ?? 'endpoint_removed', publishedAt: candidate.payload.publishedAt,
  effectiveAt: candidate.payload.effectiveAt, removalAt: candidate.payload.removalAt, officialSourceUrl: candidate.sourceUrl, sourceType: candidate.sourceType,
  applicabilityScope: candidate.payload.applicabilityScope ?? { dimensions: ['provider', 'package'] }, affectedPackages: candidate.payload.affectedPackages ?? [packageFor(candidate)], affectedVersionRange: candidate.payload.affectedVersionRange,
  apiOperationPatterns: candidate.payload.apiOperationPatterns ?? [], affectedParameters: candidate.payload.affectedParameters ?? [],
  affectedResponseFields: candidate.payload.affectedResponseFields ?? [], affectedEndpoints: candidate.payload.affectedEndpoints ?? [], affectedDomains: candidate.payload.affectedDomains ?? [],
  affectedModels: candidate.payload.affectedModels ?? [], affectedResources: candidate.payload.affectedResources ?? [], authOrHeaderPatterns: candidate.payload.authOrHeaderPatterns ?? [], enumMetadata: candidate.payload.enumMetadata, apiVersionMetadata: candidate.payload.apiVersionMetadata,
  replacement: candidate.payload.replacement, severity: candidate.payload.severity ?? 'high',
  review: { status: 'reviewed', reviewer: 'test-only candidate projection', reviewedAt: '2026-10-05', provenance: 'official' },
  evidence: [{ url: candidate.sourceUrl, summary: 'Test-only projection; not a production review.', accessedAt: '2026-10-05' }],
});

const usageFor = (candidate: CandidateChange, id: string, changed: boolean, dynamic = false): CompatibilityUsage => {
  const payload = candidate.payload;
  const usage: CompatibilityUsage = { id, providerId: candidate.providerId, packageName: packageFor(candidate), evidenceKind: payload.affectedEndpoints?.length || payload.affectedDomains?.length ? 'http' : 'sdk', confidence: dynamic ? 0.4 : 0.95, static: !dynamic, location: { file: `fixtures/${candidate.candidateId}/${id}.ts`, line: 10, column: 1 } };
  if (changed) {
    usage.endpoint = payload.affectedEndpoints?.[0];
    usage.domain = payload.affectedDomains?.[0];
    usage.model = payload.affectedModels?.[0];
    usage.apiVersion = payload.apiVersionMetadata?.version;
    usage.resource = payload.affectedResources?.[0];
    usage.parameter = payload.affectedParameters?.[0];
    usage.authOrHeader = payload.authOrHeaderPatterns?.[0];
    usage.responseField = payload.affectedResponseFields?.[0];
  } else {
    usage.operation = 'unrelated.operation';
  }
  return usage;
};

const candidatesWithConcreteScope = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.filter((candidate) => candidate.payload.applicabilityScope?.dimensions.some((dimension) => ['model', 'endpoint', 'domain', 'resource'].includes(dimension)));

describe('official candidate fixture coverage', () => {
  it('covers affected, unaffected, and uncertain outcomes for every concretely scoped candidate', () => {
    expect(candidatesWithConcreteScope.length).toBeGreaterThan(0);
    for (const candidate of candidatesWithConcreteScope) {
      const change = reviewedProjection(candidate);
      const evaluate = (id: string, changed: boolean, dynamic = false) => evaluateNormalizedCompatibility({ providerId: candidate.providerId, usageIR: [normalizeCompatibilityUsage(usageFor(candidate, id, changed, dynamic), { language: 'typescript', resolvedVersion: '1.0.0', versionSource: 'lockfile', versionConfidence: 'exact' })], completeEvidence: true }, change, { compatibilityProviders: new Set([candidate.providerId]), requireOfficialProvenance: true }).status;
      expect(evaluate('affected', true), candidate.candidateId).toBe('AFFECTED');
      expect(evaluate('unaffected', false), candidate.candidateId).toBe('NOT_AFFECTED');
      expect(evaluate('uncertain', true, true), candidate.candidateId).toBe('NEEDS_REVIEW');
    }
  });

  it('keeps the Assistants candidate pending despite its now-proven resource scope', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('openai-assistants-api-sunset-2026-08-26')!;
    expect(candidate.payload.applicabilityScope).toEqual({ dimensions: ['provider', 'resource'] });
    expect(candidate.payload.affectedResources).toEqual(['Assistants API']);
    expect(candidate.payload.apiOperationPatterns).toBeUndefined();
    expect(candidate.payload.affectedPackages).toBeUndefined();
    expect(candidate.state).toBe('needs_review');
  });

  it('proves Firebase import-alias evidence reaches the compatibility engine without production promotion', async () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('firebase-vertexai-import-alias-removed-2025-07-17')!;
    const change = reviewedProjection(candidate);
    const scan = await new TypeScriptRepositoryAnalyzer().analyze(new Map([
      ['package.json', JSON.stringify({ dependencies: { firebase: '^12.0.0' } })],
      ['src/ai.ts', "import { getVertexAI } from 'firebase/vertexai'; export const ai = getVertexAI();"],
    ]), { id: 'firebase', packageName: 'firebase', constructorExports: [] });
    const resourceUsage = scan.usageIR?.find((usage) => usage.resource === 'firebase/vertexai');
    expect(resourceUsage).toBeDefined();
    if (!resourceUsage) throw new Error('FIREBASE_RESOURCE_USAGE_NOT_FOUND');
    const result = evaluateNormalizedCompatibility({ providerId: 'firebase', usageIR: [resourceUsage], completeEvidence: true }, change, { compatibilityProviders: new Set(['firebase']), requireOfficialProvenance: true });
    expect(result.status).toBe('AFFECTED');
    expect(candidate.state).toBe('needs_review');
  });

  it('keeps Slack method evidence bound to the exact resource identifier', () => {
    const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get('slack-files-upload-retired-2025-03-11')!;
    expect(candidate.payload.affectedResources).toEqual(['files.upload']);
    expect(candidate.sourceEvidence?.claims).toContainEqual({ key: 'method', value: 'files.upload' });
    expect(candidate.state).toBe('needs_review');
  });
});
