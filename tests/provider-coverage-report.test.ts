import { describe, expect, it } from 'vitest';
import { buildProviderIntelligenceCoverage, buildReviewedRuleCoverage, DISCOVERY_PROVIDERS, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';

describe('provider intelligence coverage report', () => {
  it('reports candidate and reviewed coverage without inventing production capability', () => {
    const report = buildProviderIntelligenceCoverage(DISCOVERY_PROVIDERS, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(report).toHaveLength(59);
    expect(report.map((entry) => entry.providerId)).toEqual([...report].sort((a, b) => a.providerId.localeCompare(b.providerId, 'en')).map((entry) => entry.providerId));
    expect(report.find((entry) => entry.providerId === 'openai')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2, migrationCount: 0, verifiedMigrationCount: 0 });
    expect(report.find((entry) => entry.providerId === 'anthropic')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'cloudflare')).toMatchObject({ candidateChangeCount: 0, reviewedChangeCount: 0 });
  });

  it('reports the first ten reviewed rules without claiming migrations', () => {
    const report = buildReviewedRuleCoverage(PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(report).toHaveLength(10);
    expect(report.every((entry) => entry.reviewStatus === 'reviewed' && entry.migrationAvailability === 'none' && entry.verificationAvailability === 'compatibility-proof')).toBe(true);
    expect(report.filter((entry) => entry.providerId === 'openai')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'anthropic')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'github')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'twilio')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'supabase')).toHaveLength(2);
    expect(report.find((entry) => entry.changeId === 'twilio-studio-engagements-endpoint-deprecated')).toMatchObject({ applicabilityDimensions: ['provider', 'endpoint'], severity: 'high' });
  });
});
