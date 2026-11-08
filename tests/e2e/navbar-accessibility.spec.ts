import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps public navbar controls touch-sized and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pricing');

  const toggle = page.locator('button[aria-controls="mobile-site-navigation"]');
  expect((await toggle.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await toggle.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await toggle.click();

  const menu = page.locator('#mobile-site-navigation');
  const links = menu.locator('a');
  await expect(links).toHaveCount(6);
  for (const link of await links.all()) expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#mobile-site-navigation').analyze()).violations).toEqual([]);
});
