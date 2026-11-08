import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps informational-route conversion links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/cookies', '/privacy', '/terms', '/updates', '/contact']) {
    await page.goto(route);
    const link = page.getByRole('link', { name: 'Connect GitHub Free', exact: true });
    await expect(link, route).toBeVisible();
    expect((await link.boundingBox())?.height, route).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, route).toEqual([]);
  }
});

test('keeps the shared footer brand and navigation links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/blog');

  const footer = page.getByRole('contentinfo');
  const links = footer.getByRole('link');
  await expect(links).toHaveCount(18);
  for (let index = 0; index < await links.count(); index += 1) {
    const link = links.nth(index);
    expect((await link.boundingBox())?.height, await link.innerText()).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('footer').analyze()).violations).toEqual([]);
});
