import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
      const alertResults = await new AxeBuilder({ page }).include('[role="alert"]').analyze();
      expect(alertResults.violations, `${state.path} error state`).toEqual([]);
      await expect(page.getByText(state.empty, { exact: false })).toHaveCount(0);
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(alert).toHaveCount(0);
      await expect(page.getByText(state.empty, { exact: false })).toBeVisible({ timeout: 30_000 });
      const emptyResults = await new AxeBuilder({ page }).include('#main-content').analyze();
      expect(emptyResults.violations, `${state.path} empty state`).toEqual([]);
      expect(requestCount).toBeGreaterThanOrEqual(2);
      expect(requestCount).toBeLessThanOrEqual(3);
      await page.unroute(state.api);
    }
  });

  test('recovers repository list and detail loading failures', async ({ page }) => {
    await signIn(page);

    let listRequests = 0;
    await page.route('**/api/repositories', async (route) => {
      listRequests += 1;
      if (listRequests === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Repositories are temporarily unavailable.' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
    });

    await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
    const listAlert = page.getByRole('alert').filter({ hasText: 'Repositories are temporarily unavailable.' });
    await expect(listAlert).toBeVisible({ timeout: 30_000 });
    const listAlertResults = await new AxeBuilder({ page }).include('[role="alert"]').analyze();
    expect(listAlertResults.violations, '/dashboard/repositories error state').toEqual([]);
    await expect(page.getByText('No repositories found matching your filter.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(listAlert).toHaveCount(0);
    await expect(page.getByText('No repositories found matching your filter.')).toBeVisible({ timeout: 30_000 });
    const listEmptyResults = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(listEmptyResults.violations, '/dashboard/repositories empty state').toEqual([]);
    expect(listRequests).toBeGreaterThanOrEqual(2);
    expect(listRequests).toBeLessThanOrEqual(3);
    await page.unroute('**/api/repositories');

    let detailRequests = 0;
    await page.route('**/api/repositories/repo_recovery', async (route) => {
      detailRequests += 1;
      if (detailRequests <= 2) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Repository details are temporarily unavailable.' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repository: {
            id: 'repo_recovery',
            owner: 'fixture',
            name: 'recovery-repo',
            full_name: 'fixture/recovery-repo',
            github_repository_id: '123',
            default_branch: 'main',
            status: 'connected',
            last_scan_at: null,
            created_at: '2026-11-07T00:00:00.000Z',
          },
          scans: [],
          findings: [],
        }),
      });
    });

    await page.goto('/dashboard/repositories/repo_recovery', { waitUntil: 'domcontentloaded' });
    const detailAlert = page.getByRole('alert').filter({ hasText: 'Repository details are temporarily unavailable.' });
    await expect(detailAlert).toBeVisible({ timeout: 30_000 });
    const detailAlertResults = await new AxeBuilder({ page }).include('[role="alert"]').analyze();
    expect(detailAlertResults.violations, '/dashboard/repositories detail error state').toEqual([]);
    await expect(page.getByRole('heading', { name: 'recovery-repo' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(detailAlert).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'recovery-repo' })).toBeVisible({ timeout: 30_000 });
    expect(detailRequests).toBeGreaterThanOrEqual(2);
    expect(detailRequests).toBeLessThanOrEqual(3);
    await page.unroute('**/api/repositories/repo_recovery');
  });
});
