import { describe, expect, it } from 'vitest';
import type { CompatibilityUsage } from '@apiproof/shared';
import { evaluateRegisteredNormalizedCompatibility, normalizeCompatibilityUsage } from '@apiproof/analyzers';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

const CHANGE_ID = 'shopify-checkout-api-shutdown-2025-04-01';
const usage = (overrides: Partial<CompatibilityUsage> = {}): CompatibilityUsage => ({
  id: 'shopify-production-usage', providerId: 'shopify', resource: 'Storefront Checkout mutations', evidenceKind: 'sdk', confidence: 1, static: true,
  location: { file: 'src/checkout.ts', line: 12, column: 1, symbol: 'checkout mutation' }, ...overrides,
});

const evaluate = (input: CompatibilityUsage, completeEvidence = true) => evaluateRegisteredNormalizedCompatibility({
  providerId: input.providerId,
  usageIR: [normalizeCompatibilityUsage(input, { language: 'typescript' })],
  completeEvidence,
}, PRODUCTION_COMPATIBILITY_REGISTRY).find((result) => result.changeId === CHANGE_ID)!;

describe('Shopify Checkout API production rule', () => {
  it('remains a reviewed rule after the eighth reviewed provider is added', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.changes).toHaveLength(20);
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byProvider.get('shopify')).toHaveLength(1);
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId))).toHaveLength(15);
    expect(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId)).size).toBe(20);
  });

  it('preserves the reviewed production record and official provenance', () => {
    expect(PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID)).toMatchObject({
      providerId: 'shopify', changeType: 'endpoint_removed', publishedAt: '2025-03-02', removalAt: '2025-04-01', severity: 'high',
      applicabilityScope: { dimensions: ['provider', 'resource'] },
      affectedResources: ['Storefront Checkout mutations', 'REST Checkout endpoints'],
      replacement: { resources: ['Storefront Cart API', 'Checkout Sheet Kit'] },
      officialSourceUrl: 'https://shopify.dev/changelog/posts/checkout-apis-will-be-shut-down-april-1-2025',
      review: { status: 'reviewed', reviewer: 'Ravi Teja', reviewedAt: '2026-10-08', provenance: 'official' },
    });
    const record = PRODUCTION_COMPATIBILITY_REGISTRY.byChangeId.get(CHANGE_ID);
    expect(record?.review.notes).toContain('checkout.liquid to Checkout Extensibility migration');
    expect(record?.affectedPackages).toBeUndefined();
    expect(record?.affectedVersionRange).toBeUndefined();
    expect(record?.apiOperationPatterns).toHaveLength(0);
    expect(record?.affectedEndpoints).toHaveLength(0);
  });

  it('matches each affected Checkout resource and rejects replacements/unrelated resources', () => {
    expect(evaluate(usage({ resource: 'Storefront Checkout mutations' })).status).toBe('AFFECTED');
    expect(evaluate(usage({ resource: 'REST Checkout endpoints' })).status).toBe('AFFECTED');
    expect(evaluate(usage({ resource: 'Storefront Cart API' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ resource: 'Checkout Sheet Kit' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ resource: 'checkout.liquid' })).status).toBe('NOT_AFFECTED');
    expect(evaluate(usage({ resource: 'Admin REST products API' })).status).toBe('NOT_AFFECTED');
  });

  it('fails closed for dynamic resources, wrong providers, and duplicate usage identities', () => {
    expect(evaluate(usage({ resource: undefined, static: false, confidence: 0.4 }), false).status).toBe('NEEDS_REVIEW');
    expect(evaluateRegisteredNormalizedCompatibility({ providerId: 'openai', usageIR: [normalizeCompatibilityUsage(usage({ providerId: 'openai' }), { language: 'typescript' })], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).some((result) => result.changeId === CHANGE_ID)).toBe(false);
    const duplicate = normalizeCompatibilityUsage(usage({ id: 'duplicate' }), { language: 'typescript' });
    const result = evaluateRegisteredNormalizedCompatibility({ providerId: 'shopify', usageIR: [duplicate, duplicate], completeEvidence: true }, PRODUCTION_COMPATIBILITY_REGISTRY).find((item) => item.changeId === CHANGE_ID)!;
    expect(result.status).toBe('AFFECTED');
    expect(result.matchedUsages).toHaveLength(1);
  });
});
