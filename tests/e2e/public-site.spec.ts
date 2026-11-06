import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('developer@apiproof.dev');
  await page.getByLabel('Password').fill('local-test-seed-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await page.waitForURL('**/dashboard');
}

async function scanAuthenticatedRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
}

async function assertDashboardRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
    if (route.includes('/repositories/')) {
      await expect(page.getByText('Repository not found or access denied.')).toBeVisible({ timeout: 30_000 });
      continue;
    }
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(overflow, 'mobile dashboard should not create document-level horizontal overflow').toBe(true);
}

async function assertPublicRoutes(page: Page, routes: string[]) {
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main#main-content'), route).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main#main-content h1').first(), route).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveTitle(/MY OWL/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /MY OWL/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
}

test.describe('public beta surfaces', () => {
  test('loads the core public pages and evidence-backed content', async ({ page }) => {
    for (const route of ['/features', '/how-it-works', '/security', '/docs', '/pricing', '/faq', '/refunds', '/status', '/privacy', '/terms', '/invite/accept']) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
    }
    await page.goto('/faq');
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
    await page.goto('/refunds');
    await expect(page.getByText('REFUND POLICY DRAFT')).toBeVisible();
    await page.goto('/status');
    await expect(page.getByText('No live monitor is connected')).toBeVisible();
    await page.goto('/invite/accept');
    await expect(page.getByRole('heading', { name: 'Workspace invitation' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'missing its token' })).toBeVisible({ timeout: 30_000 });
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

  test('checks public metadata and root internal links', async ({ page, request }) => {
    await assertPublicRoutes(page, [
      '/',
      '/about',
      '/blog',
      '/features',
      '/how-it-works',
      '/security',
      '/docs',
      '/pricing',
      '/faq',
      '/updates',
      '/contact',
      '/privacy',
      '/terms',
      '/refunds',
      '/status',
      '/cookies',
      '/invite/accept',
    ]);

    await page.goto('/');
    const internalLinks = await page.locator('a[href^="/"]').evaluateAll((anchors) => [...new Set(
      anchors
        .map((anchor) => anchor.getAttribute('href'))
        .filter((href): href is string => Boolean(href))
        .map((href) => href.split('#', 1)[0])
        .filter((href) => href.length > 0),
    )]);

    for (const href of internalLinks) {
      const response = await request.get(href);
      expect(response.status(), href).toBeLessThan(400);
    }
  });

  test('exercises the contact form without sending a message', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('Full Name').fill('Local QA User');
    await page.getByLabel('Work Email').fill('qa@example.test');
    await page.getByLabel('Inquiry Type').selectOption('support');
    await page.getByLabel('How can we help?').fill('This is a non-destructive local browser check.');
    await page.getByRole('button', { name: 'Review inquiry state' }).click();
    await expect(page.getByRole('heading', { name: 'No message was sent' })).toBeVisible();
    await expect(page.getByText('Contact intake is not connected to a delivery service in this beta.')).toBeVisible();
  });
});

test.describe('authenticated product surfaces', () => {
  test('signs in with the local seed and loads account, workspace, and notification settings', async ({ page }) => {
    await signIn(page);

    await page.goto('/dashboard/settings/account');
    await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Display name')).toHaveValue('APIProof Developer', { timeout: 30_000 });

    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, '/dashboard/settings/notifications').toEqual([]);
  });

  test('covers the seeded dashboard primary browsing routes', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertDashboardRoutes(page, [
      '/dashboard',
      '/dashboard/activity',
      '/dashboard/compatibility',
      '/dashboard/repositories',
      '/dashboard/repositories/repo_apiproof_fixture',
      '/dashboard/findings',
      '/dashboard/migrations',
    ]);
  });

  test('covers the seeded dashboard secondary workflow routes', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertDashboardRoutes(page, [
      '/dashboard/pull-requests',
      '/dashboard/providers',
      '/dashboard/inventory',
      '/dashboard/settings',
    ]);
  });

  test('scans core authenticated data routes', async ({ page }) => {
    await signIn(page);
    await scanAuthenticatedRoutes(page, [
      '/dashboard',
      '/dashboard/activity',
      '/dashboard/compatibility',
      '/dashboard/repositories',
      '/dashboard/findings',
      '/dashboard/migrations',
    ]);
  });

  test('scans core authenticated workflow and settings routes', async ({ page }) => {
    await signIn(page);
    await scanAuthenticatedRoutes(page, [
      '/dashboard/pull-requests',
      '/dashboard/providers',
      '/dashboard/inventory',
      '/dashboard/settings/account',
      '/dashboard/settings/workspace',
      '/dashboard/settings/notifications',
    ]);
  });

  test('verifies keyboard skip-link and dialog behavior', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    const searchTrigger = page.getByRole('button', { name: /Search repos, findings, SDKs/ });
    await searchTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Search MY OWL' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search repositories and workspace navigation' })).toBeFocused();
    const commandPaletteResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(commandPaletteResults.violations, 'command palette').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search MY OWL' })).toHaveCount(0);

    await page.route('**/api/github/repositories', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Connect GitHub Repository' })).toBeVisible();
    const repositoryDialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(repositoryDialogResults.violations, 'repository connection dialog').toEqual([]);
    await expect(page.getByRole('button', { name: 'Close repository connection dialog' })).toBeFocused();
    await page.getByRole('button', { name: 'Close repository connection dialog' }).click();
    await page.unroute('**/api/github/repositories');
  });

  test('shows safe invalid-login and permission-denied states without leaking data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('unknown@example.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('developer@apiproof.dev')).toHaveCount(0);

    await signIn(page);
    await page.route('**/api/workspace/settings', async (route) => {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace access denied.' }) });
    });
    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('alert').filter({ hasText: 'Workspace access denied.' })).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/workspace/settings');
  });

  test('renders a deterministic empty repository state and account error state', async ({ page }) => {
    await signIn(page);
    let releaseRepositories: (() => void) | undefined;
    const repositoriesLoading = new Promise<void>((resolve) => { releaseRepositories = resolve; });
    await page.route('**/api/repositories', async (route) => {
      await repositoriesLoading;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
    });
    await page.goto('/dashboard/repositories');
    await expect(page.getByText('Loading repositories from database...')).toBeVisible({ timeout: 30_000 });
    releaseRepositories?.();
    await expect(page.getByText('No repositories found matching your filter.')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/repositories');

    await page.route('**/api/account', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to load account settings.' }) });
    });
    await page.goto('/dashboard/settings/account');
    await expect(page.getByRole('alert').filter({ hasText: 'Unable to load account settings.' })).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/account');
  });
});
