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

test('announces repository-detail scan failure and success without false feedback', async ({ page }) => {
  await signIn(page);
  const repositoryId = 'repo-scan-feedback';
  const detailPayload = {
    repository: {
      id: repositoryId, owner: 'fixture', name: 'owl', full_name: 'fixture/owl',
      github_repository_id: 'gh-scan-feedback', default_branch: 'main', status: 'healthy',
      last_scan_at: null, created_at: '2026-11-08T00:00:00.000Z',
    },
    scans: [],
    findings: [],
  };
  await page.route(`**/api/repositories/${repositoryId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailPayload) });
  });
  let scanAttempts = 0;
  await page.route(`**/api/repositories/${repositoryId}/scan`, async (route) => {
    scanAttempts += 1;
    if (scanAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Scan service is temporarily unavailable.' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { findingsCount: 0 } }) });
  });

  await page.goto(`/dashboard/repositories/${repositoryId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible({ timeout: 30_000 });
  const scan = page.getByRole('button', { name: 'Run AST Scan', exact: true }).first();
  await scan.focus();
  await page.keyboard.press('Enter');
  const failure = page.getByRole('alert').filter({ hasText: 'Scan service is temporarily unavailable.' });
  await expect(failure).toBeVisible({ timeout: 30_000 });
  await expect(failure).toHaveAttribute('aria-live', 'assertive');
  await expect(page.getByText('Scan complete: 0 findings recorded.')).toHaveCount(0);
  await expect(scan).not.toBeDisabled();

  await scan.focus();
  await page.keyboard.press('Enter');
  const success = page.getByRole('status').filter({ hasText: 'Scan complete: 0 findings recorded.' });
  await expect(success).toBeVisible({ timeout: 30_000 });
  await expect(success).toHaveAttribute('aria-live', 'polite');
  await expect(failure).toHaveCount(0);
  expect(scanAttempts).toBe(2);
  await page.unroute(`**/api/repositories/${repositoryId}`);
  await page.unroute(`**/api/repositories/${repositoryId}/scan`);
});
