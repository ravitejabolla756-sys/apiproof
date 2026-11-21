import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

const mobileRoutes = [
  '/dashboard',
  '/dashboard/repositories',
  '/dashboard/settings',
  '/dashboard/settings/notifications',
  '/dashboard/settings/workspace',
];

test('integrated dashboard surfaces remain usable without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);

  for (const route of mobileRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('#main-content'), route).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('h1').first(), route).toBeVisible();
    const dimensions = await page.evaluate(() => {
      const browser = globalThis as unknown as { document: { documentElement: { clientWidth: number; scrollWidth: number } } };
      return {
        viewport: browser.document.documentElement.clientWidth,
        content: browser.document.documentElement.scrollWidth,
      };
    });
    expect(dimensions.content, `${route} horizontal overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test('dashboard settings keeps keyboard focus visible on the primary content landmark', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
});
