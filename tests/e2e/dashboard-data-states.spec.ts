import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('authenticated dashboard data states', () => {
  test('shows recoverable errors instead of false empty states', async ({ page }) => {
    await signIn(page);

    const cases = [
      {
        path: '/dashboard/findings',
        api: '**/api/findings',
        message: 'Findings are temporarily unavailable.',
        response: { findings: [] },
        empty: 'No compatibility findings detected',
      },
      {
        path: '/dashboard/migrations',
        api: '**/api/migrations',
        message: 'Migration records are temporarily unavailable.',
        response: { migrations: [] },
        empty: 'No active evidence review records yet',
      },
      {
        path: '/dashboard/pull-requests',
        api: '**/api/pull-requests',
        message: 'Pull requests are temporarily unavailable.',
        response: { pullRequests: [] },
        empty: 'No pull requests created yet',
      },
      {
        path: '/dashboard/activity',
        api: '**/api/activity',
        message: 'Activity is temporarily unavailable.',
        response: { activities: [] },
        empty: 'No activity recorded yet',
      },
      {
        path: '/dashboard/inventory',
        api: '**/api/inventory',
        message: 'API inventory is temporarily unavailable.',
        response: { providers: [] },
        empty: 'No API inventory records are available yet',
      },
      {
        path: '/dashboard/compatibility',
        api: '**/api/compatibility-proof',
        message: 'Compatibility records are temporarily unavailable.',
        response: { claimsAvailable: false, reason: 'no-reviewed-records', changes: [] },
        empty: 'No reviewed compatibility claims are available',
      },
      {
        path: '/dashboard/providers',
        api: '**/api/provider-coverage',
        message: 'Provider coverage is temporarily unavailable.',
        response: {
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
        },
        empty: 'No provider coverage records are available yet',
      },
    ] as const;

    for (const state of cases) {
      let requestCount = 0;
      await page.route(state.api, async (route) => {
        requestCount += 1;
        if (requestCount === 1) {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: state.message }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.response) });
      });

      await page.goto(state.path, { waitUntil: 'domcontentloaded' });
      const alert = page.getByRole('alert').filter({ hasText: state.message });
      await expect(alert).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(state.empty, { exact: false })).toHaveCount(0);
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(alert).toHaveCount(0);
      await expect(page.getByText(state.empty, { exact: false })).toBeVisible({ timeout: 30_000 });
      expect(requestCount).toBe(2);
      await page.unroute(state.api);
    }
  });
});
