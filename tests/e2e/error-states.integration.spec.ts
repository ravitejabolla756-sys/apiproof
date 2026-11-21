import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('repository page presents a recoverable API failure', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Repository list is temporarily unavailable.', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Repositories cannot be displayed until the connection is restored.')).toBeVisible();
});

test('findings page distinguishes an empty result from an API failure', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/findings', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ findings: [] }) });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('No compatibility findings detected', { exact: true })).toBeVisible();
  await expect(page.getByText('Findings cannot be displayed', { exact: true })).toHaveCount(0);
});

test('repository scan failure is shown without claiming completion', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repositories: [{
          id: 'test-repository',
          owner: 'apiproof',
          name: 'fixture-repository',
          full_name: 'apiproof/fixture-repository',
          github_repository_id: '12345',
          default_branch: 'main',
          status: 'connected',
          last_scan_at: null,
          created_at: '2026-11-22T00:00:00.000Z',
          findings_count: 0,
          scans_count: 0,
          last_scan_sha: null,
        }],
      }),
    });
  });
  await page.route('**/api/repositories/test-repository/scan', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'worker unavailable' }) });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Scan', exact: true }).click();

  await expect(page.getByText('Scan execution failed.', { exact: true })).toBeVisible();
  await expect(page.getByText('Scan complete:', { exact: false })).toHaveCount(0);
});
