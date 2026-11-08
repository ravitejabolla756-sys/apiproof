import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks repository scan action busy while the scan request is pending', async ({ page }) => {
  await signIn(page);
  const repository = {
    id: 'repo-scan-loading', owner: 'fixture', name: 'owl', full_name: 'fixture/owl',
    github_repository_id: 'gh-scan-loading', default_branch: 'main', status: 'healthy',
    last_scan_at: null, created_at: '2026-11-07T00:00:00.000Z', findings_count: 0, scans_count: 0, last_scan_sha: null,
  };
  await page.route('**/api/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [repository] }) });
  });
  let releaseScan: (() => void) | undefined;
  const scanPending = new Promise<void>((resolve) => { releaseScan = resolve; });
  await page.route('**/api/repositories/repo-scan-loading/scan', async (route) => {
    await scanPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { findingsCount: 0 } }) });
  });
  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  const scan = page.getByRole('button', { name: 'Scan', exact: true });
  await expect(scan).toBeVisible({ timeout: 30_000 });
  await scan.click();
  await expect(page.getByRole('button', { name: /Scanning/ })).toHaveAttribute('aria-busy', 'true');
  releaseScan?.();
  await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/repositories/repo-scan-loading/scan');
  await page.unroute('**/api/repositories');
});
