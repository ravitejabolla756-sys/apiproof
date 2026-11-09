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
          { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
          { category: 'account', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
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
  await expect(page.getByLabel('Weekly digest via email')).not.toBeChecked();
  await expect(page.getByLabel('Weekly digest via slack')).not.toBeChecked();
  await expect(page.getByLabel('Weekly digest via email')).toHaveAttribute('aria-describedby', 'digest-contract-status');
  await expect(page.getByLabel('Weekly digest via slack')).toHaveAttribute('aria-describedby', 'digest-contract-status');
  await expect(page.getByText('Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.')).toBeVisible();
  await page.unroute('**/api/account/notifications');
});

test('does not submit digest updates while the scheduler contract is unavailable', async ({ page }) => {
  let postedUpdates: unknown;
  await page.route('**/api/account/notifications', async (route) => {
    if (route.request().method() === 'PATCH') {
      postedUpdates = JSON.parse(route.request().postData() || '{}').updates;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preferences: [
          { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
          { category: 'account', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
          { category: 'weekly_digest', channel: 'email', enabled: true, required: false, deliveryAvailable: true },
        ],
      }),
    });
  });

  await signIn(page);
  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Weekly digest via email')).not.toBeChecked();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Notification preferences saved.' })).toBeVisible();
  expect(postedUpdates).toEqual([
    { category: 'security', channel: 'email', enabled: true },
    { category: 'account', channel: 'email', enabled: true },
  ]);
  await page.unroute('**/api/account/notifications');
});
