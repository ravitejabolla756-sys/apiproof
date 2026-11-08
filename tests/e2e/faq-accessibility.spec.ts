import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps FAQ disclosure controls touch-sized and keyboard-usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/faq');

  const firstQuestion = page.locator('summary').first();
  await expect(firstQuestion).toBeVisible();
  expect((await firstQuestion.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await firstQuestion.focus();
  await expect(firstQuestion).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(firstQuestion.locator('xpath=..')).toHaveAttribute('open', '');
  await expect(firstQuestion.locator('xpath=..').locator('p')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
