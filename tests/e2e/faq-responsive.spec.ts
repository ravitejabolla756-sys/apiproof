import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('contains the public FAQ at narrow widths while preserving disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/faq', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Answers for teams evaluating MY OWL.' })).toBeVisible();
  const firstQuestion = page.locator('details').first();
  await expect(firstQuestion).toBeVisible();
  await firstQuestion.locator('summary').click();
  await expect(firstQuestion).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await page.getByRole('link', { name: 'Contact support' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'faq narrow layout').toEqual([]);
});
