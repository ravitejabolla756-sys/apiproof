import { describe, expect, it } from 'vitest';
import { runProviderValidationFactory, validationReportMarkdown } from '../apps/web/scripts/provider-validation-factory.js';

describe('multi-provider validation factory', () => {
  it('covers every reviewed production rule with deterministic engine fixtures', async () => {
    const first = await runProviderValidationFactory();
    const second = await runProviderValidationFactory();

    expect(first.providers).toHaveLength(15);
    expect(first.reviewedRules).toHaveLength(20);
    expect(first.counts.engineCases).toBe(60);
    expect(first.counts.enginePasses).toBe(60);
    expect(first.counts.providers).toBe(15);
    expect(first.counts.reviewedRules).toBe(20);
    expect(first.reviewedRules).toEqual(second.reviewedRules);
    expect(first.rules.map((rule) => rule.changeId)).toEqual(second.rules.map((rule) => rule.changeId));
    expect(first.rules.every((rule) => rule.engine.every((item) => item.pass))).toBe(true);
    expect(first.rules.every((rule) => rule.isolation.wrongProviderHasAffectedResult === false && rule.isolation.duplicateUsageDeduplicated && rule.isolation.duplicateUsageCount === 1)).toBe(true);
  });

  it('runs the real productization, proof, bounded projection, and finding projection path', async () => {
    const report = await runProviderValidationFactory();

    expect(report.productionPersistence.boundedProjectionValidated).toBe(true);
    expect(report.productionPersistence.findingsProjectionValidated).toBe(true);
    expect(report.productionPersistence.rawSourcePresentInProjection).toBe(false);
    expect(report.privacy).toEqual({ rawSourceExternalTransmission: false, secretLikeValuesPresentInProjection: false });
    expect(report.counts.productizationCases).toBe(60);
    expect(report.counts.productizationPasses).toBe(60);
    expect(report.counts.productizationPartial).toBe(0);
    expect(report.rules.flatMap((rule) => rule.productization).every((item) => item.status !== 'UNAVAILABLE')).toBe(true);
    expect(report.rules.every((rule) => rule.productization[0]?.discovered)).toBe(true);
    expect(report.rules.filter((rule) => rule.productization[0]?.pass)).toHaveLength(20);
    expect(report.rules.find((rule) => rule.changeId === 'anthropic-opus-4-7-parameter-restrictions')?.productization[0]?.status).toBe('AFFECTED');
    expect(report.rules.find((rule) => rule.changeId === 'anthropic-opus-4-7-parameter-restrictions')?.productization[0]?.reasonCodes).not.toContain('PARAMETER_VALUE_UNRESOLVED');
    for (const changeId of [
      'aws-cloudwatch-evidently-end-of-support-2025-10-16',
      'clerk-api-2026-05-12-metadata-fields-removed',
      'firebase-instance-id-server-apis-decommission-2027-09-29',
      'github-organization-security-fields-removed-2026-04-21',
      'github-synchronous-sbom-endpoint-removal-2026-11-13',
      'google-cloud-api-registry-mcp-shutdown-2026-07-30',
      'launchdarkly-api-version-20220603-eol-2025-04-15',
      'openai-assistants-api-sunset-2026-08-26',
      'shopify-checkout-api-shutdown-2025-04-01',
      'slack-files-upload-removal-2025-11-12',
      'supabase-management-logs-all-removal-2026-09-23',
      'cloudflare-service-key-auth-removal-2026-09-30',
    ]) {
      expect(report.rules.find((rule) => rule.changeId === changeId)?.productization[0]?.pass, changeId).toBe(true);
    }
  });

  it('renders a stable human-readable matrix without source or secret values', async () => {
    const report = await runProviderValidationFactory();
    const markdown = validationReportMarkdown(report);
    expect(markdown).toContain('Provider Intelligence Validation Matrix');
    expect(markdown).toContain('15');
    expect(markdown).toContain('20');
    expect(markdown).not.toContain('OPENAI_API_KEY');
    expect(markdown).not.toContain('RAW_SOURCE');
  });
});
