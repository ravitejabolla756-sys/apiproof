import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps primary public conversion links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const { route, label } of [
    { route: '/about', label: 'Connect GitHub' },
    { route: '/features', label: 'Connect GitHub Free' },
    { route: '/how-it-works', label: 'Connect GitHub Free' },
  ]) {
    await page.goto(route);
    const link = page.getByRole('link', { name: label, exact: true });
    await expect(link).toBeVisible();
    expect((await link.boundingBox())?.height, `${route} ${label}`).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, route).toEqual([]);
  }
});
