import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps repository-detail recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  await page.route(/\/api\/repositories\/repo-detail-recovery(?:\?.*)?$/, async (route) => {
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Repository details are temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        repository: { id: 'repo-detail-recovery', owner: 'acme', name: 'owl', full_name: 'acme/owl', github_repository_id: 'gh-recovery', default_branch: 'main', status: 'healthy', last_scan_at: null, created_at: '2026-11-08T00:00:00.000Z' },
        scans: [],
        findings: [],
      }),
    });
  });

  await page.goto('/dashboard/repositories/repo-detail-recovery', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Repository details are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const retry = alert.getByRole('button', { name: 'Try again' });
  allowRecovery = true;
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.unroute(/\/api\/repositories\/repo-detail-recovery(?:\?.*)?$/);
});
