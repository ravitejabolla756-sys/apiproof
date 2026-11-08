import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps docs calls to action touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs');

  for (const label of ['View 9-Stage Pipeline Specification', 'Engineering Blog', 'Contact Us']) {
    const link = page.getByRole('link', { name: label });
    await expect(link).toBeVisible();
    expect((await link.boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
