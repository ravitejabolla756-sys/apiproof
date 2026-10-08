import { describe, expect, it } from 'vitest';
import type { CompatibilityUsage } from '@apiproof/shared';
import {
  EXPANSION_OFFICIAL_CHANGE_CANDIDATES,
  PRODUCTION_COMPATIBILITY_REGISTRY,
  promoteCandidateToReviewed,
} from '@apiproof/providers';
import { evaluateNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import {
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE,
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW,
} from '../packages/providers/src/local-reviewed-candidate-reviews.js';

const candidate = EXPANSION_OFFICIAL_CHANGE_CANDIDATES.find((item) => item.candidateId === 'shopify-checkout-api-shutdown-2025-04-01');
if (!candidate) throw new Error('SHOPIFY_CHECKOUT_API_CANDIDATE_MISSING');

const reviewedRecord = promoteCandidateToReviewed(
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE,
  LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW,
  [{ url: candidate.sourceUrl, summary: 'Official Shopify changelog for Checkout API shutdown and migration guidance.', accessedAt: '2026-10-08' }],
);

const policy = { compatibilityProviders: new Set(['shopify']), requireOfficialProvenance: true };
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'shopify-checkout', providerId: 'shopify', resource: 'Storefront Checkout mutations', evidenceKind: 'sdk', confidence: 1, static: true,
  location: { file: 'src/checkout.ts', line: 12, column: 1, symbol: 'checkout mutation' }, ...overrides,
});

const evaluate = (input: CompatibilityUsage, language: 'typescript' | 'python' = 'typescript', completeEvidence = true) => evaluateNormalizedCompatibility(
  { providerId: input.providerId, usageIR: [normalizeCompatibilityUsage(input, { language })], completeEvidence },
  reviewedRecord,
  policy,
);

describe('Shopify Checkout API human review', () => {
  it('reviews only a separate copy and preserves the canonical needs_review candidate', () => {
    expect(candidate.state).toBe('needs_review');
    expect(LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE.state).toBe('reviewed');
    expect(LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_CANDIDATE.auditTrail.at(-1)).toMatchObject({
      state: 'reviewed', actor: 'Ravi Teja', at: '2026-10-08',
      reviewBinding: {
        documentFingerprint: '1f9fd1ff6fef62f1aeb3f77937865de9fab30c9051697ca2f68606cf16512379',
        evidenceFingerprint: 'a00b491e6be2deda68588c345fb28ceecfe5f3dfa612fcdc0428439529d4eb10',
        candidateFingerprint: '07edb79c844497651422e941eac1d62e269ee26ac466bcb48bd8336b1fe0cf0b',
      },
    });
    expect(LOCAL_REVIEWED_SHOPIFY_CHECKOUT_API_REVIEW).toMatchObject({ status: 'reviewed', reviewer: 'Ravi Teja', reviewerKind: 'human' });
    expect(reviewedRecord).toMatchObject({
      providerId: 'shopify', changeId: 'shopify-checkout-api-shutdown-2025-04-01', changeType: 'endpoint_removed',
      removalAt: '2025-04-01', publishedAt: '2025-03-02', severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      affectedResources: ['Storefront Checkout mutations', 'REST Checkout endpoints'],
      replacement: { resources: ['Storefront Cart API', 'Checkout Sheet Kit'] },
      review: { status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official' },
    });
    expect(reviewedRecord.review.notes).toContain('checkout.liquid to Checkout Extensibility migration');
    expect(reviewedRecord.affectedPackages).toBeUndefined();
    expect(reviewedRecord.affectedVersionRange).toBeUndefined();
    expect(reviewedRecord.apiOperationPatterns).toHaveLength(0);
    expect(reviewedRecord.affectedEndpoints).toHaveLength(0);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('shopify')).toHaveLength(1);
  });

  it('passes the promotion gate for the provider + resource projection only', () => {
    expect(reviewedRecord).toBeDefined();
    expect(reviewedRecord.applicabilityScope).toEqual({ dimensions: ['provider', 'resource'] });
    expect(reviewedRecord.review.provenance).toBe('official');
  });

  it('evaluates exact, replacement, unrelated, and dynamic resource evidence', () => {
    expect(evaluate(usage()).status).toBe('AFFECTED');
    expect(evaluate(usage({ resource: 'Storefront Cart API' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ resource: 'Admin REST products API' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ resource: undefined, static: false, confidence: 0.4 }), 'typescript', false).status).toBe('NEEDS_REVIEW');
    expect(evaluate(usage({ providerId: 'openai' })).status).not.toBe('AFFECTED');
  });

  it('deduplicates duplicate usage identity and is language-neutral', () => {
    const duplicate = normalizeCompatibilityUsage(usage({ id: 'duplicate' }), { language: 'typescript' });
    const result = evaluateNormalizedCompatibility({ providerId: 'shopify', usageIR: [duplicate, duplicate], completeEvidence: true }, reviewedRecord, policy);
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedUsages).toHaveLength(1);
    expect(evaluate(usage({ id: 'python-checkout' }), 'python').status).toBe('AFFECTED');
  });
});
