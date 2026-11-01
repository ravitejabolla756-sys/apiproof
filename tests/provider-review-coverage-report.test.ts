import { describe, expect, it } from 'vitest';
import {
  buildProviderReviewCoverageReport,
  LOCAL_REVIEWED_PRODUCTION_RECORDS,
  MIGRATION_TEMPLATE_COVERAGE,
  OFFICIAL_CHANGE_CANDIDATE_REGISTRY,
} from '@apiproof/providers';
import { PROVIDER_CHANGE_SOURCES } from '../apps/web/src/lib/server/provider-change-monitor.js';

describe('provider review coverage report', () => {
  it('covers every monitored provider and exposes the remaining review queue', () => {
    const report = buildProviderReviewCoverageReport({
      candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
      monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
      reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
      templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
      expectedProviderCount: 19,
      generatedAt: '2026-10-29T00:00:00.000Z',
    });

    expect(report.expectedProviderCount).toBe(19);
    expect(report.monitoredProviderIds).toHaveLength(19);
    expect(report.rows).toHaveLength(50);
    expect(report.summary.reviewedProviders).toBe(20);
    expect(report.summary.pendingCandidates).toBe(0);
    expect(report.summary.providersMissingReviewedRules).toEqual([]);
    expect(report.summary.providersWithExecutableTemplates).toEqual([
      'clerk',
      'cloudflare',
      'elevenlabs',
      'firebase',
      'github',
      'groq',
      'launchdarkly',
      'openai',
      'sendgrid',
      'shopify',
      'stripe',
      'supabase',
      'twilio',
    ]);
    const clerk = report.rows.find((row) => row.candidateId === 'clerk-core-3-after-switch-organization-url-removed');
    expect(clerk?.reviewedInProduction).toBe(true);
    expect(clerk?.nextAction).toBe('already-reviewed');
    const aws = report.rows.find((row) => row.candidateId === 'aws-javascript-sdk-v2-end-of-support-2025-09-08');
    expect(aws?.priority).toBe('P2');
    expect(aws?.reviewBlockers).toEqual(['No executable migration template; remediation remains review-only.']);
    expect(aws?.nextAction).toBe('already-reviewed');
    const openAiSemanticMigration = report.rows.find((row) => row.candidateId === 'openai-assistants-api-sunset-2026-08-26');
    expect(openAiSemanticMigration?.hasExecutableTemplate).toBe(false);
    expect(openAiSemanticMigration?.reviewBlockers).toContain('No executable migration template; remediation remains review-only.');
    const openAiLiteralMigration = report.rows.find((row) => row.candidateId === 'openai-gpt-4-5-preview-removal-2025-07-14');
    expect(openAiLiteralMigration?.hasExecutableTemplate).toBe(true);
    expect(openAiLiteralMigration?.evidenceClaims).toBe(4);
    expect(openAiLiteralMigration?.reviewBlockers).toEqual([]);
  });

  it('routes candidates without bounded evidence to evidence review first', () => {
    const report = buildProviderReviewCoverageReport({
      candidates: [{
        candidateId: 'incomplete-candidate',
        providerId: 'stripe',
        sourceUrl: 'https://example.test/source',
        sourceType: 'official-changelog',
        sourceFingerprint: 'source-fingerprint',
        sourceFingerprintBasis: 'evidence-excerpt',
        discoveredAt: '2026-10-29',
        payload: { changeId: 'incomplete-candidate', title: 'Incomplete source record', description: 'The source record is incomplete.', changeType: 'endpoint_removed' },
        state: 'needs_review',
        auditTrail: [{ state: 'needs_review', at: '2026-10-29', actor: 'test', note: 'Incomplete test candidate.' }],
      }],
      monitoredProviderIds: ['stripe'],
      reviewedChanges: [],
      templateCoverage: [],
    });

    expect(report.rows[0]).toMatchObject({
      priority: 'P2',
      nextAction: 'human-review',
      reviewBlockers: [
        'Human approval with affected, unaffected, and uncertain fixtures is required.',
        'Source evidence claims are missing.',
        'No bounded detector token is available.',
        'No executable migration template; remediation remains review-only.',
      ],
    });
  });

  it('does not mutate source collections while producing rows', () => {
    const candidateIds = OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.candidateId);
    buildProviderReviewCoverageReport({
      candidates: OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates,
      monitoredProviderIds: PROVIDER_CHANGE_SOURCES.map((source) => source.providerId),
      reviewedChanges: LOCAL_REVIEWED_PRODUCTION_RECORDS,
      templateCoverage: MIGRATION_TEMPLATE_COVERAGE,
    });
    expect(OFFICIAL_CHANGE_CANDIDATE_REGISTRY.candidates.map((candidate) => candidate.candidateId)).toEqual(candidateIds);
  });
});
