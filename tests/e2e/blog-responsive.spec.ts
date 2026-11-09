import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains engineering notes on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Technical Writing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why package.json presence is not proof of affected usage' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'blog narrow layout').toEqual([]);
});
