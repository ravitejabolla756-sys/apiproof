import { describe, expect, it } from 'vitest';
import { parseProviderRuleResponse } from '../apps/web/src/lib/provider-rule-contract.js';

const candidate = {
  id: 'candidate-1', providerId: 'stripe', title: 'Removed field', description: 'Review this change.', status: 'needs_review', severity: 'high',
  payload: null, source: { url: 'https://stripe.com/changelog', type: 'official' }, createdAt: '2026-11-09T00:00:00.000Z', reviewNotes: null,
  coverage: null, reviewPack: null,
};

describe('provider rule response', () => {
  it('accepts a candidate without optional coverage or review pack', () => {
    expect(parseProviderRuleResponse({ candidates: [candidate] })).toMatchObject({ candidates: [{ id: 'candidate-1', providerId: 'stripe' }], coverageSummary: null });
  });

  it('accepts a validated coverage summary', () => {
    expect(parseProviderRuleResponse({ candidates: [], coverageSummary: { candidates: 0, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } })).toMatchObject({ coverageSummary: { candidates: 0 } });
  });

  it('rejects malformed candidates, summaries and duplicate IDs', () => {
    expect(parseProviderRuleResponse({ candidates: [{ ...candidate, source: { url: '', type: 'official' } }] })).toBeNull();
    expect(parseProviderRuleResponse({ candidates: [candidate, candidate] })).toBeNull();
    expect(parseProviderRuleResponse({ candidates: [], coverageSummary: { candidates: -1, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } })).toBeNull();
  });
});
