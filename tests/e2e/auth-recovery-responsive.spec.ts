import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const recoveryRoutes = [
  { route: '/forgot-password', heading: 'Reset your password', link: 'Back to sign in' },
  { route: '/reset-password', heading: 'Choose a new password', link: 'Back to sign in' },
  { route: '/verify-email', heading: 'Verification unavailable', link: 'Continue to sign in' },
] as const;

test('keeps auth recovery states usable at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });

  for (const { route, heading, link } of recoveryRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: link, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
    expect((await page.getByRole('link', { name: link, exact: true }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, route).toEqual([]);
  }

  await expect(page.getByRole('alert').filter({ hasText: 'This verification link is missing its token.' })).toBeVisible();
});
