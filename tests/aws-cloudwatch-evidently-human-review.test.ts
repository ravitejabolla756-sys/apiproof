import { describe, expect, it } from 'vitest';
import {
  EXPANSION_OFFICIAL_CHANGE_CANDIDATES,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  fingerprintCandidate,
  promoteCandidateToReviewed,
  reviewCandidate,
} from '@apiproof/providers';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import type { CompatibilityUsage } from '@apiproof/shared';

const CANDIDATE_ID = 'aws-cloudwatch-evidently-end-of-support-2025-10-16';
const DOCUMENT_FINGERPRINT = 'd9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9';
const EVIDENCE_FINGERPRINT = '3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c';
const CANDIDATE_FINGERPRINT = 'b5d9edc8aa05ef59598bfe100656a3fe151af9c1b2f8111ddbf5e24f6b3c6d0d';
const NOTES = "I verified AWS's official CloudWatch document history notice that support for Amazon CloudWatch Evidently ends on 2025-10-16 and that the console and Evidently resources become unavailable after end of support. I approve provider + resource applicability for Amazon CloudWatch Evidently only. I do not assert a replacement service, SDK package, SDK version, or SDK operation.";

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja',
  reviewedAt: '2026-10-08',
  notes: NOTES,
  sourceFingerprint: DOCUMENT_FINGERPRINT,
  evidenceFingerprint: EVIDENCE_FINGERPRINT,
  candidateFingerprint: CANDIDATE_FINGERPRINT,
};

const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((entry) => entry.candidateId === CANDIDATE_ID)!;

const policy = {
  compatibilityProviders: new Set(['aws']),
  requireOfficialProvenance: true,
};

function usage(overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage {
  return {
    id: 'aws-evidently',
    providerId: 'aws',
    resource: 'Amazon CloudWatch Evidently',
    evidenceKind: 'sdk',
    confidence: 0.99,
    static: true,
    location: { file: 'fixtures/aws-evidently.ts', line: 10, column: 1 },
    ...overrides,
  };
}

describe('AWS CloudWatch Evidently human-review projection', () => {
  it('recomputes the packet bindings and keeps the canonical candidate review-gated', () => {
    expect(candidate).toBeDefined();
    expect(candidate.state).toBe('needs_review');
    expect(candidate.sourceFingerprint).toBe(DOCUMENT_FINGERPRINT);
    expect(candidate.evidenceFingerprint).toBe(EVIDENCE_FINGERPRINT);
    expect(fingerprintCandidate(candidate)).toBe(CANDIDATE_FINGERPRINT);
    expect(candidate.payload).toMatchObject({
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      affectedResources: ['Amazon CloudWatch Evidently'],
      removalAt: '2025-10-16',
      severity: 'high',
    });
    expect(candidate.payload).not.toHaveProperty('affectedPackages');
    expect(candidate.payload).not.toHaveProperty('affectedVersionRange');
    expect(candidate.payload).not.toHaveProperty('apiOperationPatterns');

    const reviewed = reviewCandidate(candidate, reviewAction);
    expect(candidate.state).toBe('needs_review');
    expect(reviewed.state).toBe('reviewed');
    expect(reviewed.auditTrail.at(-1)).toMatchObject({ state: 'reviewed', actor: 'Ravi Teja', note: NOTES });
    expect(reviewed.auditTrail.at(-1)?.reviewBinding).toMatchObject({
      documentFingerprint: DOCUMENT_FINGERPRINT,
      evidenceFingerprint: EVIDENCE_FINGERPRINT,
      candidateFingerprint: CANDIDATE_FINGERPRINT,
    });

    const promoted = promoteCandidateToReviewed(reviewed, {
      status: 'reviewed',
      reviewer: 'Ravi Teja',
      reviewerKind: 'human',
      reviewedAt: '2026-10-08',
      notes: NOTES,
      documentFingerprint: DOCUMENT_FINGERPRINT,
      evidenceFingerprint: EVIDENCE_FINGERPRINT,
      candidateFingerprint: CANDIDATE_FINGERPRINT,
    }, [{
      url: candidate.sourceUrl,
      summary: 'AWS documents that support for Amazon CloudWatch Evidently ends on 2025-10-16 and that the Evidently console and resources become unavailable after end of support; no replacement service is stated in the captured notice.',
      accessedAt: '2026-10-08',
    }]);

    expect(promoted).toMatchObject({
      providerId: 'aws',
      changeId: CANDIDATE_ID,
      changeType: 'endpoint_removed',
      publishedAt: '2024-10-17',
      removalAt: '2025-10-16',
      affectedResources: ['Amazon CloudWatch Evidently'],
      severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      review: {
        status: 'reviewed',
        reviewer: 'Ravi Teja',
        reviewedAt: '2026-10-08',
        provenance: 'official',
        documentFingerprint: DOCUMENT_FINGERPRINT,
        evidenceFingerprint: EVIDENCE_FINGERPRINT,
        candidateFingerprint: CANDIDATE_FINGERPRINT,
      },
    });
    expect(promoted.affectedPackages).toBeUndefined();
    expect(promoted.affectedVersionRange).toBeUndefined();
    expect(promoted.apiOperationPatterns).toEqual([]);
    expect(promoted.affectedEndpoints).toEqual([]);
  });

  it('evaluates exact, unrelated, dynamic, and wrong-provider resource evidence safely', () => {
    const reviewed = reviewCandidate(candidate, reviewAction);
    const promoted = promoteCandidateToReviewed(reviewed, {
      status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human', reviewedAt: '2026-10-08', notes: NOTES,
      documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT,
    }, [{ url: candidate.sourceUrl, summary: 'Official AWS end-of-support notice.', accessedAt: '2026-10-08' }]);
    const evaluate = (items: CompatibilityUsage[], completeEvidence = true, providerId = 'aws') => evaluateNormalizedCompatibility({
      providerId, usageIR: items.map((item) => normalizeCompatibilityUsage(item, { language: 'typescript' })), completeEvidence,
    }, promoted, policy);

    expect(evaluate([usage()]).status).toBe('AFFECTED');
    expect(evaluate([usage({ id: 'unrelated', resource: 'Amazon CloudWatch RDS' })]).status).toBe('NOT_AFFECTED');
    expect(evaluate([usage({ id: 'dynamic', static: false, confidence: 0.35 })], false).status).toBe('NEEDS_REVIEW');
    expect(evaluate([usage({ id: 'wrong-provider', providerId: 'unrelated-provider' })], true, 'unrelated-provider')).toMatchObject({ status: 'NEEDS_REVIEW', matchedUsages: [] });
    expect(evaluate([usage({ id: 'wrong-provider', providerId: 'unrelated-provider' })], true, 'unrelated-provider').status).not.toBe('AFFECTED');
    expect(evaluate([usage(), usage()]).matchedUsages).toHaveLength(1);
  });

  it('proves equivalent normalized Python evidence without claiming parser coverage', () => {
    const reviewed = reviewCandidate(candidate, reviewAction);
    const promoted = promoteCandidateToReviewed(reviewed, {
      status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human', reviewedAt: '2026-10-08', notes: NOTES,
      documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT,
    }, [{ url: candidate.sourceUrl, summary: 'Official AWS end-of-support notice.', accessedAt: '2026-10-08' }]);
    const normalized = normalizeCompatibilityUsage(usage({ id: 'python-evidently' }), { language: 'python' });
    expect(evaluateNormalizedCompatibility({ providerId: 'aws', usageIR: [normalized], completeEvidence: true }, promoted, policy).status).toBe('AFFECTED');
  });

  it('leaves the canonical candidate separate while the reviewed record is production-visible', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('aws')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CANDIDATE_ID)).toBe(true);
    expect(candidate.state).toBe('needs_review');
  });
});
