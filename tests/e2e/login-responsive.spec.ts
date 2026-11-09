import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps the login shell usable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Sign in to MY OWL' })).toBeAttached();
  const signInTab = page.getByRole('button', { name: 'Sign In', exact: true }).first();
  await expect(signInTab).toBeVisible();
  const createAccountTab = page.getByRole('button', { name: 'Create Account', exact: true });
  await expect(createAccountTab).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  for (const control of [
    signInTab,
    createAccountTab,
    page.getByRole('link', { name: 'Forgot password?' }),
  ]) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'login narrow layout').toEqual([]);
});
