import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps missing invitation recovery readable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/invite/accept', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Workspace invitation' })).toBeVisible();
  const alert = page.getByRole('alert').filter({ hasText: 'This invitation link is missing its token.' });
  await expect(alert).toContainText('missing its token');
  await expect(page.getByRole('link', { name: 'Sign in with the invited account' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Sign in with the invited account' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'missing invitation recovery').toEqual([]);
});
