import { describe, expect, it } from 'vitest';
import {
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  classifySourceUpdate,
  fingerprintCandidate,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';
import { evaluateNormalizedCompatibility, evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { buildCompatibilityProofSnapshot } from '@apiproof/shared';
import type { CompatibilityUsage, NormalizedUsageIR } from '@apiproof/shared';

const CHANGE_ID = 'github-organization-security-fields-removed-2026-04-21';
const RESOURCE = 'get an organization and update an organization REST API endpoints';
const REMOVED_FIELDS = [
  'advanced_security_enabled_for_new_repositories',
  'dependabot_alerts_enabled_for_new_repositories',
  'dependabot_security_updates_enabled_for_new_repositories',
  'dependency_graph_enabled_for_new_repositories',
  'secret_scanning_enabled_for_new_repositories',
  'secret_scanning_push_protection_enabled_for_new_repositories',
  'secret_scanning_validity_checks_enabled',
] as const;
const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CHANGE_ID);
if (!candidate) throw new Error('GITHUB_ORGANIZATION_SECURITY_CANDIDATE_MISSING');

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official GitHub changelog. I approve authoritative applicability at provider + resource + response_field scope for the seven exact organization REST API response fields listed by GitHub. The source identifies GitHub Code Security configurations as the replacement. I do not assert an Octokit package, package version, SDK method, endpoint path, GraphQL applicability, or API-version scope.',
  sourceFingerprint: '53a3e3e386510ad229d78b9ccca3eac343c43596d5e9dd14e79b5a74dc0e9d5a',
  evidenceFingerprint: '58adfc89004241550723c3891f29953e65d03dd752d974932fbc61d54e05c78f',
  candidateFingerprint: '59bb233364fafa44ab4bff7177300bc507a7478ae84f0d7cf001d9522eb9a708',
};
const reviewedCandidate = reviewCandidate(candidate, reviewAction);
const reviewedRecord = promoteCandidateToReviewed(reviewedCandidate, {
  status: 'reviewed', reviewer: reviewAction.reviewer, reviewerKind: 'human', reviewedAt: reviewAction.reviewedAt,
  notes: reviewAction.notes, documentFingerprint: reviewAction.sourceFingerprint,
  evidenceFingerprint: reviewAction.evidenceFingerprint, candidateFingerprint: reviewAction.candidateFingerprint,
}, [{ url: candidate.sourceUrl, summary: 'GitHub removes seven organization REST API response fields on April 21, 2026 and directs integrations to GitHub Code Security configurations.', accessedAt: reviewAction.reviewedAt }]);
const policy = { compatibilityProviders: new Set(['github']), requireOfficialProvenance: true };

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'github-org-usage', providerId: 'github', resource: RESOURCE, responseField: REMOVED_FIELDS[0],
  evidenceKind: 'sdk', confidence: 0.98, static: true,
  location: { file: 'src/github.ts', line: 18, column: 3, symbol: 'organization.secret_scanning_enabled_for_new_repositories' }, ...overrides,
});

const normalize = (input: CompatibilityUsage): NormalizedUsageIR => normalizeCompatibilityUsage(input, { language: 'typescript' });

describe('GitHub organization security response-field candidate', () => {
  it('keeps the canonical candidate pending and applies review only to a separate reviewed copy', () => {
    expect(candidate.state).toBe('needs_review');
    expect(reviewedCandidate.state).toBe('reviewed');
    expect(reviewedCandidate.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed', at: reviewAction.reviewedAt, actor: reviewAction.reviewer, note: reviewAction.notes,
      reviewBinding: {
        documentFingerprint: reviewAction.sourceFingerprint,
        evidenceFingerprint: reviewAction.evidenceFingerprint,
        candidateFingerprint: reviewAction.candidateFingerprint,
      },
    });
  });

  it('preserves refreshed official provenance and remains needs_review', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.documentFingerprint).toBe(reviewAction.sourceFingerprint);
    expect(candidate.evidenceFingerprint).toBe(reviewAction.evidenceFingerprint);
    expect(fingerprintCandidate(candidate)).toBe(reviewAction.candidateFingerprint);
    expect(candidate.payload).toMatchObject({
      changeType: 'response_field_removed', publishedAt: '2026-03-24', removalAt: '2026-04-21',
      applicabilityScope: { dimensions: ['provider', 'resource', 'response_field'] },
      affectedResponseFields: [...REMOVED_FIELDS], affectedResources: [RESOURCE], severity: 'medium',
    });
    expect(candidate.sourceEvidence?.claims.filter((claim) => claim.key === 'protocol')).toEqual([{ key: 'protocol', value: 'REST' }]);
  });

  it('classifies a full-document refresh separately from candidate evidence', () => {
    expect(classifySourceUpdate(candidate, candidate)).toBe('SOURCE_UNCHANGED');
    expect(classifySourceUpdate({ ...candidate, documentFingerprint: '6fc47ac92835a2a1117f59790a4e16ea03e8d71b4aa2b56a2c8820c11c53766f', sourceFingerprint: '6fc47ac92835a2a1117f59790a4e16ea03e8d71b4aa2b56a2c8820c11c53766f' }, candidate)).toBe('DOCUMENT_UPDATED_EVIDENCE_UNCHANGED');
  });

  it('accepts provider + resource + response_field as the generic authoritative scope', () => {
    expect(reviewedRecord.applicabilityScope).toEqual({ dimensions: ['provider', 'resource', 'response_field'] });
    expect(reviewedRecord.affectedResponseFields).toEqual([...REMOVED_FIELDS]);
    expect(reviewedRecord.severity).toBe('medium');
    expect(reviewedRecord.review).toMatchObject({
      status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', provenance: 'official',
      documentFingerprint: reviewAction.sourceFingerprint,
      evidenceFingerprint: reviewAction.evidenceFingerprint,
      candidateFingerprint: reviewAction.candidateFingerprint,
    });
    expect(reviewedRecord.evidence).toEqual([{ url: candidate.sourceUrl, summary: expect.any(String), accessedAt: '2026-10-06' }]);
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.apiOperationPatterns).toEqual([]);
    expect(reviewedRecord.affectedEndpoints).toEqual([]);
  });

  it.each(REMOVED_FIELDS)('marks static access to %s as AFFECTED', (field) => {
    const result = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ id: field, responseField: field }))], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedUsages[0]?.responseField).toBe(field);
  });

  it.each(['typescript', 'python'] as const)('preserves static response-field semantics for %s normalized IR', (language) => {
    const result = evaluateNormalizedCompatibility({
      providerId: 'github',
      usageIR: [normalizeCompatibilityUsage(usage({ responseField: REMOVED_FIELDS[0] }), { language })],
      completeEvidence: true,
    }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedUsages[0]?.responseField).toBe(REMOVED_FIELDS[0]);
  });

  it('marks a resource using only unaffected response fields as NOT_AFFECTED', () => {
    const result = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: 'login', location: { file: 'src/github.ts', line: 22, column: 3 } }))], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('NOT_AFFECTED');
  });

  it('fails closed for dynamic response-field access', () => {
    const result = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: undefined, static: false, confidence: 0.5, location: { file: 'src/github.ts', line: 26, column: 3, symbol: 'organization[fieldName]' } }))], completeEvidence: false }, reviewedRecord, policy);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasonCodes).toContain('RESPONSE_FIELD_UNRESOLVED');
  });

  it('preserves proof metadata for affected, unaffected, and uncertain outcomes', () => {
    const affected = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: REMOVED_FIELDS[0] }))], completeEvidence: true }, reviewedRecord, policy);
    const notAffected = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: 'login' }))], completeEvidence: true }, reviewedRecord, policy);
    const needsReview = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: undefined, static: false, confidence: 0.5 }))], completeEvidence: false }, reviewedRecord, policy);
    const proofFor = (result: typeof affected, scanId: string) => buildCompatibilityProofSnapshot({
      repositoryId: 'github-response-field-review-fixture', baselineSha: 'a'.repeat(40), scanId,
      results: [result], mode: 'test',
    })[0]!;
    const proofs = [
      proofFor(affected, 'github-response-field-affected'),
      proofFor(notAffected, 'github-response-field-not-affected'),
      proofFor(needsReview, 'github-response-field-needs-review'),
    ];
    expect(proofs.map((proof) => proof.status).sort()).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
    const affectedProof = proofs.find((proof) => proof.status === 'AFFECTED');
    expect(affectedProof).toMatchObject({
      providerId: 'github', changeId: CHANGE_ID, officialSourceReference: candidate.sourceUrl,
      reviewStatus: 'reviewed', provenance: 'official', severity: 'medium', removalAt: '2026-04-21',
      replacement: { resources: ['GitHub Code Security configurations'] },
      exactFile: 'src/github.ts', exactLine: 18,
    });
    expect(affectedProof?.matchedUsages[0]).toMatchObject({ responseField: REMOVED_FIELDS[0], resource: RESOURCE, location: { file: 'src/github.ts', line: 18 } });
    expect(proofs.find((proof) => proof.status === 'NEEDS_REVIEW')?.reasonCodes).toContain('RESPONSE_FIELD_UNRESOLVED');
  });

  it('does not claim unrelated providers or resources', () => {
    const unrelatedProvider = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [normalize(usage({ providerId: 'openai', resource: RESOURCE, responseField: REMOVED_FIELDS[0] }))], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(unrelatedProvider.every((result) => result.providerId === 'openai')).toBe(true);
    expect(unrelatedProvider.some((result) => result.changeId === CHANGE_ID)).toBe(false);
    const unrelatedResource = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ resource: 'repository REST API', responseField: REMOVED_FIELDS[0] }))], completeEvidence: true }, reviewedRecord, policy);
    expect(unrelatedResource.status).toBe('NOT_AFFECTED');
  });

  it('evaluates the actual production registry without cross-provider claims', () => {
    const exact = evaluateRegisteredNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: REMOVED_FIELDS[0] }))], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    const dynamic = evaluateRegisteredNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage({ responseField: undefined, static: false, confidence: 0.5 }))], completeEvidence: false }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(exact.filter((result) => result.changeId === CHANGE_ID)).toHaveLength(1);
    expect(exact.find((result) => result.changeId === CHANGE_ID)).toMatchObject({ changeId: CHANGE_ID, status: 'AFFECTED', severity: 'medium', removalAt: '2026-04-21', replacement: { resources: ['GitHub Code Security configurations'] } });
    expect(dynamic.filter((result) => result.changeId === CHANGE_ID)).toHaveLength(1);
    expect(dynamic.find((result) => result.changeId === CHANGE_ID)?.status).toBe('NEEDS_REVIEW');
  });

  it('deduplicates repeated evidence while preserving multiple distinct removed fields', () => {
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'github', usageIR: [
      normalize(usage({ id: 'a', responseField: REMOVED_FIELDS[0], location: { file: 'src/github.ts', line: 30, column: 3 } })),
      normalize(usage({ id: 'b', responseField: REMOVED_FIELDS[1], location: { file: 'src/github.ts', line: 31, column: 3 } })),
      normalize(usage({ id: 'a', responseField: REMOVED_FIELDS[0], location: { file: 'src/github.ts', line: 30, column: 3 } })),
    ], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    const matchingResults = results.filter((result) => result.changeId === CHANGE_ID);
    expect(matchingResults).toHaveLength(1);
    const result = matchingResults[0]!;
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedUsages).toHaveLength(2);
    const proof = buildCompatibilityProofSnapshot({ repositoryId: 'github-response-field-fixture', baselineSha: 'a'.repeat(40), scanId: 'github-response-field-proof', results: [result], mode: 'test' });
    expect(proof[0]).toMatchObject({ providerId: 'github', changeId: CHANGE_ID, status: 'AFFECTED', officialSourceReference: candidate.sourceUrl, reviewStatus: 'reviewed', provenance: 'official' });
  });

  it('keeps the four existing reviewed records unchanged and inserts exactly one GitHub rule', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(9);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('github')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CHANGE_ID)).toBe(true);
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).size).toBe(9);
  });
});
