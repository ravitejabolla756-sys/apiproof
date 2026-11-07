import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('does not render zero-valued dashboard metrics after an initial overview failure', async ({ page }) => {
  let overviewRequests = 0;
  let allowSuccess = false;
  await signIn(page);
  await page.route('**/api/overview', async (route) => {
    overviewRequests += 1;
    if (!allowSuccess) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Overview temporarily unavailable.' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const errorState = page.getByRole('alert').filter({ hasText: 'The dashboard could not refresh. Try again in a moment.' });
  await expect(errorState).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'initial dashboard error state').toEqual([]);

  allowSuccess = true;
  await errorState.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible({ timeout: 30_000 });
  expect(overviewRequests).toBeGreaterThanOrEqual(2);
  await page.unroute('**/api/overview');
});
