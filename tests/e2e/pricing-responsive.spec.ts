import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains pricing plans on narrow screens without enabling paid checkout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "Start safely. Scale when you're ready." })).toBeVisible();
  for (const plan of ['Free Beta', 'MY OWL Developer', 'MY OWL Startup', 'MY OWL Enterprise']) {
    await expect(page.getByRole('heading', { name: plan })).toBeVisible();
  }
  await expect(page.getByText('Paid plans are visible while they roll out, but cannot be purchased yet.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Get Started' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByRole('link', { name: 'Start an enterprise inquiry' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'pricing narrow layout').toEqual([]);
});
