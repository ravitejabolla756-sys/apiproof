import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

const cases = [
  { path: '/dashboard/inventory', api: '**/api/inventory', message: 'API inventory is temporarily unavailable.', empty: 'No API inventory records are available yet', response: { providers: [] } },
  { path: '/dashboard/compatibility', api: '**/api/compatibility-proof', message: 'Compatibility records are temporarily unavailable.', empty: 'No reviewed compatibility claims are available', response: { claimsAvailable: false, reason: 'no-reviewed-records', changes: [] } },
] as const;

for (const routeCase of cases) {
  test(`${routeCase.path} keeps recovery visible and busy while retrying`, async ({ page }) => {
    await signIn(page);
    let firstFailure = true;
    let releaseRecovery: (() => void) | undefined;
    const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });

    await page.route(routeCase.api, async (route) => {
      if (firstFailure) {
        firstFailure = false;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: routeCase.message }) });
        return;
      }
      await recoveryPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(routeCase.response) });
    });

    await page.goto(routeCase.path, { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert').filter({ hasText: routeCase.message });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    const retry = alert.getByRole('button', { name: 'Try again' });
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    releaseRecovery?.();
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: routeCase.empty })).toBeVisible({ timeout: 30_000 });
    await page.unroute(routeCase.api);
  });
}
