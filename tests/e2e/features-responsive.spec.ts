import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains feature descriptions on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/features', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Developer Infrastructure for Breaking API Changes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AST-Based Codebase Analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspace Isolation & Auditability' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const primaryLink = page.getByRole('link', { name: 'Connect GitHub Free', exact: true }).last();
  expect((await primaryLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'features narrow layout').toEqual([]);
});
