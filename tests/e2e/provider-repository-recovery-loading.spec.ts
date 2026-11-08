import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

const cases = [
  { path: '/dashboard/providers', api: '**/api/provider-coverage', message: 'Provider coverage is temporarily unavailable.', empty: 'No provider coverage records are available yet', response: { summary: { configuredSources: 0, discoveryProviders: 0, providersWithReviewedRules: 0, reviewedRules: 0, providersWithMigrationTemplates: 0, migrationTemplates: 0, providersWithVerifiedMigrationTemplates: 0, verifiedMigrationTemplates: 0 }, providers: [] } },
  { path: '/dashboard/repositories', api: '**/api/repositories', message: 'Repositories are temporarily unavailable.', empty: 'No repositories connected yet', response: { repositories: [] } },
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
