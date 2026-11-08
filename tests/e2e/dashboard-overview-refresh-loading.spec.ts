import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks dashboard overview refresh controls busy while the response is pending', async ({ page }) => {
  await signIn(page);
  let holdRefresh = false;
  let releaseRefresh: (() => void) | undefined;
  const refreshPending = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  await page.route('**/api/overview', async (route) => {
    if (holdRefresh) await refreshPending;
    await route.continue();
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const refresh = page.getByRole('button', { name: /Refresh/ });
  await expect(refresh).toBeVisible({ timeout: 30_000 });
  holdRefresh = true;
  await refresh.click();
  await expect(refresh).toHaveAttribute('aria-busy', 'true');
  releaseRefresh?.();
  await expect(refresh).not.toHaveAttribute('aria-busy');
  await page.unroute('**/api/overview');
});
