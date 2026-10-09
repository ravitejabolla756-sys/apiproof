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
    expect(report.rules.every((rule) => rule.productization[0]?.discovered)).toBe(true);
    expect(report.rules.some((rule) => rule.productization[0]?.pass)).toBe(true);
    expect(report.rules.some((rule) => rule.productization[0]?.status !== 'AFFECTED')).toBe(true);
    expect(report.rules.find((rule) => rule.changeId === 'github-synchronous-sbom-endpoint-removal-2026-11-13')?.productization[0]?.pass).toBe(true);
    expect(report.rules.find((rule) => rule.changeId === 'twilio-regional-api-domain-removal-2026-04-28')?.productization[0]?.pass).toBe(true);
    expect(report.rules.find((rule) => rule.changeId === 'launchdarkly-api-version-20220603-eol-2025-04-15')?.productization[0]?.pass).toBe(true);
    expect(report.rules.find((rule) => rule.changeId === 'cloudflare-service-key-auth-removal-2026-09-30')?.productization[0]?.pass).toBe(true);
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
