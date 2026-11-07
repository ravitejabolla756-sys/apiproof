import { expect, test, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const localSeedPassword = process.env.APIPROOF_LOCAL_SEED_PASSWORD ?? 'local-test-seed-password';
let browserClientCounter = 0;

function nextBrowserClientIp(): string {
  browserClientCounter = (browserClientCounter % 254) + 1;
  return `198.51.100.${browserClientCounter}`;
}

async function signIn(page: Page) {
  // Each test page models a separate browser client so the production rate
  // limiter is exercised without one CI runner IP exhausting the shared seed.
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextBrowserClientIp() });
  await signInWithCredentials(page, 'developer@apiproof.dev', localSeedPassword);
}

async function signInWithCredentials(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await page.waitForURL('**/dashboard');
}

async function createLocalAccount(page: Page, email: string, password: string) {
  await page.goto('/login');
  const signupResult = await page.evaluate(async ({ signupEmail, signupPassword }) => {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', email: signupEmail, password: signupPassword, name: 'Browser Account' }),
    });
    return { status: response.status, body: await response.json() as { error?: string } };
  }, { signupEmail: email, signupPassword: password });
  expect(signupResult.status, signupResult.body.error).toBe(200);
  // The signup endpoint creates the authenticated session as part of account creation.
  // Navigate explicitly instead of submitting the login form again; the login page
  // redirects authenticated sessions before its form controls are available.
  await page.goto('/dashboard');
}

async function withAcceptedInvitation(ownerPage: Page, browser: Browser, inviteEmail: string, action: (invitedPage: Page) => Promise<void>) {
  await ownerPage.goto('/dashboard/settings/workspace');
  await ownerPage.getByLabel('Invite email').fill(inviteEmail);
  await ownerPage.getByRole('button', { name: 'Create invite link' }).click();
  await expect(ownerPage.getByText('Invitation created. Copy the link and send it through an approved channel.')).toBeVisible({ timeout: 30_000 });

  const inviteUrl = await ownerPage.locator('code').filter({ hasText: '/invite/accept?token=' }).innerText();
  const invitedPage = await browser.newPage();
  try {
    const password = 'InviteePassword123!';
    await invitedPage.goto('/login');
    const signupResult = await invitedPage.evaluate(async ({ email, password: signupPassword }) => {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signup', email, password: signupPassword, name: 'Browser Invitee' }),
      });
      return { status: response.status, body: await response.json() as { error?: string } };
    }, { email: inviteEmail, password });
    expect(signupResult.status, signupResult.body.error).toBe(200);

    const parsedInviteUrl = new URL(inviteUrl, ownerPage.url());
    await invitedPage.goto(`${parsedInviteUrl.pathname}${parsedInviteUrl.search}`);
    await invitedPage.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitedPage.getByRole('status')).toContainText('You joined', { timeout: 30_000 });
    await action(invitedPage);
  } finally {
    await invitedPage.close();
  }
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
    await page.goto('/verify-email');
    await expect(page.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
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
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
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

  test('saves an optional notification preference through the UI contract', async ({ page }) => {
    await signIn(page);
    let postedUpdates: unknown;
    await page.route('**/api/account/notifications', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preferences: [
              { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
              { category: 'findings', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
            ],
          }),
        });
        return;
      }
      postedUpdates = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preferences: [{ category: 'findings', channel: 'slack', enabled: false, required: false, deliveryAvailable: true }] }),
      });
    });

    await page.goto('/dashboard/settings/notifications');
    const findingsSlack = page.getByLabel('Breaking findings via slack');
    await expect(findingsSlack).toBeChecked();
    await findingsSlack.uncheck();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Notification preferences saved.', { timeout: 30_000 });
    expect(postedUpdates).toEqual({ updates: [
      { category: 'security', channel: 'email', enabled: true },
      { category: 'findings', channel: 'slack', enabled: false },
    ] });
    await expect(findingsSlack).not.toBeChecked();
    await page.unroute('**/api/account/notifications');
  });

  test('changes a real local account password and invalidates another session', async ({ page, browser }) => {
    const email = `browser-password-${Date.now()}@example.test`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';
    await createLocalAccount(page, email, oldPassword);

    await page.goto('/dashboard/settings/account');
    await page.getByLabel('Current password', { exact: true }).fill(oldPassword);
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('status')).toContainText('Password updated.', { timeout: 30_000 });

    const otherPage = await browser.newPage();
    try {
      await otherPage.goto('/login');
      await otherPage.getByLabel('Email').fill(email);
      await otherPage.getByLabel('Password').fill(oldPassword);
      await otherPage.getByRole('button', { name: 'Sign In', exact: true }).last().click();
      await expect(otherPage.getByText('Invalid email or password.', { exact: true })).toBeVisible({ timeout: 30_000 });

      await otherPage.getByLabel('Password').fill(newPassword);
      await otherPage.getByRole('button', { name: 'Sign In', exact: true }).last().click();
      await otherPage.waitForURL('**/dashboard');
    } finally {
      await otherPage.close();
    }
  });

  test('exposes an accessible server-backed workspace context selector', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    const selector = page.getByLabel('Active workspace');
    await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector).toHaveValue(/.+/);
    await expect(selector.locator('option')).toHaveCount(1);
    await expect(selector).toBeDisabled();
    const results = await new AxeBuilder({ page }).include('aside').analyze();
    expect(results.violations, 'workspace context selector').toEqual([]);
  });

  test('switches between authorized workspace contexts through the picker', async ({ page }) => {
    await signIn(page);
    let activeWorkspaceId = 'ws_primary';
    let postedWorkspaceId: string | undefined;
    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activeWorkspaceId,
          workspaces: [
            { id: 'ws_primary', name: 'Primary Workspace', role: 'owner' },
            { id: 'ws_secondary', name: 'Secondary Workspace', role: 'member' },
          ],
        }),
      });
    });
    await page.route('**/api/workspace/context', async (route) => {
      postedWorkspaceId = (JSON.parse(route.request().postData() || '{}') as { workspaceId?: string }).workspaceId;
      activeWorkspaceId = postedWorkspaceId || activeWorkspaceId;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ workspace: { id: activeWorkspaceId, name: 'Secondary Workspace', role: 'member' } }),
      });
    });

    await page.goto('/dashboard');
    const selector = page.getByLabel('Active workspace');
    await expect(selector).toHaveValue('ws_primary', { timeout: 30_000 });
    await expect(selector.locator('option')).toHaveCount(2);
    await selector.selectOption('ws_secondary');
    await expect.poll(() => postedWorkspaceId).toBe('ws_secondary');
    await expect(selector).toHaveValue('ws_secondary', { timeout: 30_000 });
    await expect(selector.locator('option:checked')).toHaveText('Secondary Workspace');
    await page.unroute('**/api/workspaces');
    await page.unroute('**/api/workspace/context');
  });

  test('creates and cancels a manual workspace invitation without sending email', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    const inviteEmail = `browser-invite-${Date.now()}@example.test`;
    await page.getByLabel('Invite email').fill(inviteEmail);
    await page.getByRole('button', { name: 'Create invite link' }).click();
    await expect(page.getByText('Invitation created. Copy the link and send it through an approved channel.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(inviteEmail)).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: `Cancel invitation for ${inviteEmail}` }).click();
    await expect(page.getByText('Invitation cancelled.')).toBeVisible({ timeout: 30_000 });
    const invitationRow = page.getByText(inviteEmail).locator('..');
    await expect(invitationRow).toContainText('Revoked');
  });

  test('accepts a real generated invitation with the invited account', async ({ page, browser }) => {
    await signIn(page);
    const inviteEmail = `browser-accept-${Date.now()}@example.test`;
    await withAcceptedInvitation(page, browser, inviteEmail, async () => {});
  });

  test('updates and removes a real accepted workspace member', async ({ page, browser }) => {
    await signIn(page);
    const memberEmail = `browser-member-${Date.now()}@example.test`;
    await withAcceptedInvitation(page, browser, memberEmail, async (invitedPage) => {
      await page.goto('/dashboard/settings/workspace');
      const roleSelector = page.getByLabel(`Role for ${memberEmail}`);
      await expect(roleSelector).toHaveValue('member', { timeout: 30_000 });
      await roleSelector.selectOption('owner');
      await expect(page.getByRole('status')).toContainText('Member role updated.', { timeout: 30_000 });
      await expect(roleSelector).toHaveValue('owner');
      await roleSelector.selectOption('member');
      await expect(page.getByRole('status')).toContainText('Member role updated.', { timeout: 30_000 });
      await expect(roleSelector).toHaveValue('member');

      page.once('dialog', (dialog) => void dialog.accept());
      await roleSelector.locator('..').getByRole('button', { name: 'Remove' }).click();
      await expect(page.getByRole('status')).toContainText('Member removed.', { timeout: 30_000 });
      await expect(page.getByLabel(`Role for ${memberEmail}`)).toHaveCount(0);

      await invitedPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(invitedPage).toHaveURL(/\/login/);
    });
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

  test('covers protected finding detail and provider-rule review routes', async ({ page }) => {
    await signIn(page);
    const findingResponse = await page.goto('/dashboard/findings/not-a-real-finding', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(findingResponse?.status()).toBe(200);
    await expect(page.getByText('Finding not found or access denied.')).toBeVisible({ timeout: 30_000 });
    const findingResults = await new AxeBuilder({ page }).analyze();
    expect(findingResults.violations, '/dashboard/findings/[id] access-denied').toEqual([]);

    const reviewResponse = await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(reviewResponse?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Rule review' })).toBeVisible({ timeout: 30_000 });
    const reviewResults = await new AxeBuilder({ page }).analyze();
    expect(reviewResults.violations, '/dashboard/rules/pending').toEqual([]);
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
