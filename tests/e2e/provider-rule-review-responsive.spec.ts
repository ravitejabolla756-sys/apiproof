import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long provider-rule review metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/provider-rules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          id: 'candidate-review-long', providerId: `provider-${'identifier-'.repeat(12)}`,
          title: `Rule ${'title-name-'.repeat(14)}`, description: `Description ${'long-review-description-'.repeat(18)}`,
          status: 'needs_review', severity: 'high', payload: { apiOperationPatterns: [`operation.${'pattern-'.repeat(10)}`] },
          source: { url: 'https://example.test/change', type: 'official' }, createdAt: '2026-11-10T00:00:00.000Z', reviewNotes: null,
          coverage: { priority: 'P0', reviewBlockers: [`Blocker ${'long-review-blocker-'.repeat(14)}`], evidenceClaims: 1, hasExecutableTemplate: false, nextAction: 'fixture-and-review' },
          reviewPack: null,
        }],
        coverageSummary: { candidates: 1, pendingCandidates: 1, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [`provider-${'missing-'.repeat(10)}`], providersWithExecutableTemplates: [] },
      }),
    });
  });

  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Rule title-name/ })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long provider-rule review metadata').toEqual([]);
  await page.unroute('**/api/provider-rules');
});
