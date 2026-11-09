import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public updates timeline on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/updates', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Product Updates & Engine Changelog' })).toBeVisible();
  const updates = page.getByRole('list', { name: 'Product updates' });
  await expect(updates.locator(':scope > li')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Connect GitHub Free', exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'updates narrow layout').toEqual([]);
});
