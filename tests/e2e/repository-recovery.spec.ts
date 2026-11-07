import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test.describe('repository recovery journeys', () => {
  test('recovers repository list and detail routes after transient failures', async ({ page }) => {
    await signIn(page);

    let listAttempts = 0;
    await page.route('**/api/repositories', async (route) => {
      listAttempts += 1;
      if (listAttempts === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Repository list temporarily unavailable.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ repositories: [{ id: 'repo-ui13', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: 'gh-1', default_branch: 'main', status: 'healthy', last_scan_at: null, created_at: '2026-11-07T00:00:00.000Z', findings_count: 0, scans_count: 0, last_scan_sha: null }] }),
      });
    });

    await page.goto('/dashboard/repositories');
    await expect(page.getByRole('alert').filter({ hasText: 'Repository list temporarily unavailable.' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('link', { name: 'owl', exact: true })).toBeVisible();

    let detailAttempts = 0;
    let detailRetryStarted = false;
    await page.route(/\/api\/repositories\/repo-ui13(?:\?.*)?$/, async (route) => {
      detailAttempts += 1;
      if (!detailRetryStarted) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Repository details temporarily unavailable.' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repository: { id: 'repo-ui13', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: 'gh-1', default_branch: 'main', status: 'healthy', last_scan_at: null, created_at: '2026-11-07T00:00:00.000Z' },
          scans: [],
          findings: [],
        }),
      });
    });

    await page.goto('/dashboard/repositories/repo-ui13');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Repository details temporarily unavailable.' })).toBeVisible();
    detailRetryStarted = true; await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible();
    expect(listAttempts).toBeGreaterThanOrEqual(2);
    expect(listAttempts).toBeLessThanOrEqual(3);
    expect(detailAttempts).toBeGreaterThanOrEqual(2);
    expect(detailAttempts).toBeLessThanOrEqual(3);
    await page.unroute('**/api/repositories');
    await page.unroute(/\/api\/repositories\/repo-ui13(?:\?.*)?$/);
  });
});
