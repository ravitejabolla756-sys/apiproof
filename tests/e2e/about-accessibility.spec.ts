import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps the primary About CTA touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');

  const connectLink = page.getByRole('link', { name: 'Connect GitHub' }).first();
  await expect(connectLink).toBeVisible();
  expect((await connectLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
