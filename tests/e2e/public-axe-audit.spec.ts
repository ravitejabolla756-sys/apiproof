import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicRoutes = ['/', '/about', '/blog', '/features', '/how-it-works', '/security', '/docs', '/pricing', '/faq', '/updates', '/contact', '/privacy', '/terms', '/refunds', '/status', '/cookies', '/invite/accept', '/verify-email', '/login', '/forgot-password', '/reset-password'];

test('keeps the audited public routes free of axe violations', async ({ page }) => {
  test.setTimeout(300_000);
  for (const route of publicRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const violations = (await new AxeBuilder({ page }).include('#main-content').analyze()).violations;
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), route).toEqual([]);
  }
});

test('keeps the public not-found response free of axe violations', async ({ page }) => {
  const response = await page.goto('/route-that-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  expect(response?.status()).toBe(404);
  await expect(page.locator('main#main-content h1')).toHaveText('Page not found');
  const violations = (await new AxeBuilder({ page }).include('#main-content').analyze()).violations;
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
});
