import { expect, test } from '@playwright/test';
import { assertPublicRoutes } from './helpers.js';

const publicRoutes = [
  '/', '/about', '/blog', '/features', '/how-it-works', '/security', '/docs', '/pricing',
  '/faq', '/updates', '/contact', '/privacy', '/terms', '/refunds', '/status', '/cookies',
  '/invite/accept', '/verify-email', '/login', '/forgot-password', '/reset-password',
];

test('checks same-origin links across every audited public route', async ({ page, request }) => {
  await assertPublicRoutes(page, publicRoutes);
  const internalLinks = new Set<string>();

  for (const route of publicRoutes) {
    await page.goto(route);
    const routeLinks = await page.locator('a[href^="/"]').evaluateAll((anchors) => [...new Set(
      anchors
        .map((anchor) => anchor.getAttribute('href'))
        .filter((href): href is string => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//'))
        .map((href) => href.split('#', 1)[0] ?? '')
        .filter((href) => href.length > 0),
    )]);
    for (const href of routeLinks) internalLinks.add(href);
  }

  for (const href of internalLinks) {
    const response = await request.get(href);
    expect(response.status(), href).toBeLessThan(400);
  }
});
