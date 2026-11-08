import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks secondary workbench refresh controls busy while data is pending', async ({ page }) => {
  await signIn(page);

  const routes = [
    { path: '/dashboard/activity', api: '**/api/activity', loading: 'Loading activity log...', empty: 'No activity recorded yet', payload: { activities: [] } },
    { path: '/dashboard/inventory', api: '**/api/inventory', loading: 'Loading API provider registry...', empty: 'No API inventory records are available yet', payload: { providers: [], items: [] } },
    { path: '/dashboard/migrations', api: '**/api/migrations', loading: 'Loading review records...', empty: 'No active evidence review records yet', payload: { migrations: [] } },
    { path: '/dashboard/providers', api: '**/api/provider-coverage', loading: 'Loading provider coverage…', empty: 'No provider coverage records are available yet', payload: { summary: { configuredSources: 0, discoveryProviders: 0, providersWithReviewedRules: 0, reviewedRules: 0, providersWithMigrationTemplates: 0, migrationTemplates: 0, providersWithVerifiedMigrationTemplates: 0, verifiedMigrationTemplates: 0, providersWithReviewOnlyTemplateProposals: 0, reviewOnlyTemplateProposals: 0, autoFixPolicy: 'guarded-human-review', reviewQueue: { P0: 0, P1: 0, P2: 0 }, migrationTemplatePromotionQueue: [] }, providers: [] } },
    { path: '/dashboard/pull-requests', api: '**/api/pull-requests', loading: 'Loading pull requests...', empty: 'No pull requests created yet', payload: { pullRequests: [] } },
  ];

  for (const routeFixture of routes) {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(routeFixture.api, async (route) => {
      await pending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(routeFixture.payload) });
    });

    await page.goto(routeFixture.path, { waitUntil: 'domcontentloaded' });
    const loading = page.getByRole('status').filter({ hasText: routeFixture.loading });
    const refresh = page.getByRole('button', { name: 'Refresh' });
    await expect(loading).toBeVisible();
    await expect(refresh).toBeDisabled();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');

    release?.();
    await expect(page.getByText(routeFixture.empty)).toBeVisible({ timeout: 30_000 });
    await expect(refresh).not.toBeDisabled();
    await expect(refresh).not.toHaveAttribute('aria-busy');
    await page.unroute(routeFixture.api);
  }
});
