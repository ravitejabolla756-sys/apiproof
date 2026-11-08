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

test('announces provider coverage loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseCoverage: (() => void) | undefined;
  const coverageLoading = new Promise<void>((resolve) => { releaseCoverage = resolve; });
  await page.route('**/api/provider-coverage', async (route) => {
    await coverageLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: { configuredSources: 0, discoveryProviders: 0, providersWithReviewedRules: 0, reviewedRules: 0, providersWithMigrationTemplates: 0, migrationTemplates: 0, providersWithVerifiedMigrationTemplates: 0, verifiedMigrationTemplates: 0, providersWithReviewOnlyTemplateProposals: 0, reviewOnlyTemplateProposals: 0, autoFixPolicy: 'guarded-human-review', reviewQueue: { P0: 0, P1: 0, P2: 0 }, migrationTemplatePromotionQueue: [] }, providers: [] }) });
  });

  await page.goto('/dashboard/providers', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading provider coverage…' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  releaseCoverage?.();
  await expect(page.getByText('No provider coverage records are available yet')).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/provider-coverage');
});

test('announces activity and migration loading as busy states', async ({ page }) => {
  await signIn(page);
  for (const state of [
    { path: '/dashboard/activity', api: '**/api/activity', loading: 'Loading activity log...', heading: 'Workspace Audit Activity Log', empty: 'No activity recorded yet' },
    { path: '/dashboard/migrations', api: '**/api/migrations', loading: 'Loading review records...', heading: 'Evidence Review Workbench', empty: 'No active evidence review records yet' },
  ]) {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(state.api, async (route) => { await pending; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.path.endsWith('activity') ? { activities: [] } : { migrations: [] }) }); });
    await page.goto(state.path, { waitUntil: 'domcontentloaded' });
    const loadingStatus = page.getByRole('status').filter({ hasText: state.loading }); await expect(loadingStatus).toContainText(state.loading);
    await expect(loadingStatus).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { name: state.heading })).toBeVisible();
    await expect(page.getByRole('heading', { name: state.heading }).locator('..').locator('..').locator('..')).toHaveAttribute('aria-busy', 'true');
    release?.();
    await expect(page.getByText(state.empty)).toBeVisible({ timeout: 30_000 });
    await page.unroute(state.api);
  }
});
