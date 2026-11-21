import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = [
  '/', '/about', '/blog', '/contact', '/cookies', '/docs', '/features',
  '/how-it-works', '/pricing', '/privacy', '/security', '/terms', '/updates',
] as const;

test.describe('public website route regression', () => {
  for (const route of publicRoutes) {
    test(`${route} is reachable and has a primary heading`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), route).toBe(200);
      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator('h1').first(), route).toBeVisible();
    });
  }

  test('public pages do not overflow at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(() => ({
        documentWidth: (globalThis as unknown as { document: { documentElement: { scrollWidth: number } } }).document.documentElement.scrollWidth,
        viewportWidth: (globalThis as unknown as { innerWidth: number }).innerWidth,
      }));
      expect(overflow.documentWidth, route).toBeLessThanOrEqual(overflow.viewportWidth + 1);
    }
  });

  test('public pages have no axe violations in the main content region', async ({ page }) => {
    test.setTimeout(300_000);
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content'), route).toBeVisible();
      const violations = (await new AxeBuilder({ page }).include('#main-content').analyze()).violations;
      expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), route).toEqual([]);
    }
  });
});
