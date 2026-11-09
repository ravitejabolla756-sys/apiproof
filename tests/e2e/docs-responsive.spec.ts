import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public documentation catalog on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/docs', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'MY OWL Documentation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Supported APIs & Rule Catalogs' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const label of ['View 9-Stage Pipeline Specification', 'Engineering Blog', 'Contact Us']) {
    expect((await page.getByRole('link', { name: label }).last().boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'docs narrow layout').toEqual([]);
});
