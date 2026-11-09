import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('contains notification settings on narrow screens', async ({ page }) => {
  await page.route('**/api/account/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ preferences: [
        { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
        { category: 'account', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
        { category: 'weekly_digest', channel: 'email', enabled: true, required: false, deliveryAvailable: true },
        { category: 'weekly_digest', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
      ] }),
    });
  });

  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.')).toBeVisible();
  const preferenceRegion = page.getByRole('region', { name: 'Notification preferences table' });
  await preferenceRegion.focus();
  await expect(preferenceRegion).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const checkbox of [page.getByLabel('Weekly digest via email'), page.getByLabel('Weekly digest via slack')]) {
    expect(await checkbox.evaluate((input) => input.closest('label')?.getBoundingClientRect().height ?? 0)).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'notification settings narrow layout').toEqual([]);
  await page.unroute('**/api/account/notifications');
});
