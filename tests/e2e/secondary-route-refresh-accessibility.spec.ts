import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps activity and provider coverage refresh actions touch-friendly', async ({ page }) => {
  await signIn(page);

  await page.route('**/api/activity', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activities: [] }),
    });
  });
  await page.goto('/dashboard/activity', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('No activity recorded yet')).toBeVisible();
  expect((await page.getByRole('button', { name: 'Refresh' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'activity empty state').toEqual([]);
  await page.unroute('**/api/activity');

  await page.route('**/api/provider-coverage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          configuredSources: 0,
          discoveryProviders: 0,
          providersWithReviewedRules: 0,
          reviewedRules: 0,
          providersWithMigrationTemplates: 0,
          migrationTemplates: 0,
          providersWithVerifiedMigrationTemplates: 0,
          verifiedMigrationTemplates: 0,
          providersWithReviewOnlyTemplateProposals: 0,
          reviewOnlyTemplateProposals: 0,
          autoFixPolicy: 'guarded-human-review',
          reviewQueue: { P0: 0, P1: 0, P2: 0 },
          migrationTemplatePromotionQueue: [],
        },
        providers: [],
      }),
    });
  });
  await page.goto('/dashboard/providers', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('No provider coverage records are available yet')).toBeVisible();
  expect((await page.getByRole('button', { name: 'Refresh' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'provider coverage empty state').toEqual([]);
  await page.unroute('**/api/provider-coverage');
});
