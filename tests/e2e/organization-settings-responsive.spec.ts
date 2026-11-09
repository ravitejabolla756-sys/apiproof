import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps workspace administration usable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrative audit trail' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Workspace settings' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('button', { name: /Save workspace/ }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'workspace administration narrow layout').toEqual([]);
});
