import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long provider review queue metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/provider-coverage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          configuredSources: 1, discoveryProviders: 1, providersWithReviewedRules: 1, reviewedRules: 1,
          providersWithMigrationTemplates: 1, migrationTemplates: 1, providersWithVerifiedMigrationTemplates: 0,
          verifiedMigrationTemplates: 0, providersWithReviewOnlyTemplateProposals: 1, reviewOnlyTemplateProposals: 1,
          autoFixPolicy: 'guarded-human-review', reviewQueue: { P0: 1, P1: 0, P2: 0 },
          migrationTemplatePromotionQueue: [{
            providerId: `provider-${'identifier-'.repeat(14)}`,
            candidateIds: [`candidate-${'identifier-'.repeat(14)}`],
            proposalModes: ['manual-guidance'],
            nextStep: `Review ${'long-remediation-guidance-'.repeat(16)}`,
          }],
        },
        providers: [{
          providerId: 'provider-long-review', providerName: `Provider ${'name-'.repeat(12)}`,
          sourceUrl: 'https://example.test/provider', sourceType: 'official changelog', discoveryAvailable: true,
          candidateCount: 1, reviewedRuleCount: 1, scannerCoverage: 'reviewed-rules', autoRescan: false,
          autoFix: 'guarded-human-review', migrationTemplateStatus: 'review-only',
          migrationTemplateLimitation: `Limitation ${'long-limitation-'.repeat(12)}`,
          migrationTemplateCount: 1, verifiedMigrationTemplateCount: 0, reviewOnlyTemplateProposalCount: 1,
          candidateCountWithoutTemplateProposal: 0,
          migrationTemplatePromotion: { candidateIds: ['candidate-long-review'], proposalModes: ['manual-guidance'], nextStep: 'Review manually.' },
          sourceHealth: { status: 'healthy', lastSuccessAt: '2026-11-10T00:00:00.000Z', nextAttemptAt: null, failureCount: 0, parserStatus: 'review-only' },
        }],
      }),
    });
  });

  await page.goto('/dashboard/providers', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('region', { name: 'Migration template promotion queue' })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long provider review queue metadata').toEqual([]);
  await page.unroute('**/api/provider-coverage');
});
