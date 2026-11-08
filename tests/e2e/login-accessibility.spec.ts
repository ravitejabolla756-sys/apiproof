import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps login mode tabs touch-sized and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  for (const label of ['Sign In', 'Create Account']) {
    const tab = page.getByRole('button', { name: label, exact: true }).first();
    await expect(tab).toBeVisible();
    expect((await tab.boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
