import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps the public status page truthful while no monitor is configured', async ({ page }) => {
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'A truthful status surface is coming.' })).toBeVisible();
  await expect(page.getByText('No live monitor is connected to this public page yet')).toBeVisible();
  await expect(page.getByText('All systems operational', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', '/contact');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});

test('keeps the status support action touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/status');

  const supportLink = page.getByRole('link', { name: 'Contact support' });
  await expect(supportLink).toBeVisible();
  expect((await supportLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});
