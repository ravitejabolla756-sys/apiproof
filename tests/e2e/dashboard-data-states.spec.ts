import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test.describe('authenticated dashboard data states', () => {
  test('announces dashboard overview loading before the response resolves', async ({ page }) => {
    await signIn(page);
    let releaseOverview: (() => void) | undefined;
    const overviewLoading = new Promise<void>((resolve) => { releaseOverview = resolve; });
    await page.route('**/api/overview', async (route) => { await overviewLoading; await route.continue(); });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Loading workspace overview...');
    releaseOverview?.();
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/overview');
  });

  test('announces pull-request loading before the response resolves', async ({ page }) => {
    await signIn(page);
    let releasePullRequests: (() => void) | undefined;
    const pullRequestsLoading = new Promise<void>((resolve) => { releasePullRequests = resolve; });
    await page.route('**/api/pull-requests', async (route) => { await pullRequestsLoading; await route.continue(); });

    await page.goto('/dashboard/pull-requests', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Loading pull requests...');
    releasePullRequests?.();
    await expect(page.getByRole('heading', { name: 'Pull Request Queue' })).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/pull-requests');
  });

  test('announces findings loading before the response resolves', async ({ page }) => {
    await signIn(page);
    let releaseFindings: (() => void) | undefined;
    const findingsLoading = new Promise<void>((resolve) => { releaseFindings = resolve; });
    await page.route('**/api/findings', async (route) => { await findingsLoading; await route.continue(); });

    await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toContainText('Querying database findings...');
    releaseFindings?.();
    await expect(page.getByRole('heading', { name: 'API Compatibility Findings' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Search findings')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filter by severity' }).getByRole('button', { name: 'all' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Filter by provider' })).toBeVisible();
    await page.unroute('**/api/findings');
  });

  test('announces compatibility-map and provider-rule failures as alerts', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/compatibility-map', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Compatibility data could not be loaded (503).' }) });
    });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const compatibilityAlert = page.getByRole('alert').filter({ hasText: 'Compatibility data could not be loaded' });
    await expect(compatibilityAlert).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'compatibility-map error state').toEqual([]);
    await page.unroute('**/api/compatibility-map');

    await page.route('**/api/provider-rules', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Provider rules are temporarily unavailable.' }) });
    });
    await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
    const providerAlert = page.getByRole('alert').filter({ hasText: 'Provider rules are temporarily unavailable.' });
    await expect(providerAlert).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'provider-rule error state').toEqual([]);
    await page.unroute('**/api/provider-rules');
  });

  test('announces Slack connection failures as alerts', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/slack/connection', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Slack status is unavailable.' }) });
    });
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    const slackAlert = page.getByRole('alert').filter({ hasText: 'Slack status is unavailable.' });
    await expect(slackAlert).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'Slack connection error state').toEqual([]);
    await page.unroute('**/api/slack/connection');
  });

  test('announces workspace settings data failures and exposes retry', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/github/repositories', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
    });
    await page.route('**/api/billing/subscription', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Billing is temporarily unavailable.' }) });
    });
    await page.route('**/api/slack/connection', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
    });
    await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
    const settingsAlert = page.getByRole('alert').filter({ hasText: 'Workspace settings data is temporarily unavailable.' });
    await expect(settingsAlert).toBeVisible({ timeout: 30_000 });
    await expect(settingsAlert.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'workspace settings error state').toEqual([]);
    await settingsAlert.getByRole('button', { name: 'Retry' }).click();
    await expect(settingsAlert).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/github/repositories');
    await page.unroute('**/api/billing/subscription');
    await page.unroute('**/api/slack/connection');
  });

  test('announces finding workbench action feedback and busy states', async ({ page }) => {
    await signIn(page);
    let findingRequests = 0;
    await page.route('**/api/findings/finding_a11y', async (route) => {
      findingRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          finding: {
            id: 'finding_a11y', provider: 'Fixture', change_id: 'change_a11y', title: 'Fixture migration finding',
            description: 'A finding used to verify action announcements.', severity: 'P1', confidence: 'high',
            file_path: 'src/example.ts', line_number: 12, symbol: 'example', reason: 'Fixture reason', source_snippet: 'example()',
            status: 'open', created_at: '2026-11-07T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'fixture/owl',
            repo_owner: 'fixture', default_branch: 'main', evidence: [], reasonCodes: [],
            capability: {
              source: 'productization', baselineSha: 'baseline', scanId: 'scan', recommendedNextAction: 'MIGRATION_AVAILABLE',
              migrationAvailable: true, verificationAvailable: true, evidenceCoverage: 'complete', reviewStatus: 'reviewed',
              remediation: { mode: 'transform', templateId: 'template', limitation: 'fixture', summary: 'fixture', steps: ['fixture'], validation: ['fixture'] },
            },
          },
          migration: null,
        }),
      });
    });

    let releasePlan: (() => void) | undefined;
    const planResponse = new Promise<void>((resolve) => { releasePlan = resolve; });
    let planRequests = 0;
    await page.route('**/api/migrations/plan', async (route) => {
      planRequests += 1;
      if (planRequests === 1) {
        await planResponse;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Migration planner is temporarily unavailable.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ migration: { id: 'migration_a11y', status: 'planned', patch_diff: '', patch_digest: 'digest', lifecycle_state: 'Migration Planned', target_branch: 'owl-migration' } }),
      });
    });

    await page.goto('/dashboard/findings/finding_a11y', { waitUntil: 'domcontentloaded' });
    const planButton = page.locator('button').filter({ hasText: /Create migration plan|Creating plan…/ });
    await planButton.click();
    await expect(page.getByRole('status')).toContainText('Creating migration plan…');
    releasePlan?.();
    const planError = page.getByRole('alert').filter({ hasText: 'Migration planner is temporarily unavailable.' });
    await expect(planError).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'finding plan error').toEqual([]);
    await planButton.click();
    await expect(page.getByRole('status')).toContainText('Migration plan created. Review it before requesting a verified Draft PR.');
    expect((await new AxeBuilder({ page }).include('[role="status"]').analyze()).violations, 'finding success status').toEqual([]);

    expect(findingRequests).toBe(1);
    expect(planRequests).toBe(2);
    await page.unroute('**/api/migrations/plan');
  });

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
      await expect(page.getByRole('status')).toContainText(state.empty);
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
    let detailRetryStarted = false;
    await page.route('**/api/repositories/repo_recovery', async (route) => {
      detailRequests += 1;
      if (!detailRetryStarted) {
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
    detailRetryStarted = true; await page.getByRole('button', { name: 'Try again' }).click();
    await expect(detailAlert).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'recovery-repo' })).toBeVisible({ timeout: 30_000 });
    expect(detailRequests).toBeGreaterThanOrEqual(2);
    expect(detailRequests).toBeLessThanOrEqual(3);
    await page.unroute('**/api/repositories/repo_recovery');
  });
});
