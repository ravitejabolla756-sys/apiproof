import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

async function expectLinksTouchSized(links: Locator, label: string) {
  expect(await links.count(), `${label} should expose at least one action link`).toBeGreaterThan(0);
  for (let index = 0; index < await links.count(); index += 1) {
    const link = links.nth(index);
    await expect(link, `${label} #${index + 1}`).toBeVisible();
    expect((await link.boundingBox())?.height, `${label} #${index + 1}`).toBeGreaterThanOrEqual(44);
  }
}

test('keeps core workbench action links touch-sized on mobile', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route('**/api/overview', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      workspace: { id: 'workspace-fixture', name: 'Fixture workspace', slug: 'fixture', role: 'owner', repositoryCount: 1, scanCount: 1, openFindingCount: 1 },
      stats: { connectedRepositories: 1, scansCompleted: 1, openFindings: 1, criticalFindings: 1, draftPrsCount: 0, providerRulesPending: 0, providerRulesApproved: 0, rescansPending: 0, rescansProcessing: 0, rescansFailed: 0 },
      repositories: [{ id: 'repo-workbench', name: 'owl', owner: 'fixture', full_name: 'fixture/owl', default_branch: 'main', status: 'healthy', last_scan_at: '2026-11-08T00:00:00.000Z', findings_count: 1 }],
      criticalFinding: { id: 'finding-workbench', title: 'Fixture breaking change', description: 'Fixture description', severity: 'critical', symbol: 'client.request', file_path: 'src/client.ts', status: 'open', repo_name: 'owl', repo_full_name: 'fixture/owl' },
      recentActivities: [],
      recentProviderChanges: [{ id: 'change-workbench', provider_id: 'fixture', title: 'Fixture provider change', description: 'Fixture provider change description', source_url: 'https://example.test/change', published_at: '2026-11-08T00:00:00.000Z', first_seen_at: '2026-11-08T00:00:00.000Z' }],
      findingsThisWeek: [],
      recentFixes: [],
    }) });
  });
  await page.route('**/api/compatibility-map', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
  });
  await page.goto('/dashboard');
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
  await expectLinksTouchSized(page.locator('main#main-content a'), '/dashboard');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/dashboard').toEqual([]);
  await page.unroute('**/api/overview');
  await page.unroute('**/api/compatibility-map');

  await page.route('**/api/findings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ findings: [{ id: 'finding-workbench', provider: 'Fixture', change_id: 'fixture-change', title: 'Fixture breaking change', description: 'Fixture description', severity: 'critical', confidence: 'high', file_path: 'src/client.ts', line_number: 10, symbol: 'client.request', status: 'open', created_at: '2026-11-08T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'fixture/owl', capability: { migrationAvailable: true, recommendedNextAction: 'MIGRATION_AVAILABLE' } }] }) });
  });
  await page.goto('/dashboard/findings');
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
  await expectLinksTouchSized(page.locator('main#main-content a'), '/dashboard/findings');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/dashboard/findings').toEqual([]);
  await page.unroute('**/api/findings');

  await page.route('**/api/migrations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ migrations: [] }) });
  });
  await page.goto('/dashboard/migrations');
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
  await expectLinksTouchSized(page.locator('main#main-content a'), '/dashboard/migrations');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/dashboard/migrations').toEqual([]);
  await page.unroute('**/api/migrations');

  await page.route('**/api/pull-requests', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pullRequests: [{ id: 'pr-workbench', number: 12, title: 'Fixture draft PR', branch_name: 'owl/fixture', base_branch: 'main', url: 'https://example.test/pr/12', state: 'open', created_at: '2026-11-08T00:00:00.000Z', patch_digest: 'digest', repo_name: 'owl', repo_full_name: 'fixture/owl', symbol: 'client.request', file_path: 'src/client.ts', change_id: 'fixture-change' }] }) });
  });
  await page.goto('/dashboard/pull-requests');
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
  await expectLinksTouchSized(page.locator('main#main-content a'), '/dashboard/pull-requests');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/dashboard/pull-requests').toEqual([]);
  await page.unroute('**/api/pull-requests');
});

test('contains long pull-request metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  const longTitle = 'Long pull request '.repeat(16);
  await page.route('**/api/pull-requests', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pullRequests: [{
        id: 'pr-long-metadata', number: 42, title: longTitle, branch_name: 'feature/'.concat('long-branch-'.repeat(12)),
        base_branch: 'main', url: 'https://example.test/pr/42', state: 'open', created_at: '2026-11-10T00:00:00.000Z',
        patch_digest: 'digest-long-metadata', repo_name: 'owl', repo_full_name: 'fixture/owl', symbol: 'client.request',
        file_path: 'src/client.ts', change_id: 'fixture-change',
      }] }),
    });
  });
  await page.goto('/dashboard/pull-requests');
  await expect(page.getByText(longTitle, { exact: false })).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long pull-request metadata').toEqual([]);
  await page.unroute('**/api/pull-requests');
});
