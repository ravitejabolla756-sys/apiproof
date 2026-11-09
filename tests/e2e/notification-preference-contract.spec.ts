import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('fails closed when notification preferences have an invalid server projection', async ({ page }) => {
  await page.route('**/api/account/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preferences: [{ category: 'unknown', channel: 'email', enabled: false, required: false, deliveryAvailable: false }],
      }),
    });
  });

  await signIn(page);
  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load notification preferences.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notification preferences table' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'malformed notification projection').toEqual([]);
  await page.unroute('**/api/account/notifications');
});
