import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers';

const publicRoutes = [
  '/', '/about', '/blog', '/features', '/how-it-works', '/security', '/docs', '/pricing',
  '/faq', '/updates', '/contact', '/privacy', '/terms', '/refunds', '/status', '/cookies',
  '/invite/accept', '/verify-email', '/login', '/forgot-password', '/reset-password',
];

const authenticatedRoutes = [
  '/dashboard', '/dashboard/activity', '/dashboard/compatibility', '/dashboard/repositories',
  '/dashboard/findings', '/dashboard/migrations', '/dashboard/pull-requests', '/dashboard/providers',
  '/dashboard/inventory', '/dashboard/rules/pending', '/dashboard/settings',
  '/dashboard/settings/account', '/dashboard/settings/notifications', '/dashboard/settings/workspace',
  '/dashboard/findings/not-a-real-finding',
];

test.describe('route accessibility audit', () => {
  test('passes axe color contrast on the public landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('main#main-content h1').first()).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).include('#main-content').analyze();
    expect(results.violations).toEqual([]);
  });

  test('passes axe on every public route', async ({ page }) => {
    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, route).toEqual([]);
    }
  });

  test('passes axe on every authenticated route', async ({ page }) => {
    await signIn(page);
    for (const route of authenticatedRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, route).toEqual([]);
    }
  });

  test('keeps representative public and authenticated screens accessible at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/', '/pricing', '/docs', '/login', '/forgot-password', '/reset-password']) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} mobile`).toEqual([]);
    }

    await signIn(page);
    for (const route of ['/dashboard', '/dashboard/repositories', '/dashboard/settings/workspace']) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} mobile`).toEqual([]);
    }
  });
});
