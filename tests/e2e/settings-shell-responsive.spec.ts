import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps workspace settings and billing shell usable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Workspace Settings & Billing' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Subscription & Usage Quotas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GitHub App Integration' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const link of [
    page.getByRole('link', { name: 'Account settings' }),
    page.getByRole('link', { name: 'Workspace administration' }),
  ]) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'settings shell narrow layout').toEqual([]);
});
