import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps activity recovery visible and busy while the retry is pending', async ({ page }) => {
  await signIn(page);
  let requests = 0;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });

  await page.route('**/api/activity', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Activity is temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activities: [] }) });
  });

  await page.goto('/dashboard/activity', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Activity is temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });

  const retry = alert.getByRole('button', { name: 'Try again' });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');

  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'No activity recorded yet' })).toBeVisible({ timeout: 30_000 });
  expect(requests).toBeGreaterThanOrEqual(2);
  await page.unroute('**/api/activity');
});
