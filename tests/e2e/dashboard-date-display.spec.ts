import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

async function expectUnavailableDateBoundary(page: Parameters<typeof signIn>[0]) {
  await expect(page.getByText(/Unavailable/)).not.toHaveCount(0);
  await expect(page.getByText('Invalid Date', { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
}

test('fails closed for malformed repository and pull-request timestamps', async ({ page }) => {
  await signIn(page);

  await page.route('**/api/repositories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repositories: [{
        id: 'repo-date-boundary', owner: 'fixture', name: 'owl', full_name: 'fixture/owl',
        github_repository_id: 'gh-date-boundary', default_branch: 'main', status: 'healthy',
        last_scan_at: '2026-02-31T12:00:00.000Z', created_at: '2026-11-08T00:00:00.000Z',
        findings_count: 0, scans_count: 1, last_scan_sha: null,
      }] }),
    });
  });
  await page.goto('/dashboard/repositories');
  await expectUnavailableDateBoundary(page);
  await page.unroute('**/api/repositories');

  await page.route('**/api/pull-requests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pullRequests: [{
        id: 'pr-date-boundary', number: 12, title: 'Fixture draft PR', branch_name: 'owl/fixture',
        base_branch: 'main', url: 'https://example.test/pr/12', state: 'open',
        created_at: '2026-04-31T12:00:00.000Z', patch_digest: 'digest', repo_name: 'owl',
        repo_full_name: 'fixture/owl', symbol: 'client.request', file_path: 'src/client.ts',
        change_id: 'fixture-change',
      }] }),
    });
  });
  await page.goto('/dashboard/pull-requests');
  await expectUnavailableDateBoundary(page);
  await page.unroute('**/api/pull-requests');
});

test('fails closed for malformed repository scan completion timestamps', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories/repo-scan-date-boundary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repository: {
          id: 'repo-scan-date-boundary', owner: 'fixture', name: 'owl', full_name: 'fixture/owl',
          github_repository_id: 'gh-scan-date-boundary', default_branch: 'main', status: 'healthy',
          last_scan_at: null, created_at: '2026-11-08T00:00:00.000Z',
        },
        scans: [{ id: 'scan-date-boundary', sha: 'abcdef1234567890', status: 'completed', analyzed_files: 1,
          total_files: 1, findings_count: 0, completed_at: '2026-02-30T12:00:00.000Z' }],
        findings: [],
      }),
    });
  });
  await page.goto('/dashboard/repositories/repo-scan-date-boundary');
  await expectUnavailableDateBoundary(page);
  await page.unroute('**/api/repositories/repo-scan-date-boundary');
});

test('fails closed for malformed billing period timestamps', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-02-31T12:00:00.000Z' },
      plan: { id: 'free', name: 'Free', description: 'Fixture plan', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } },
      metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } },
    }) });
  });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });
  await page.goto('/dashboard/settings');
  await expect(page.getByText('Current billing period resets on Unavailable.')).toBeVisible();
  await expect(page.getByText(/Invalid Date/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
  await page.unroute('**/api/slack/connection');
});

test('fails closed for malformed dashboard overview timestamps', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspace: { id: 'workspace-date-boundary', name: 'Fixture workspace', slug: 'fixture', role: 'owner', repositoryCount: 1, scanCount: 1, openFindingCount: 0 },
        stats: { connectedRepositories: 1, scansCompleted: 1, openFindings: 0, criticalFindings: 0, draftPrsCount: 0, providerRulesPending: 0, providerRulesApproved: 0, rescansPending: 0, rescansProcessing: 0, rescansFailed: 0 },
        repositories: [{ id: 'repo-overview-date-boundary', name: 'owl', owner: 'fixture', full_name: 'fixture/owl', default_branch: 'main', status: 'healthy', last_scan_at: '2026-02-31T12:00:00.000Z', findings_count: 0 }],
        criticalFinding: null,
        recentActivities: [{ id: 'activity-date-boundary', type: 'scan', title: 'Fixture activity', description: 'Fixture activity', created_at: '2026-04-31T12:00:00.000Z', repo_name: 'owl' }],
        recentProviderChanges: [{ id: 'change-date-boundary', provider_id: 'fixture', title: 'Fixture provider change', description: 'Fixture change', source_url: 'https://example.test/change', published_at: '2026-02-31T12:00:00.000Z', first_seen_at: '2026-02-31T12:00:00.000Z' }],
        findingsThisWeek: [{ day: '2026-02-31', total: 1, critical: 0, high: 1, warning: 0 }],
        recentFixes: [{ id: 'fix-date-boundary', status: 'pending', created_at: '2026-04-31T12:00:00.000Z', finding_title: 'Fixture fix', repo_name: 'owl', pr_url: null, pr_state: null }],
      }),
    });
  });
  await page.route('**/api/compatibility-map', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
  });
  await page.goto('/dashboard');
  await expect(page.getByText(/Unavailable/)).toHaveCount(5);
  await expect(page.getByText(/Invalid Date/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
  await page.unroute('**/api/overview');
  await page.unroute('**/api/compatibility-map');
});

test('fails closed for malformed billing usage projections', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
      plan: { id: 'free', name: 'Free', description: 'Fixture plan', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } },
      metrics: { repositories: { current: null, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } },
    }) });
  });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });
  await page.goto('/dashboard/settings');
  await expect(page.getByRole('alert').filter({ hasText: 'Billing summary is temporarily unavailable.' })).toBeVisible();
  await expect(page.getByText('NaN', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
  await page.unroute('**/api/slack/connection');
});
