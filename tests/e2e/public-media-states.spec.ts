import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps an unconfigured product video truthful and non-activatable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeVisible();
  const unavailable = page.getByRole('button', { name: 'Product video unavailable in this beta' });
  await expect(unavailable).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Video preview unavailable in this beta.' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
