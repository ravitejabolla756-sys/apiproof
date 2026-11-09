import { describe, expect, it } from 'vitest';
import { parseProviderCoverageResponse } from '../apps/web/src/lib/provider-coverage-contract.js';

const summary = {
  configuredSources: 1, discoveryProviders: 1, providersWithReviewedRules: 1, reviewedRules: 1,
  providersWithMigrationTemplates: 1, migrationTemplates: 1, providersWithVerifiedMigrationTemplates: 1,
  verifiedMigrationTemplates: 1, providersWithReviewOnlyTemplateProposals: 0, reviewOnlyTemplateProposals: 0,
  autoFixPolicy: 'guarded-human-review' as const, reviewQueue: { P0: 0, P1: 0, P2: 0 }, migrationTemplatePromotionQueue: [],
};

const provider = {
  providerId: 'fixture', providerName: 'Fixture', sourceUrl: 'https://example.test/source', sourceType: 'official', discoveryAvailable: true,
  candidateCount: 1, reviewedRuleCount: 1, scannerCoverage: 'reviewed-rules' as const, autoRescan: true, autoFix: 'guarded-human-review' as const,
  migrationTemplateStatus: 'deterministic-ast' as const, migrationTemplateLimitation: 'Human review remains required.', migrationTemplateCount: 1,
  verifiedMigrationTemplateCount: 1, reviewOnlyTemplateProposalCount: 0, candidateCountWithoutTemplateProposal: 0, migrationTemplatePromotion: null,
  sourceHealth: { status: 'healthy' as const, lastSuccessAt: null, nextAttemptAt: null, failureCount: 0, parserStatus: 'structured' as const },
};

describe('provider coverage response contract', () => {
  it('accepts the canonical coverage projection', () => {
    expect(parseProviderCoverageResponse({ summary, providers: [provider] })).toEqual({ summary, providers: [provider] });
  });

  it('rejects malformed nested provider metadata before rendering', () => {
    expect(parseProviderCoverageResponse({ summary, providers: [{ ...provider, candidateCount: -1 }] })).toBeNull();
    expect(parseProviderCoverageResponse({ summary: { ...summary, reviewQueue: { P0: '0', P1: 0, P2: 0 } }, providers: [] })).toBeNull();
    expect(parseProviderCoverageResponse({ summary, providers: [{ ...provider, sourceHealth: { ...provider.sourceHealth, parserStatus: 'unknown' } }] })).toBeNull();
  });
});
