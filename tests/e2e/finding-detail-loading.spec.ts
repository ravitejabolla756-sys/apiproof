import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('announces finding detail loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseFinding: (() => void) | undefined;
  const findingLoading = new Promise<void>((resolve) => { releaseFinding = resolve; });
  await page.route('**/api/findings/finding_loading', async (route) => {
    await findingLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ finding: null, migration: null }) });
  });
  await page.goto('/dashboard/findings/finding_loading', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading AST finding workbench...' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  releaseFinding?.();
  await expect(page.getByRole('alert').filter({ hasText: 'Finding not found or access denied.' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/findings/finding_loading');
});
