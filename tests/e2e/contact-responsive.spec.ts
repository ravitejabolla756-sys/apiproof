import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public contact experience on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Connect with the MY OWL Team' })).toBeVisible();
  await expect(page.getByLabel('Full Name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const control of [page.getByLabel('Full Name'), page.getByLabel('Work Email'), page.getByLabel('Inquiry Type'), page.getByLabel('How can we help?'), page.getByRole('button', { name: 'Review inquiry state' })]) {
    expect(await control.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'contact narrow layout').toEqual([]);
});
