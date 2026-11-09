import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public pipeline specification on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/how-it-works', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'From API Change to Verified Draft PR' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Install GitHub App & Authorize Repositories' })).toBeVisible();
  const artifacts = page.getByRole('region', { name: /system artifact$/ });
  await expect(artifacts).toHaveCount(9);
  await artifacts.first().focus();
  await expect(artifacts.first()).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Connect GitHub Free', exact: true }).last().boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'how-it-works narrow layout').toEqual([]);
});
