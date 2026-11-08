import { expect, test, type Route } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps workspace-settings recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  const failUntilRetry = async (route: Route) => {
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace settings data is temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.continue();
  };

  await page.route('**/api/github/repositories', failUntilRetry);
  await page.route('**/api/billing/subscription', failUntilRetry);
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Workspace settings data is temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const retry = alert.getByRole('button', { name: 'Retry settings load' });
  allowRecovery = true;
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Workspace Settings & Billing' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
});
