import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('public beta surfaces', () => {
  test('loads the core public pages and evidence-backed content', async ({ page }) => {
    for (const route of ['/features', '/how-it-works', '/security', '/docs', '/pricing', '/faq', '/refunds', '/status', '/privacy', '/terms']) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content')).toBeVisible();
    }
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
    await page.goto('/refunds');
    await expect(page.getByText('REFUND POLICY DRAFT')).toBeVisible();
    await page.goto('/status');
    await expect(page.getByText('No live monitor is connected')).toBeVisible();
  });

  test('exposes crawl controls and avoids unsupported operational status copy', async ({ page, request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('/faq');
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Disallow: /dashboard');

    await page.goto('/');
    await expect(page.getByText('Beta · Read-only safety boundary')).toBeVisible();
    await expect(page.getByText('All systems operational')).toHaveCount(0);
  });

  test('supports skip-link focus and mobile menu disclosure', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/pricing');
    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();
    await expect(page.locator('#main-content')).toHaveAttribute('tabindex', '-1');

    const toggle = page.locator('button[aria-controls="mobile-site-navigation"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-site-navigation')).toBeVisible();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('passes automated accessibility scans on representative public pages', async ({ page }) => {
    for (const route of ['/pricing', '/faq', '/status']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, route).toEqual([]);
    }
  });
});

test.describe('authenticated product surfaces', () => {
  test('signs in with the local seed and loads account, workspace, and notification settings', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('developer@apiproof.dev');
    await page.getByLabel('Password').fill('local-test-seed-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await page.waitForURL('**/dashboard');

    await page.goto('/dashboard/settings/account');
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
    await expect(page.getByLabel('Display name')).toHaveValue('APIProof Developer');

    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, '/dashboard/settings/notifications').toEqual([]);
  });
});
