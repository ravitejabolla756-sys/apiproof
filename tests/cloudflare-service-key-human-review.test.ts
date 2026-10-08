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

const CANDIDATE_ID = 'cloudflare-service-key-auth-removal-2026-09-30';
const DOCUMENT_FINGERPRINT = 'd42f07bfaf4882f46bf455cd5cecfba058794f9109d8985a3cfc591d189f92c9';
const EVIDENCE_FINGERPRINT = '9abd5f0455c3333c23638475e04813a8d20c21c153d5c85e7ab9abc300348ca8';
const CANDIDATE_FINGERPRINT = 'e2d017c98bbd004f9101346c6f604102adc558cc468467ebf57dd92ae3f2abfb';
const NOTES = "I verified Cloudflare's official API deprecation notice for removal of X-Auth-User-Service-Key on 2026-09-30 and the API Token replacement. I approve provider + auth_or_header applicability only for that exact header mechanism. I do not assert any endpoint, SDK package, SDK version, SDK method, or broader authentication behavior.";

const reviewAction = {
  decision: 'approve-for-promotion-review' as const,
  reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', notes: NOTES,
  sourceFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT,
};

const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((entry) => entry.candidateId === CANDIDATE_ID)!;
const policy = { compatibilityProviders: new Set(['cloudflare']), requireOfficialProvenance: true };

function usage(overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage {
  return {
    id: 'cloudflare-auth', providerId: 'cloudflare', authOrHeader: 'X-Auth-User-Service-Key', evidenceKind: 'http',
    confidence: 0.99, static: true, location: { file: 'fixtures/cloudflare.ts', line: 10, column: 1 }, ...overrides,
  };
}

function promoted() {
  const reviewed = reviewCandidate(candidate, reviewAction);
  return promoteCandidateToReviewed(reviewed, {
    status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human', reviewedAt: '2026-10-08', notes: NOTES,
    documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT,
  }, [{ url: candidate.sourceUrl, summary: 'Cloudflare documents removal of Service Key authentication and replacement with API Tokens.', accessedAt: '2026-10-08' }]);
}

function evaluate(items: CompatibilityUsage[], providerId = 'cloudflare', completeEvidence = true) {
  return evaluateNormalizedCompatibility({ providerId, usageIR: items.map((item) => normalizeCompatibilityUsage(item, { language: 'typescript' })), completeEvidence }, promoted(), policy);
}

describe('Cloudflare Service Key human-review projection', () => {
  it('verifies fingerprints, strict review, scope, and promotion without touching production registry', () => {
    expect(candidate.state).toBe('needs_review');
    expect(candidate.sourceFingerprint).toBe(DOCUMENT_FINGERPRINT);
    expect(candidate.evidenceFingerprint).toBe(EVIDENCE_FINGERPRINT);
    expect(fingerprintCandidate(candidate)).toBe(CANDIDATE_FINGERPRINT);
    expect(candidate.payload).toMatchObject({ applicabilityScope: { dimensions: ['provider', 'auth_or_header'] }, authOrHeaderPatterns: ['X-Auth-User-Service-Key'], replacement: { authOrHeader: 'API Token' }, severity: 'high' });
    expect(candidate.payload).not.toHaveProperty('affectedEndpoints');
    expect(candidate.payload).not.toHaveProperty('affectedPackages');
    expect(candidate.payload).not.toHaveProperty('apiOperationPatterns');

    const reviewed = reviewCandidate(candidate, reviewAction);
    expect(candidate.state).toBe('needs_review');
    expect(reviewed.state).toBe('reviewed');
    expect(reviewed.auditTrail.at(-1)).toMatchObject({ actor: 'Ravi Teja', note: NOTES, reviewBinding: { documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT } });

    const record = promoteCandidateToReviewed(reviewed, { status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human', reviewedAt: '2026-10-08', notes: NOTES, documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT }, [{ url: candidate.sourceUrl, summary: 'Cloudflare documents removal of Service Key authentication and replacement with API Tokens.', accessedAt: '2026-10-08' }]);
    expect(record).toMatchObject({ providerId: 'cloudflare', changeId: CANDIDATE_ID, removalAt: '2026-09-30', severity: 'high', applicabilityScope: { dimensions: ['provider', 'auth_or_header'] }, authOrHeaderPatterns: ['X-Auth-User-Service-Key'], replacement: { authOrHeader: 'API Token' }, review: { status: 'reviewed', reviewer: 'Ravi Teja', provenance: 'official', documentFingerprint: DOCUMENT_FINGERPRINT, evidenceFingerprint: EVIDENCE_FINGERPRINT, candidateFingerprint: CANDIDATE_FINGERPRINT } });
    expect(record.affectedPackages).toBeUndefined();
    expect(record.affectedEndpoints).toEqual([]);
    expect(record.apiOperationPatterns).toEqual([]);
  });

  it('evaluates static, dynamic, wrong-provider, and duplicate evidence fail-closed', () => {
    expect(evaluate([usage()]).status).toBe('AFFECTED');
    expect(evaluate([usage({ id: 'token', authOrHeader: 'API Token' })]).status).toBe('NOT_AFFECTED');
    expect(evaluate([usage({ id: 'other', authOrHeader: 'X-Auth-User-API-Key' })]).status).toBe('NOT_AFFECTED');
    expect(evaluate([usage({ id: 'dynamic', authOrHeader: undefined, static: false, confidence: 0.3 })], 'cloudflare', false).status).toBe('NEEDS_REVIEW');
    expect(evaluate([usage({ id: 'wrong', providerId: 'unrelated-provider' })], 'unrelated-provider').status).toBe('NEEDS_REVIEW');
    expect(evaluate([usage(), usage()]).matchedUsages).toHaveLength(1);
  });

  it('keeps header values redacted and preserves equivalent Python normalized evidence', () => {
    const redacted = normalizeCompatibilityUsage(usage({ id: 'redacted', headerEvidence: [{ name: 'X-Auth-User-Service-Key', static: true, redacted: true, location: { file: 'fixtures/cloudflare.ts', line: 10, column: 1 } }] }), { language: 'typescript' });
    expect(JSON.stringify(redacted)).not.toContain('secret');
    expect(evaluateNormalizedCompatibility({ providerId: 'cloudflare', usageIR: [normalizeCompatibilityUsage(usage({ id: 'python' }), { language: 'python' })], completeEvidence: true }, promoted(), policy).status).toBe('AFFECTED');
  });

  it('leaves the canonical candidate and verifies the 15-rule production registry', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('cloudflare')).toHaveLength(1);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.has(CANDIDATE_ID)).toBe(true);
    expect(candidate.state).toBe('needs_review');
  });
});
