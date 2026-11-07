import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  assertDashboardRoutes,
  assertPublicRoutes,
  createLocalAccount,
  scanAuthenticatedRoutes,
  signIn,
  withAcceptedInvitation,
} from './helpers.js';
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
    const verificationAlert = page.getByRole('alert').filter({ hasText: 'missing its token' }); await expect(verificationAlert).toBeVisible({ timeout: 30_000 }); await expect(verificationAlert).toHaveAttribute('aria-live', 'assertive'); await expect(verificationAlert).toHaveAttribute('aria-atomic', 'true');
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/invite/accept missing-token state').toEqual([]);
    await page.goto('/verify-email');
    await expect(page.getByRole('heading', { name: 'Verification unavailable' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'missing its token' })).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, '/verify-email missing-token state').toEqual([]);
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
    await expect(page.locator('nav[aria-label="Primary site navigation"] a[href="/pricing"]')).toHaveAttribute('aria-current', 'page');

    const toggle = page.locator('button[aria-controls="mobile-site-navigation"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-site-navigation')).toBeVisible();
    const mobileMenuLinks = page.locator('#mobile-site-navigation a');
    await expect(mobileMenuLinks.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(mobileMenuLinks.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(mobileMenuLinks.first()).toBeFocused();
    await expect(page.locator('#mobile-site-navigation a[href="/pricing"]')).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false'); await expect(toggle).toBeFocused(); await toggle.click(); await expect(mobileMenuLinks.first()).toBeFocused();
    await page.getByTestId('mobile-menu-backdrop').click({ position: { x: 10, y: 10 } }); await expect(toggle).toHaveAttribute('aria-expanded', 'false'); await expect(toggle).toBeFocused();
  });

  test('passes automated accessibility scans on representative public pages', async ({ page }) => {
    for (const route of ['/pricing', '/faq', '/status']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, route).toEqual([]);
    }
  });
  test('honors the reduced-motion accessibility contract', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const motion = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'animate-pulse transition-all';
      document.body.appendChild(probe);
      const style = window.getComputedStyle(probe);
      const toMilliseconds = (value: string) => value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
      const result = {
        animationDurationMs: toMilliseconds(style.animationDuration),
        transitionDurationMs: toMilliseconds(style.transitionDuration),
        scrollBehavior: style.scrollBehavior,
      };
      probe.remove();
      return result;
    });
    expect(motion.animationDurationMs).toBeLessThanOrEqual(0.01);
    expect(motion.transitionDurationMs).toBeLessThanOrEqual(0.01);
    expect(motion.scrollBehavior).toBe('auto');
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
        .map((href) => href.split('#', 1)[0] ?? '')
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
    const contactStatus = page.getByRole('status'); await expect(contactStatus).toBeVisible(); await expect(contactStatus).toContainText('No message was sent'); await expect(contactStatus).toHaveAttribute('aria-atomic', 'true');
    await expect(page.getByText('Contact intake is not connected to a delivery service in this beta.')).toBeVisible(); });

  test('keeps the contact form on required-field validation', async ({ page }) => { await page.goto('/contact'); await page.getByRole('button', { name: 'Review inquiry state' }).click(); const name = page.getByLabel('Full Name'); await expect(name).toBeFocused(); await expect(page.getByRole('status')).toHaveCount(0); expect(await name.evaluate((input: HTMLInputElement) => input.validationMessage)).toBe('Please fill out this field.'); });
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
    await signIn(page); let postedUpdates: unknown; let failSave = false;
    let releaseSave: (() => void) | undefined;
    const saveResponse = new Promise<void>((resolve) => { releaseSave = resolve; });
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
        }); return;
      }
      postedUpdates = JSON.parse(route.request().postData() || '{}'); if (failSave) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Notification preferences are temporarily unavailable.' }) }); return; }
      await saveResponse;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preferences: [{ category: 'findings', channel: 'slack', enabled: false, required: false, deliveryAvailable: true }] }),
      });
    }); await page.goto('/dashboard/settings/notifications');
    const findingsSlack = page.getByLabel('Breaking findings via slack');
    await expect(findingsSlack).toBeChecked();
    await findingsSlack.uncheck();
    await page.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.getByRole('status')).toContainText('Saving notification preferences…', { timeout: 30_000 });
    releaseSave?.(); await expect(page.getByRole('status')).toContainText('Notification preferences saved.', { timeout: 30_000 });
    expect(postedUpdates).toEqual({ updates: [
      { category: 'security', channel: 'email', enabled: true },
      { category: 'findings', channel: 'slack', enabled: false },
    ] });
    await expect(findingsSlack).not.toBeChecked();
    failSave = true; await findingsSlack.check(); await page.getByRole('button', { name: 'Save preferences' }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Notification preferences are temporarily unavailable.' })).toBeVisible({ timeout: 30_000 }); expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'notification save error').toEqual([]);
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
    let workspaceRequests = 0; let releaseWorkspaceRecovery: (() => void) | undefined; const workspaceRecovery = new Promise<void>((resolve) => { releaseWorkspaceRecovery = resolve; });
    await page.route('**/api/workspaces', async (route) => { workspaceRequests += 1; if (workspaceRequests === 1) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace list unavailable.' }) }); return; } await workspaceRecovery; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeWorkspaceId: 'ws_primary', workspaces: [{ id: 'ws_primary', name: 'Primary Workspace' }] }) }); }); await signIn(page);
    const workspaceError = page.getByRole('alert').filter({ hasText: 'Workspace list unavailable.' }); await expect(workspaceError).toBeVisible({ timeout: 30_000 }); await workspaceError.getByRole('button', { name: 'Try again' }).click(); releaseWorkspaceRecovery?.();
    const selector = page.getByLabel('Active workspace'); await expect(selector).toBeVisible({ timeout: 30_000 });
    await expect(selector).toHaveValue(/.+/);
    await expect(selector.locator('option')).toHaveCount(1);
    await expect(selector).toBeDisabled(); await expect(workspaceRequests).toBeGreaterThanOrEqual(2);
    const results = await new AxeBuilder({ page }).include('aside').analyze();
    expect(results.violations, 'workspace context selector').toEqual([]); await page.unroute('**/api/workspaces');
  });

  test('keeps collapsed workspace navigation links accessible', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/dashboard');

    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    await sidebar.getByRole('button', { name: 'Collapse workspace navigation' }).click();

    const overview = sidebar.getByRole('link', { name: 'Overview' });
    const repositories = sidebar.getByRole('link', { name: 'Repositories' });
    await expect(overview).toHaveAttribute('aria-current', 'page');
    await expect(repositories).toHaveAttribute('aria-label', 'Repositories');
    await expect(repositories).not.toHaveAttribute('aria-current');
  });

  test('switches between authorized workspace contexts through the picker', async ({ page }) => {
    await signIn(page);
    let activeWorkspaceId = 'ws_primary';
    let postedWorkspaceId: string | undefined; let releaseContext: (() => void) | undefined; const contextResponse = new Promise<void>((resolve) => { releaseContext = resolve; });
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
      activeWorkspaceId = postedWorkspaceId || activeWorkspaceId; await contextResponse;
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
    await selector.selectOption('ws_secondary'); await expect(selector).toHaveAttribute('aria-busy', 'true'); await expect(page.getByRole('status').filter({ hasText: 'Switching workspace…' })).toBeVisible(); releaseContext?.();
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
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'workspace administration populated state').toEqual([]);
    await expect(page.getByText(inviteEmail).locator('..')).toContainText('Revoked');
  });
  test('accepts a real generated invitation with the invited account', async ({ page, browser }) => {
    await signIn(page);
    const inviteEmail = `browser-accept-${Date.now()}@example.test`;
    await withAcceptedInvitation(page, browser, inviteEmail, async () => {});
  });
  test('updates and removes a real accepted workspace member', async ({ page, browser }) => {
    await signIn(page);
    const memberEmail = `browser-member-${Date.now()}@example.test`;
    await withAcceptedInvitation(page, browser, memberEmail, async (invitedPage: Page) => {
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
    await expect(page.getByRole('alert').filter({ hasText: 'Finding not found or access denied.' })).toBeVisible({ timeout: 30_000 }); await expect(page.getByRole('alert').filter({ hasText: 'Finding not found or access denied.' })).toHaveAttribute('aria-live', 'assertive'); await expect(page.getByRole('alert').filter({ hasText: 'Finding not found or access denied.' })).toHaveAttribute('aria-atomic', 'true');
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
    const commandPalette = page.getByRole('dialog', { name: 'Search MY OWL' });
    await expect(commandPalette).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search repositories and workspace navigation' })).toBeFocused();
    const commandPaletteResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(commandPaletteResults.violations, 'command palette').toEqual([]);
    const commandButtons = commandPalette.getByRole('button');
    await page.keyboard.press('Shift+Tab');
    await expect(commandButtons.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Search repositories and workspace navigation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(commandPalette).toHaveCount(0);
    await expect(searchTrigger).toBeFocused();

    await page.route('**/api/github/repositories', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const connectTrigger = page.getByRole('button', { name: 'Connect GitHub', exact: true });
    await connectTrigger.click();
    const repositoryDialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
    await expect(repositoryDialog).toBeVisible();
    const repositoryDialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(repositoryDialogResults.violations, 'repository connection dialog').toEqual([]);
    const closeRepositoryDialog = page.getByRole('button', { name: 'Close repository connection dialog' });
    await expect(closeRepositoryDialog).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(repositoryDialog.getByRole('button', { name: 'Connect GitHub', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeRepositoryDialog).toBeFocused();
    await page.keyboard.press('Escape'); await expect(repositoryDialog).toHaveCount(0);
    await expect(connectTrigger).toBeFocused();
    await page.unroute('**/api/github/repositories');

    await page.route('**/api/github/repositories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: true, repositories: [{ id: 'repo-1', name: 'owl', fullName: 'acme/owl', owner: 'acme', private: true, defaultBranch: 'main' }] }),
      });
    });
    await connectTrigger.click();
    const repositoryRadio = page.getByRole('radio', { name: 'Select acme/owl' });
    await expect(repositoryRadio).toBeVisible();
    await repositoryRadio.focus();
    await page.keyboard.press('Space');
    await expect(repositoryRadio).toBeChecked();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: 'Connect GitHub Repository' })).toHaveCount(0);
    await expect(connectTrigger).toBeFocused();
    await page.unroute('**/api/github/repositories');
  });

  test('shows safe invalid-login and permission-denied states without leaking data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('unknown@example.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'invalid login state').toEqual([]);
    await expect(page.getByText('developer@apiproof.dev')).toHaveCount(0);

    await signIn(page);
    await page.route('**/api/workspace/settings', async (route) => {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace access denied.' }) });
    });
    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('alert').filter({ hasText: 'Workspace access denied.' })).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'workspace permission-denied state').toEqual([]);
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
    await expect(page.getByText('No repositories connected yet.')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/repositories');

    let releaseAccount: (() => void) | undefined; const accountLoading = new Promise<void>((resolve) => { releaseAccount = resolve; });
    await page.route('**/api/account', async (route) => { await accountLoading; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to load account settings.' }) }); });
    await page.goto('/dashboard/settings/account'); const accountStatus = page.getByRole('status'); await expect(accountStatus).toContainText('Loading account settings…'); await expect(accountStatus).toHaveAttribute('aria-atomic', 'true'); releaseAccount?.();
    const accountAlert = page.getByRole('alert').filter({ hasText: 'Unable to load account settings.' }); await expect(accountAlert).toBeVisible({ timeout: 30_000 }); await expect(accountAlert).toHaveAttribute('aria-live', 'assertive'); await expect(accountAlert).toHaveAttribute('aria-atomic', 'true');
    await page.unroute('**/api/account');
  });
  test('renders notification loading and error states safely', async ({ page }) => {
    await signIn(page);
    let releasePreferences: (() => void) | undefined;
    let requestCount = 0;
    let initialPreferenceRequestsClosed = false;
    const preferencesLoading = new Promise<void>((resolve) => { releasePreferences = resolve; });
    await page.route('**/api/account/notifications', async (route) => {
      requestCount += 1;
      if (!initialPreferenceRequestsClosed) {
        await preferencesLoading;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Notification preferences are temporarily unavailable.' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ preferences: [{ category: 'findings', channel: 'slack', enabled: true, required: false, deliveryAvailable: true }] }),
      });
    });

    await page.goto('/dashboard/settings/notifications');
    await expect(page.getByText('Loading preferences…')).toBeVisible({ timeout: 30_000 });
    initialPreferenceRequestsClosed = true; releasePreferences?.();
    await expect(page.getByRole('alert').filter({ hasText: 'Notification preferences are temporarily unavailable.' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('table')).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 30_000 }); const preferencesRegion = page.getByRole('region', { name: 'Notification preferences table' }); await preferencesRegion.focus();
    await expect(preferencesRegion).toBeFocused(); expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'notification preferences recovered state').toEqual([]);
    expect(requestCount).toBeGreaterThanOrEqual(2); expect(requestCount).toBeLessThanOrEqual(3);
    await page.unroute('**/api/account/notifications'); }); });
