import { expect, test, type Route } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps command-palette search recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  const failUntilRetry = async (route: Route) => {
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Search data is temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [], providers: [] }) });
  };
  await page.route('**/api/repositories', failUntilRetry);
  await page.route('**/api/inventory', failUntilRetry);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Search repos, findings, SDKs/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Search MY OWL' });
  const alert = dialog.getByRole('alert').filter({ hasText: 'Search data is temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  const retry = alert.getByRole('button');
  allowRecovery = true;
  await retry.click();
  await expect(alert).toBeVisible();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(alert).toHaveCount(0, { timeout: 30_000 });
  await expect(dialog.getByRole('button', { name: 'Repositories', exact: true })).toBeVisible();
  await page.unroute('**/api/repositories');
  await page.unroute('**/api/inventory');
});
