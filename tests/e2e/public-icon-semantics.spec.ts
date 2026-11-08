import { expect, test } from '@playwright/test';

test('keeps decorative homepage and mobile-navigation icons out of the accessibility tree', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const missingMainIconSemantics = await page.locator('main svg').evaluateAll((icons) => icons.filter((icon) => icon.getAttribute('aria-hidden') !== 'true').length);
  expect(missingMainIconSemantics).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-site-navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close menu' }).locator('svg')).toHaveAttribute('aria-hidden', 'true');
});
