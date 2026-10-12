import { describe, expect, it } from 'vitest';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { EXPANSION_OFFICIAL_CHANGE_CANDIDATES } from '@apiproof/providers';
import type { CompatibilityUsage, ReviewedCompatibilityChange } from '@apiproof/shared';
import { createHash } from 'node:crypto';

const projection = (candidate: (typeof EXPANSION_OFFICIAL_CHANGE_CANDIDATES)[number]): ReviewedCompatibilityChange => {
  const payload = candidate.payload;
  return {
    providerId: candidate.providerId, changeId: payload.changeId ?? candidate.candidateId, title: payload.title, description: payload.description,
    changeType: payload.changeType!, applicabilityScope: payload.applicabilityScope!, officialSourceUrl: candidate.sourceUrl, sourceType: candidate.sourceType,
    affectedPackages: payload.affectedPackages, affectedVersionRange: payload.affectedVersionRange,
    apiOperationPatterns: payload.apiOperationPatterns ?? [], affectedParameters: payload.affectedParameters ?? [], affectedResponseFields: payload.affectedResponseFields ?? [],
    affectedEndpoints: payload.affectedEndpoints ?? [], affectedDomains: payload.affectedDomains, affectedModels: payload.affectedModels ?? [], affectedResources: payload.affectedResources ?? [],
    authOrHeaderPatterns: payload.authOrHeaderPatterns ?? [], parameterConditions: payload.parameterConditions, apiVersionMetadata: payload.apiVersionMetadata, enumMetadata: payload.enumMetadata, replacement: payload.replacement, severity: payload.severity ?? 'medium',
    review: { status: 'reviewed', reviewer: 'benchmark-only', reviewedAt: '2026-10-08', provenance: 'official', documentFingerprint: candidate.sourceFingerprint, evidenceFingerprint: candidate.evidenceFingerprint, candidateFingerprint: createHash('sha256').update(candidate.candidateId).digest('hex') },
    evidence: [{ url: candidate.sourceUrl, summary: 'Test-only projection of an unreviewed official candidate.', accessedAt: '2026-10-08' }],
  };
};

const targetOf = (change: ReviewedCompatibilityChange): Partial<CompatibilityUsage> => ({
  packageName: change.affectedPackages?.[0],
  model: change.affectedModels[0], endpoint: change.affectedEndpoints[0], operation: change.apiOperationPatterns[0], parameter: change.affectedParameters[0],
  responseField: change.affectedResponseFields[0], resource: change.affectedResources[0], domain: change.affectedDomains?.[0], authOrHeader: change.authOrHeaderPatterns[0], apiVersion: change.apiVersionMetadata?.version,
});

const benchmarkVersion = (change: ReviewedCompatibilityChange): string | undefined => {
  if (!change.affectedVersionRange) return undefined;
  return change.affectedVersionRange.startsWith('>=') ? '2.0.0' : change.affectedVersionRange.startsWith('<') ? '0.181.0' : undefined;
};

describe('provider expansion benchmark', () => {
  it('covers three meaningful outcomes for every verified expansion candidate', () => {
    const cases = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.flatMap((candidate) => {
      const change = projection(candidate);
      const target = targetOf(change);
      const base: CompatibilityUsage = { id: `${candidate.candidateId}:affected`, providerId: candidate.providerId, evidenceKind: 'sdk', confidence: 0.95, static: true, location: { file: `fixtures/${candidate.providerId}.ts`, line: 10, column: 1 }, ...target };
      const wrong: CompatibilityUsage = { ...base, id: `${candidate.candidateId}:wrong`, providerId: 'unrelated-provider', model: undefined, endpoint: undefined, operation: undefined, parameter: undefined, responseField: undefined, resource: undefined, domain: undefined, authOrHeader: undefined, apiVersion: undefined };
      const dynamic: CompatibilityUsage = { ...base, id: `${candidate.candidateId}:dynamic`, static: false, confidence: 0.35 };
      return [{ change, usage: base, expected: 'AFFECTED' as const }, { change, usage: wrong, expected: 'NOT_AFFECTED' as const }, { change, usage: dynamic, expected: 'NEEDS_REVIEW' as const }];
    });
    expect(cases).toHaveLength(EXPANSION_OFFICIAL_CHANGE_CANDIDATES.length * 3);
    const results = cases.map(({ change, usage, expected }) => ({ expected, actual: evaluateNormalizedCompatibility({ providerId: usage.providerId, usageIR: [normalizeCompatibilityUsage(usage, { language: 'typescript', declaredVersion: benchmarkVersion(change) ?? null, resolvedVersion: benchmarkVersion(change) ?? null, versionSource: 'lockfile', versionConfidence: 'exact' })], completeEvidence: true }, change, { compatibilityProviders: new Set([usage.providerId]), requireOfficialProvenance: true }).status }));
    expect(results.filter(({ expected, actual }) => expected !== actual)).toEqual([]);
  });
});
