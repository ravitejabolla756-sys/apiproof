import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps homepage navigation and conversion links touch-sized on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('main#main-content')).toBeVisible();

  for (const label of [
    'GITHUB APP CONTINUOUS BREAKING CHANGE INTELLIGENCE',
    'Connect GitHub Free',
    'See how it works',
    'Compare full plan matrix',
    'Get Started Free',
    'Start Pro Plan',
    'Start Team Plan',
    'Contact Us',
  ]) {
    const links = page.getByRole('link', { name: label, exact: true });
    await expect(links.first(), label).toBeVisible();
    for (let index = 0; index < await links.count(); index += 1) {
      expect((await links.nth(index).boundingBox())?.height, `${label} #${index + 1}`).toBeGreaterThanOrEqual(44);
    }
  }

  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
