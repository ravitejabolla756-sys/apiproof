import { describe, expect, it } from 'vitest';
import { parseCompatibilityMapResponse } from '../apps/web/src/lib/compatibility-map-contract.js';

const repository = {
  id: 'repo-1', owner: 'acme', name: 'owl', fullName: 'acme/owl', defaultBranch: 'main', latestScanStatus: 'completed',
  latestCompletedScan: { id: 'scan-1', sha: 'abc', baselineSha: 'abc', filesAnalyzed: 4, findingsCount: 0, completedAt: null },
  analysisEvidenceAvailable: true,
  integrations: [{ provider: 'stripe', detected: true, usageCount: 2, mappedSymbolCount: 1, reviewedChangeCount: 1 }],
  openFindingCount: 0, findings: [],
};

describe('compatibility map response', () => {
  it('accepts a complete repository projection', () => {
    expect(parseCompatibilityMapResponse({ repositories: [repository] })).toMatchObject({ repositories: [{ id: 'repo-1', integrations: [{ provider: 'stripe' }] }] });
  });

  it('accepts an empty repository collection', () => {
    expect(parseCompatibilityMapResponse({ repositories: [] })).toEqual({ repositories: [] });
  });

  it('rejects malformed nested or duplicate projections', () => {
    expect(parseCompatibilityMapResponse({ repositories: [{ ...repository, integrations: [{ ...repository.integrations[0], usageCount: -1 }] }] })).toBeNull();
    expect(parseCompatibilityMapResponse({ repositories: [repository, repository] })).toBeNull();
    expect(parseCompatibilityMapResponse({ repositories: [{ ...repository, findings: [{ id: 'finding-1' }] }] })).toBeNull();
  });
});
