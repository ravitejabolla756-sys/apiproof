import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('keeps findings recovery visible and busy while the retry is pending', async ({ page }) => {
  await signIn(page);
  let firstFailure = true;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });

  await page.route('**/api/findings', async (route) => {
    if (firstFailure) {
      firstFailure = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Findings are temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ findings: [] }) });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Findings are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });

  const retry = alert.getByRole('button', { name: 'Try again' });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');

  releaseRecovery?.();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'No compatibility findings detected' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/findings');
});
