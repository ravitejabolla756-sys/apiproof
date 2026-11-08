import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps public footer navigation links touch-sized and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const footer = page.getByRole('contentinfo');
  const navigation = footer.getByRole('navigation', { name: 'Footer navigation' });
  const links = navigation.getByRole('link');
  await expect(links).toHaveCount(16);
  for (const link of await links.all()) {
    expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('footer').analyze()).violations).toEqual([]);
});
