import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long repository and activity metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/overview', async (route) => {
    const response = await route.fetch();
    const body = await response.json() as Record<string, unknown>;
    body.repositories = [{
      id: 'repo-dashboard-long', name: `repo-${'name-'.repeat(14)}`, owner: 'fixture', full_name: `fixture/${'repository-name-'.repeat(12)}`,
      default_branch: `feature/${'branch-name-'.repeat(12)}`, status: 'healthy', last_scan_at: null, findings_count: 0,
    }];
    body.recentActivities = [{
      id: 'activity-dashboard-long', type: 'scan', title: `Activity ${'title-name-'.repeat(14)}`,
      description: `Description ${'long-activity-description-'.repeat(18)}`, created_at: '2026-11-10T00:00:00.000Z', repo_name: 'fixture',
    }];
    await route.fulfill({ response, body: JSON.stringify(body) });
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/repo-name-name/).first()).toBeVisible({ timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long dashboard metadata').toEqual([]);
  await page.unroute('**/api/overview');
});
