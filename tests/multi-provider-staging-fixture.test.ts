import { describe, expect, it } from 'vitest';
import { PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID, runMultiProviderStagingFixture } from '../apps/web/scripts/multi-provider-staging-fixture.js';

describe('multi-provider staging fixture', () => {
  it('runs the actual productization scanner across all reviewed providers', async () => {
    const report = await runMultiProviderStagingFixture();
    const expectedProviders = Array.from(new Set(PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.providerId))).sort();
    const expectedChanges = PRODUCTION_COMPATIBILITY_REGISTRY.changes.map((change) => change.changeId).slice().sort();

    expect(report.discoveredProviders).toEqual(expectedProviders);
    expect(report.expectedAffectedChangeIds).toHaveLength(19);
    expect([...report.actualAffectedChangeIds].sort()).toEqual([...report.expectedAffectedChangeIds].sort());
    expect(report.actualNeedsReviewChangeIds).toEqual([ANTHROPIC_PARAMETER_AMBIGUOUS_CHANGE_ID]);
    expect([...report.actualFindingChangeIds].sort()).toEqual([...report.expectedAffectedChangeIds].sort());
    expect(report.proofChangeIds).toEqual(expectedChanges);
    expect(Object.values(report.exactLocations).every((location) => location.file?.startsWith('src/provider-validation/'))).toBe(true);
    expect(Object.values(report.exactLocations).every((location) => location.severity !== null)).toBe(true);
    expect(report.duplicateFindingIds).toEqual([]);
    expect(report.providerInterference).toBe(false);
    expect(report.boundedProjectionValid).toBe(true);
    expect(report.findingsProjectionValid).toBe(true);
    expect(report.scanMetrics.reviewedChangesConsidered).toBe(20);
    expect(report.actualFindingChangeIds).toHaveLength(19);
    expect(report.scanMetrics.findings).toBe(20);
  });

  it('keeps the fixture deterministic across repeated scans', async () => {
    const first = await runMultiProviderStagingFixture();
    const second = await runMultiProviderStagingFixture();
    expect(first.fixtureFiles).toEqual(second.fixtureFiles);
    expect(first.discoveredProviders).toEqual(second.discoveredProviders);
    expect(first.actualAffectedChangeIds).toEqual(second.actualAffectedChangeIds);
    expect(first.actualNeedsReviewChangeIds).toEqual(second.actualNeedsReviewChangeIds);
    expect(first.actualFindingChangeIds).toEqual(second.actualFindingChangeIds);
    expect(first.proofChangeIds).toEqual(second.proofChangeIds);
  });
});
