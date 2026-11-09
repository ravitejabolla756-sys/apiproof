import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public about experience on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Your APIs change/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Built for Developer Trust & Production Safety' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Human Sovereign Review' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Connect GitHub Free', exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'about narrow layout').toEqual([]);
});
