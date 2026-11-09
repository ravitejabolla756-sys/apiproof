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

test('keeps digest controls disabled even when a projection claims delivery is available', async ({ page }) => {
  await page.route('**/api/account/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preferences: [
          { category: 'weekly_digest', channel: 'email', enabled: true, required: false, deliveryAvailable: true },
          { category: 'weekly_digest', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
        ],
      }),
    });
  });

  await signIn(page);
  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Weekly digest via email')).toBeDisabled();
  await expect(page.getByLabel('Weekly digest via slack')).toBeDisabled();
  await expect(page.getByLabel('Weekly digest via email')).toHaveAttribute('aria-describedby', 'digest-contract-status');
  await expect(page.getByLabel('Weekly digest via slack')).toHaveAttribute('aria-describedby', 'digest-contract-status');
  await expect(page.getByText('Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.')).toBeVisible();
  await page.unroute('**/api/account/notifications');
});
