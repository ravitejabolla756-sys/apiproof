import { describe, expect, it } from 'vitest';
import { buildMigrationTemplateCoverageIndex, buildProviderCapabilityMatrix, buildProviderCapabilitySummary, buildProviderIntelligenceCoverage, buildProviderReviewCoverageReport, buildReviewedRuleCoverage, hasExecutableMigrationTemplate, DISCOVERY_PROVIDERS, LOCAL_REVIEWED_PRODUCTION_RECORDS, MIGRATION_TEMPLATE_COVERAGE, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY } from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../apps/web/src/lib/server/provider-change-monitor.js';

describe('provider intelligence coverage report', () => {
  it('reports candidate and reviewed coverage without inventing production capability', () => {
    const report = buildProviderIntelligenceCoverage(DISCOVERY_PROVIDERS, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(report).toHaveLength(62);
    expect(report.map((entry) => entry.providerId)).toEqual([...report].sort((a, b) => a.providerId.localeCompare(b.providerId, 'en')).map((entry) => entry.providerId));
    expect(report.find((entry) => entry.providerId === 'openai')).toMatchObject({ candidateChangeCount: 3, reviewedChangeCount: 3, migrationCount: 0, verifiedMigrationCount: 0 });
    expect(report.find((entry) => entry.providerId === 'anthropic')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'firebase')).toMatchObject({ candidateChangeCount: 3, reviewedChangeCount: 3 });
    expect(report.find((entry) => entry.providerId === 'aws')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'shopify')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'slack')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'auth0')).toMatchObject({ candidateChangeCount: 3, reviewedChangeCount: 3 });
    expect(report.find((entry) => entry.providerId === 'clerk')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'cloudflare')).toMatchObject({ candidateChangeCount: 8, reviewedChangeCount: 8 });
    expect(report.find((entry) => entry.providerId === 'launchdarkly')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'groq')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'elevenlabs')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'google-cloud')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'braintree')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'vercel')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
    expect(report.find((entry) => entry.providerId === 'stripe')).toMatchObject({ candidateChangeCount: 3, reviewedChangeCount: 3 });
    expect(report.find((entry) => entry.providerId === 'sendgrid')).toMatchObject({ candidateChangeCount: 2, reviewedChangeCount: 2 });
  });

  it('reports the first ten reviewed rules without claiming migrations', () => {
    const report = buildReviewedRuleCoverage(PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(report).toHaveLength(50);
    expect(report.every((entry) => entry.reviewStatus === 'reviewed' && entry.migrationAvailability === 'none' && entry.verificationAvailability === 'compatibility-proof')).toBe(true);
    expect(report.filter((entry) => entry.providerId === 'openai')).toHaveLength(3);
    expect(report.filter((entry) => entry.providerId === 'anthropic')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'github')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'twilio')).toHaveLength(2);
    expect(report.filter((entry) => entry.providerId === 'supabase')).toHaveLength(2);
    expect(report.find((entry) => entry.changeId === 'twilio-studio-engagements-endpoint-deprecated')).toMatchObject({ applicabilityDimensions: ['provider', 'endpoint'], severity: 'high' });
  });

  it('keeps monitoring, discovery, reviewed rules, rescans, and fixes distinct', () => {
    const report = buildProviderCapabilityMatrix([
      { providerId: 'openai', displayName: 'OpenAI', sourceUrl: 'https://developers.openai.com/api/docs/deprecations', sourceType: 'deprecation-notice' },
      { providerId: 'cloudflare', displayName: 'Cloudflare', sourceUrl: 'https://developers.cloudflare.com/api/release-notes/', sourceType: 'release-notes' },
    ], DISCOVERY_PROVIDERS, OFFICIAL_CHANGE_CANDIDATE_REGISTRY, PRODUCTION_COMPATIBILITY_REGISTRY);
    expect(report).toHaveLength(2);
    expect(report[0]).toMatchObject({ providerId: 'cloudflare', discoveryAvailable: true, candidateCount: 8, reviewedRuleCount: 8, scannerCoverage: 'reviewed-rules', autoRescan: true, autoFix: 'guarded-human-review', migrationTemplateStatus: 'deterministic-ast', migrationTemplateCount: 1, migrationTemplateLimitation: expect.stringContaining('static'), migrationTemplatePromotion: { candidateIds: expect.arrayContaining(['cloudflare-service-key-authentication-removed-2026-09-30']) } });
    expect(report[1]).toMatchObject({ providerId: 'openai', discoveryAvailable: true, reviewedRuleCount: 3, scannerCoverage: 'reviewed-rules', autoRescan: true, autoFix: 'guarded-human-review', migrationTemplateStatus: 'deterministic-ast', migrationTemplateCount: 1, migrationTemplateLimitation: expect.stringContaining('Literal'), migrationTemplatePromotion: { candidateIds: expect.arrayContaining(['openai-assistants-api-sunset-2026-08-26']) } });
  });

  it('keeps migration-template readiness explicit for the complete launch catalog', () => {
    const index = buildMigrationTemplateCoverageIndex();
    expect(MIGRATION_TEMPLATE_COVERAGE).toHaveLength(19);
    expect(index.get('stripe')).toMatchObject({ status: 'deterministic-ast', templateIds: expect.arrayContaining(['stripe-subscription-coupon-removed']) });
    expect(index.get('twilio')).toMatchObject({ status: 'deterministic-ast', templateIds: ['twilio-twiml-namespace-casing', 'twilio-regional-api-domain-removal-2026-04-28', 'twilio-studio-engagements-endpoint-deprecated'] });
    expect(index.get('github')).toMatchObject({ status: 'deterministic-ast', templateIds: ['github-synchronous-sbom-endpoint-removal-2026-11-13'] });
    expect(index.get('supabase')).toMatchObject({ status: 'deterministic-ast', templateIds: ['supabase-management-logs-all-removal-2026-09-23'] });
    expect(index.get('openai')).toMatchObject({ status: 'deterministic-ast', templateIds: ['openai-gpt-4-5-preview-removal-2025-07-14'] });
    expect(index.get('firebase')).toMatchObject({ status: 'deterministic-ast', templateIds: ['firebase-vertexai-import-alias-removed-2025-07-17', 'firebase-vertexai-symbols-removed-2025-07-17'] });
    expect([...index.keys()]).toHaveLength(19);
    expect(hasExecutableMigrationTemplate('stripe-subscription-coupon-removed')).toBe(true);
    expect(hasExecutableMigrationTemplate('twilio-twiml-namespace-casing')).toBe(true);
    expect(hasExecutableMigrationTemplate('twilio-regional-api-domain-removal-2026-04-28')).toBe(true);
    expect(hasExecutableMigrationTemplate('twilio-studio-engagements-endpoint-deprecated')).toBe(true);
    expect(hasExecutableMigrationTemplate('github-synchronous-sbom-endpoint-removal-2026-11-13')).toBe(true);
    expect(hasExecutableMigrationTemplate('supabase-management-logs-all-removal-2026-09-23')).toBe(true);
    expect(hasExecutableMigrationTemplate('openai-gpt-4-5-preview-removal-2025-07-14')).toBe(true);
    expect(hasExecutableMigrationTemplate('firebase-vertexai-symbols-removed-2025-07-17')).toBe(true);
    expect(hasExecutableMigrationTemplate('openai-assistants-api-sunset-2026-08-26')).toBe(false);
  });

  it('keeps every launch provider represented across monitoring, discovery, and fix readiness', () => {
    const verifiedTemplateIds = new Set([
      'twilio-regional-api-domain-removal-2026-04-28',
      'twilio-studio-engagements-endpoint-deprecated',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'supabase-management-logs-all-removal-2026-09-23',
      'openai-gpt-4-5-preview-removal-2025-07-14',
      'cloudflare-workers-kv-legacy-routes-2026-10-15',
      'launchdarkly-api-version-20220603-eol-2025-04-15',
      'sendgrid-v2-mail-send-migration-to-v3',
    ]);
    const report = buildProviderCapabilityMatrix(
      PROVIDER_CHANGE_SOURCES.map((source) => ({
        providerId: source.providerId,
        displayName: source.displayName,
        sourceUrl: source.sourceUrl,
        sourceType: source.sourceType,
      })),
      DISCOVERY_PROVIDERS,
      OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
      PRODUCTION_COMPATIBILITY_REGISTRY,
      MIGRATION_TEMPLATE_COVERAGE,
      verifiedTemplateIds,
    );
    expect(report).toHaveLength(19);
    expect(new Set(report.map((entry) => entry.providerId)).size).toBe(19);
    expect(report.every((entry) => entry.discoveryAvailable)).toBe(true);
    expect(report.every((entry) => entry.sourceUrl.startsWith('https://'))).toBe(true);
    expect(report.filter((entry) => entry.migrationTemplatePromotion !== null).map((entry) => entry.providerId)).toEqual(expect.arrayContaining(['auth0', 'aws', 'braintree', 'google-cloud', 'slack', 'stripe', 'vercel']));
    expect(report.every((entry) => ['deterministic-ast', 'review-only'].includes(entry.migrationTemplateStatus))).toBe(true);
    expect(report.filter((entry) => entry.migrationTemplateStatus === 'deterministic-ast').map((entry) => entry.providerId)).toEqual(['clerk', 'cloudflare', 'elevenlabs', 'firebase', 'github', 'groq', 'launchdarkly', 'openai', 'sendgrid', 'shopify', 'stripe', 'supabase', 'twilio']);
    expect(buildProviderCapabilitySummary(report)).toEqual({
      configuredSources: 19,
      discoveryProviders: 19,
      providersWithReviewedRules: 19,
      reviewedRules: 48,
      providersWithMigrationTemplates: 13,
      migrationTemplates: 19,
      providersWithVerifiedMigrationTemplates: 7,
      verifiedMigrationTemplates: 8,
      providersWithReviewOnlyTemplateProposals: 19,
      reviewOnlyTemplateProposals: 48,
      autoFixPolicy: 'guarded-human-review',
    });
  });

  it('requires an official review candidate for every monitored launch provider', () => {
    const monitoredProviderIds = new Set(PROVIDER_CHANGE_SOURCES.map((source) => source.providerId));
    const candidateProviderIds = new Set(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.providerId));

    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates).toHaveLength(50);
    expect([...monitoredProviderIds].every((providerId) => candidateProviderIds.has(providerId))).toBe(true);
    expect(monitoredProviderIds.size).toBe(19);
  });

  it('derives actionable review priorities from the same launch catalog', () => {
    const report = buildProviderReviewCoverageReport({
      candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
      monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
      reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
      templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
      expectedProviderCount: 19,
    });
    const pending = report.rows.filter((row) => !row.reviewedInProduction);
    const priorities = new Map(['P0', 'P1', 'P2'].map((priority) => [priority, pending.filter((row) => row.priority === priority).length]));

    expect(report.summary.pendingCandidates).toBe(pending.length);
    expect([...priorities.values()].reduce((total, count) => total + count, 0)).toBe(pending.length);
    expect(priorities.get('P0')).toBe(0);
    expect(priorities.get('P1')).toBe(0);
    expect(priorities.get('P2')).toBe(0);
    expect(report.rows.every((row) => row.templateLimitation.trim().length > 0)).toBe(true);
    expect(report.rows.find((row) => row.providerId === 'aws')?.templateLimitation).toContain('review-only');
  });
});
