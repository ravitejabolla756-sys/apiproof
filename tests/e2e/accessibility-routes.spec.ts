import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

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

  test('exposes explicit column scopes on public and authenticated data tables', async ({ page }) => {
    await page.goto('/security', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const securityHeaders = page.locator('table thead th');
    await expect(securityHeaders).not.toHaveCount(0);
    for (let index = 0; index < await securityHeaders.count(); index += 1) {
      await expect(securityHeaders.nth(index)).toHaveAttribute('scope', 'col');
    }

    await signIn(page);
    await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const repositoryHeaders = page.locator('table thead th');
    await expect(repositoryHeaders).not.toHaveCount(0);
    for (let index = 0; index < await repositoryHeaders.count(); index += 1) {
      await expect(repositoryHeaders.nth(index)).toHaveAttribute('scope', 'col');
    }
  });

  test('keeps the not-found page accessible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/route-that-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status()).toBe(404);
    await expect(page.locator('main#main-content h1')).toHaveText('Page not found');
    const skipLink = page.locator('.skip-link').first();
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    for (const label of ['Return Home', 'Explore Features']) {
      expect((await page.getByRole('link', { name: label }).boundingBox())?.height, label).toBeGreaterThanOrEqual(44);
    }
    const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('keeps dynamic detail error states accessible at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await page.route('**/api/repositories/a11y-detail-error', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Repository details are temporarily unavailable.' }),
      });
    });
    await page.goto('/dashboard/repositories/a11y-detail-error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const repositoryAlert = page.getByRole('alert').filter({ hasText: 'Repository details are temporarily unavailable.' });
    await expect(repositoryAlert).toBeVisible({ timeout: 30_000 });
    await expect(repositoryAlert).toHaveAttribute('aria-live', 'assertive');
    const repositoryRetry = repositoryAlert.getByRole('button', { name: 'Try again' });
    expect((await repositoryRetry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'repository detail error').toEqual([]);
    await page.unroute('**/api/repositories/a11y-detail-error');

    await page.route('**/api/repositories/a11y-detail-populated', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repository: {
            id: 'a11y-detail-populated', owner: 'acme', name: 'owl', full_name: 'acme/owl',
            github_repository_id: 'gh-a11y', default_branch: 'main', status: 'healthy',
            last_scan_at: null, created_at: '2026-11-08T00:00:00.000Z',
          },
          scans: [],
          findings: [],
        }),
      });
    });
    await page.goto('/dashboard/repositories/a11y-detail-populated', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'owl', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'repository detail populated').toEqual([]);
    await page.unroute('**/api/repositories/a11y-detail-populated');

    await page.route('**/api/findings/a11y-detail-error', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Finding details are temporarily unavailable.' }),
      });
    });
    await page.goto('/dashboard/findings/a11y-detail-error', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const findingAlert = page.getByRole('alert').filter({ hasText: 'Finding details are temporarily unavailable.' });
    await expect(findingAlert).toBeVisible({ timeout: 30_000 });
    await expect(findingAlert).toHaveAttribute('aria-live', 'assertive');
    const findingRetry = findingAlert.getByRole('button', { name: 'Retry finding load' });
    expect((await findingRetry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'finding detail error').toEqual([]);
    await page.unroute('**/api/findings/a11y-detail-error');

    await page.route('**/api/findings/a11y-detail-populated', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          finding: {
            id: 'a11y-detail-populated', provider: 'Fixture', change_id: 'change-a11y',
            title: 'Accessible finding fixture', description: 'A populated accessibility fixture.',
            severity: 'P1', confidence: 'high', file_path: 'src/example.ts', line_number: 12,
            symbol: 'example', reason: 'Fixture reason', source_snippet: 'example()', status: 'open',
            created_at: '2026-11-08T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'acme/owl',
            repo_owner: 'acme', default_branch: 'main', evidence: [], reasonCodes: [], capability: null,
          },
          migration: null,
        }),
      });
    });
    await page.goto('/dashboard/findings/a11y-detail-populated', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Accessible finding fixture', exact: true })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'finding detail populated').toEqual([]);
    await page.unroute('**/api/findings/a11y-detail-populated');
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

  test('moves keyboard focus to main content from every authenticated route', async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page);
    for (const route of authenticatedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const skipLink = page.locator('.skip-link');
      await expect(skipLink, route).toBeVisible({ timeout: 30_000 });
      await skipLink.focus();
      await expect(skipLink, route).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content'), route).toBeFocused();
    }
  });

  test('moves keyboard focus to main content from every public route', async ({ page }) => {
    test.setTimeout(300_000);
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const skipLink = page.locator('.skip-link');
      await expect(skipLink, route).toBeVisible({ timeout: 30_000 });
      await skipLink.focus();
      await expect(skipLink, route).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content'), route).toBeFocused();
    }
  });

  test('keeps all audited public and authenticated routes accessible at mobile width', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} mobile`).toEqual([]);
    }

    await signIn(page);
    for (const route of authenticatedRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} mobile`).toEqual([]);
    }
  });

  test('keeps all audited public and authenticated routes accessible at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} tablet`).toEqual([]);
    }

    await signIn(page);
    for (const route of authenticatedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page }).include('#main-content').disableRules(['color-contrast']).analyze();
      expect(results.violations, `${route} tablet`).toEqual([]);
    }
  });

  test('keeps authenticated routes within the mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    for (const route of authenticatedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
      if (route === '/dashboard/settings/notifications') await expect(page.getByRole('region', { name: 'Notification preferences table' }).locator('table')).toBeVisible({ timeout: 30_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(overflow, `${route} creates document-level horizontal overflow`).toBe(true);
    }
  });

  test('keeps public routes within the mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(overflow, `${route} creates document-level horizontal overflow`).toBe(true);
    }
  });
});
