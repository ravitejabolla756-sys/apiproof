import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public security architecture on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/security', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Security Built on Verifiable Boundaries' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Security Invariant Matrix' })).toBeVisible();
  const matrix = page.getByRole('region', { name: 'Security boundary comparison' });
  await matrix.focus();
  await expect(matrix).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'security narrow layout').toEqual([]);
});
