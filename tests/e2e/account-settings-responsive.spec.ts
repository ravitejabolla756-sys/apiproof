import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains long account identity metadata on narrow screens', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        account: {
          email: `${'very-long-account-'.repeat(12)}@example.test`,
          name: `Account ${'display-name-'.repeat(12)}`,
          authProviders: ['password'],
          hasLocalPassword: true,
        },
      }),
    });
  });

  await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Email')).toHaveValue(/very-long-account/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long account identity metadata').toEqual([]);
  await page.unroute('**/api/account');
});
