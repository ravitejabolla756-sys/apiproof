import { expect, test } from '@playwright/test';

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
});
