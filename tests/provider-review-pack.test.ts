import { describe, expect, it } from 'vitest';
import {
  buildProviderReviewPack,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
  renderProviderReviewPackMarkdown,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../apps/web/src/lib/server/provider-change-monitor.js';

describe('provider review pack', () => {
  const pack = buildProviderReviewPack({
    candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
    monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
    reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
    templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
    expectedProviderCount: 19,
    generatedAt: '2026-10-29T00:00:00.000Z',
  });

  it('includes immutable fingerprints and a review checklist for every candidate', () => {
    expect(pack.entries).toHaveLength(50);
    expect(pack.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.candidateFingerprint))).toBe(true);
    expect(pack.entries.every((entry) => entry.reviewChecklist.length >= 4)).toBe(true);
    expect(pack.entries.filter((entry) => entry.productionReviewed)).toHaveLength(50);
    expect(pack.entries.some((entry) => entry.reviewOnlyTemplateProposal?.providerId === 'clerk')).toBe(true);
    expect(pack.entries.every((entry) => entry.template.status === 'review-only' || entry.reviewOnlyTemplateProposal === undefined || entry.reviewOnlyTemplateProposal.mode === 'manual-guidance' || entry.reviewOnlyTemplateProposal.limitation.startsWith('Review-only'))).toBe(true);
    expect(pack.entries.every((entry) => entry.fixturePlan.examples.map((fixture) => fixture.kind).join(',') === 'affected,unaffected,uncertain')).toBe(true);
    expect(pack.entries.every((entry) => entry.fixturePlan.examples.every((fixture) => fixture.code.length > 0 && fixture.filePath.startsWith('review-fixtures/')))).toBe(true);
    expect(pack.summary.pending).toBe(0);
    expect(pack.summary.providersMissingCandidates).toEqual([]);
    expect(pack.summary.providersOutsideMonitoredCatalog).toEqual(['anthropic']);
    expect(pack.summary.reviewOnlyTemplateProposals).toBeGreaterThan(0);
    expect(pack.summary.providersWithReviewOnlyTemplateProposals).toContain('clerk');
    expect(pack.summary.candidatesWithoutTemplateProposal).toEqual([]);
    expect(pack.entries.find((entry) => entry.candidateId === 'openai-assistants-api-sunset-2026-08-26')?.reviewOnlyTemplateProposal).toMatchObject({ mode: 'manual-guidance' });
    expect(pack.entries.find((entry) => entry.candidateId === 'slack-files-upload-removal-2025-11-12')?.reviewOnlyTemplateProposal).toMatchObject({ mode: 'manual-guidance' });
    expect(pack.entries.find((entry) => entry.candidateId === 'openai-assistants-api-sunset-2026-08-26')?.template).toMatchObject({ status: 'review-only', templateIds: [] });
    expect(pack.entries.find((entry) => entry.candidateId === 'openai-gpt-4-5-preview-removal-2025-07-14')?.template).toMatchObject({ status: 'deterministic-ast', templateIds: ['openai-gpt-4-5-preview-removal-2025-07-14'] });
    expect(pack.entries.find((entry) => entry.candidateId === 'stripe-plans-api-replaced-by-prices')?.template).toMatchObject({ status: 'review-only', templateIds: [] });
  });

  it('does not promote or mutate candidates while rendering', () => {
    const before = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => `${candidate.candidateId}:${candidate.state}`);
    const markdown = renderProviderReviewPackMarkdown(pack);
    expect(markdown).toContain('This is an evidence bundle, not an approval record');
    expect(markdown).toContain('Source fingerprint:');
    expect(markdown).toContain('Fixture examples (review-only)');
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => `${candidate.candidateId}:${candidate.state}`)).toEqual(before);
  });
});
