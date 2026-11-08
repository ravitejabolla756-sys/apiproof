import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('focuses logout failure feedback while preserving the active session', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/auth', async (route) => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'logout') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Logout unavailable.' }) });
      return;
    }
    await route.continue();
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign out of MY OWL' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Sign out failed. Your session may still be active.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  await expect(page).toHaveURL(/\/dashboard/);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'logout error').toEqual([]);
  await page.unroute('**/api/auth');
});
