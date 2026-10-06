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

const CHANGE_ID = 'github-synchronous-sbom-endpoint-removal-2026-11-13';
const SOURCE_URL = 'https://github.blog/changelog/2026-05-12-synchronous-sbom-api-deprecated/';
const OLD_ENDPOINT = '/{owner}/{repo}/dependency-graph/sbom';
const NEW_ENDPOINT = '/{owner}/{repo}/dependency-graph/sbom/generate-report';
const DOCUMENT_FINGERPRINT = 'f509f8d68a1bd919c655c0d367a998f233829c53a5c4e7431cd9b45bea1d16f0';
const EVIDENCE_FINGERPRINT = '4fa080a36ae032f8b589028bbc74233d8aa43a6a1625bc2037d85f9b1cd5f81f';
const CANDIDATE_FINGERPRINT = 'd88ec47a8f030ce6f4e318c70ddc6880ee310ac8c6c107ee8e5af06c94680bec';

const candidate = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.byCandidateId.get(CHANGE_ID);
if (!candidate) throw new Error('GITHUB_SBOM_CANDIDATE_MISSING');

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-06',
  notes: 'I verified the official GitHub changelog. I approve authoritative applicability at provider + endpoint scope for the exact synchronous SBOM REST endpoint and its documented asynchronous generate-report replacement. I do not assert an Octokit package, package version, SDK method, GraphQL operation, or API-version scope.',
  sourceFingerprint: DOCUMENT_FINGERPRINT,
  evidenceFingerprint: EVIDENCE_FINGERPRINT,
  candidateFingerprint: CANDIDATE_FINGERPRINT,
};
const reviewedCandidate = reviewCandidate(candidate, reviewAction);
const reviewedRecord = promoteCandidateToReviewed(reviewedCandidate, {
  status: 'reviewed', reviewer: reviewAction.reviewer, reviewerKind: 'human', reviewedAt: reviewAction.reviewedAt,
  notes: reviewAction.notes, documentFingerprint: reviewAction.sourceFingerprint,
  evidenceFingerprint: reviewAction.evidenceFingerprint, candidateFingerprint: reviewAction.candidateFingerprint,
}, [{ url: SOURCE_URL, summary: 'GitHub deprecated the synchronous SBOM REST endpoint and documents an asynchronous replacement that returns a URL to poll.', accessedAt: reviewAction.reviewedAt }]);
const policy = { compatibilityProviders: new Set(['github']), requireOfficialProvenance: true };

const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'github-sbom-usage', providerId: 'github', endpoint: OLD_ENDPOINT,
  evidenceKind: 'http', confidence: 0.98, static: true,
  location: { file: 'src/github.ts', line: 12, column: 1, symbol: 'fetch' }, ...overrides,
});
const normalize = (input: CompatibilityUsage, language: NormalizedUsageIR['language'] = 'typescript'): NormalizedUsageIR => normalizeCompatibilityUsage(input, { language });
const evaluate = (input: CompatibilityUsage) => evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(input)], completeEvidence: true }, reviewedRecord, policy);

describe('GitHub synchronous SBOM endpoint candidate', () => {
  it('refreshes the official candidate without changing its pending lifecycle state', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.documentFingerprint).toBe(DOCUMENT_FINGERPRINT);
    expect(candidate.evidenceFingerprint).toBe(EVIDENCE_FINGERPRINT);
    expect(fingerprintCandidate(candidate)).toBe(CANDIDATE_FINGERPRINT);
    expect(candidate.payload).toMatchObject({
      changeType: 'endpoint_removed', publishedAt: '2026-05-12', removalAt: '2026-11-13',
      applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: [OLD_ENDPOINT],
      replacement: { endpoint: NEW_ENDPOINT }, severity: 'high',
    });
    expect(candidate.payload.affectedPackages).toBeUndefined();
    expect(candidate.payload.apiOperationPatterns).toBeUndefined();
  });

  it('classifies document-only refreshes independently from candidate evidence', () => {
    expect(classifySourceUpdate(candidate, candidate)).toBe('SOURCE_UNCHANGED');
    expect(classifySourceUpdate({ ...candidate, documentFingerprint: 'ed5df24cbd18fa32b063058ffc84b894f1350f8a530961e526fb01fa13b69808', sourceFingerprint: 'ed5df24cbd18fa32b063058ffc84b894f1350f8a530961e526fb01fa13b69808' }, candidate)).toBe('DOCUMENT_UPDATED_EVIDENCE_UNCHANGED');
  });

  it('creates a separate reviewed projection with exact endpoint scope and official provenance', () => {
    expect(reviewedCandidate.state).toBe('reviewed');
    expect(reviewedRecord).toMatchObject({
      providerId: 'github', changeId: CHANGE_ID, changeType: 'endpoint_removed', removalAt: '2026-11-13',
      applicabilityScope: { dimensions: ['provider', 'endpoint'] }, affectedEndpoints: [OLD_ENDPOINT],
      severity: 'high', replacement: { endpoint: NEW_ENDPOINT },
      review: {
        status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-06', provenance: 'official',
        documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT,
      },
    });
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.affectedVersionRange).toBeUndefined();
    expect(reviewedRecord.apiOperationPatterns).toEqual([]);
  });

  it('evaluates exact, replacement, unrelated, and dynamic endpoints conservatively', () => {
    expect(evaluate(usage()).status).toBe('AFFECTED');
    expect(evaluate(usage({ endpoint: NEW_ENDPOINT })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ endpoint: '/{owner}/{repo}/contents/README.md' })).status).toBe('NOT_AFFECTED');
    const dynamic = evaluate(usage({ endpoint: undefined, static: false, confidence: 0.5, location: { file: 'src/github.ts', line: 20, column: 1, symbol: 'fetch(url)' } }));
    expect(dynamic.status).toBe('NEEDS_REVIEW');
    expect(dynamic.reasonCodes).toContain('ENDPOINT_UNRESOLVED');
  });

  it.each(['typescript', 'python'] as const)('keeps endpoint semantics language-neutral for %s IR', (language) => {
    const result = evaluateNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage(), language)], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedEndpoint).toBe(OLD_ENDPOINT);
  });

  it('does not claim unrelated providers and leaves the actual production registry unchanged', () => {
    const unrelatedProvider = evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [normalize(usage({ providerId: 'openai' }))], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(unrelatedProvider.some((result) => result.changeId === CHANGE_ID)).toBe(false);
    expect(evaluateRegisteredNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage())], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).some((result) => result.changeId === CHANGE_ID)).toBe(true);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(6);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('openai')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('anthropic')).toHaveLength(2);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('github')).toHaveLength(2);
  });

  it('evaluates the inserted rule through the actual production registry without crossing the response-field rule', () => {
    const results = evaluateRegisteredNormalizedCompatibility({ providerId: 'github', usageIR: [normalize(usage())], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(results.filter((result) => result.status === 'AFFECTED').map((result) => result.changeId)).toEqual([CHANGE_ID]);
  });

  it('preserves proof evidence for affected, unaffected, and uncertain outcomes', () => {
    const affected = evaluate(usage());
    const notAffected = evaluate(usage({ endpoint: NEW_ENDPOINT }));
    const needsReview = evaluate(usage({ endpoint: undefined, static: false, confidence: 0.5 }));
    const proofFor = (result: typeof affected, scanId: string) => buildCompatibilityProofSnapshot({
      repositoryId: 'github-sbom-review-fixture', baselineSha: 'a'.repeat(40), scanId, results: [result], mode: 'test',
    })[0]!;
    const proofs = [
      proofFor(affected, 'github-sbom-affected'),
      proofFor(notAffected, 'github-sbom-not-affected'),
      proofFor(needsReview, 'github-sbom-needs-review'),
    ];
    expect(proofs.map((proof) => proof.status).sort()).toEqual(['AFFECTED', 'NEEDS_REVIEW', 'NOT_AFFECTED']);
    expect(proofs.find((proof) => proof.status === 'AFFECTED')).toMatchObject({
      providerId: 'github', changeId: CHANGE_ID, officialSourceReference: SOURCE_URL,
      reviewStatus: 'reviewed', provenance: 'official', severity: 'high', removalAt: '2026-11-13',
      replacement: { endpoint: NEW_ENDPOINT }, exactFile: 'src/github.ts', exactLine: 12,
    });
    expect(proofs.find((proof) => proof.status === 'NEEDS_REVIEW')?.reasonCodes).toContain('ENDPOINT_UNRESOLVED');
  });
});
