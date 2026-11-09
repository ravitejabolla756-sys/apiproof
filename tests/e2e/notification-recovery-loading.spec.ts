import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps notification recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let firstFailure = true;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });

  await page.route('**/api/account/notifications', async (route) => {
    if (firstFailure) {
      firstFailure = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Notification preferences are temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preferences: [] }) });
  });

  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Notification preferences are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  const retry = alert.getByRole('button', { name: 'Try again' });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Notification preferences table' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/account/notifications');
});
