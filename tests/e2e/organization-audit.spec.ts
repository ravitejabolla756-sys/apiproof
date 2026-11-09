import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn, withAcceptedInvitation } from './helpers.js';

test.describe('workspace audit trail', () => {
  test('exposes stable workspace form metadata and native input bounds', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    const workspaceName = page.getByLabel('Name', { exact: true });
    const workspaceSlug = page.getByLabel('Slug', { exact: true });
    const inviteEmail = page.getByLabel('Invite email');
    await expect(workspaceName).toHaveAttribute('name', 'workspaceName');
    await expect(workspaceName).toHaveAttribute('autocomplete', 'organization');
    await expect(workspaceName).toHaveAttribute('maxlength', '100');
    await expect(workspaceSlug).toHaveAttribute('name', 'workspaceSlug');
    await expect(workspaceSlug).toHaveAttribute('autocomplete', 'off');
    await expect(workspaceSlug).toHaveAttribute('maxlength', '64');
    await expect(inviteEmail).toHaveAttribute('name', 'inviteEmail');
    await expect(inviteEmail).toHaveAttribute('autocomplete', 'email');
    await expect(inviteEmail).toHaveAttribute('maxlength', '254');
    await expect(inviteEmail).toHaveAttribute('inputmode', 'email');
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'workspace form metadata').toEqual([]);
  });

  test('recovers an unauthorized stale workspace cookie without leaking context', async ({ page }) => {
    await signIn(page);
    const initialResponse = await page.request.get('/api/workspaces');
    expect(initialResponse.status()).toBe(200);
    const initial = await initialResponse.json() as { activeWorkspaceId?: string; workspaces?: Array<{ id: string }> };
    expect(initial.activeWorkspaceId).toBeTruthy();
    expect(initial.workspaces?.some((workspace) => workspace.id === initial.activeWorkspaceId)).toBe(true);

    await page.context().addCookies([{ name: 'apiproof_workspace_id', value: 'ws_stale_not_authorized', url: new URL(page.url()).origin }]);
    const recoveredResponse = await page.request.get('/api/workspaces');
    expect(recoveredResponse.status()).toBe(200);
    const recovered = await recoveredResponse.json() as { activeWorkspaceId?: string; workspaces?: Array<{ id: string }> };
    expect(recovered.activeWorkspaceId).toBe(initial.activeWorkspaceId);
    expect(recovered.workspaces?.some((workspace) => workspace.id === 'ws_stale_not_authorized')).toBe(false);
    expect((await new AxeBuilder({ page }).include('aside').analyze()).violations, 'stale workspace recovery').toEqual([]);
  });

  test('keeps the owner visible when member removal is refused by last-owner protection', async ({ page }) => {
    await page.route('**/api/workspace/members', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'A workspace must retain at least one owner.', code: 'LAST_OWNER_REQUIRED' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [{ id: 'owner-member', userId: 'seed-owner', name: 'APIProof Developer', email: 'developer@apiproof.dev', role: 'owner', createdAt: '2026-11-08T00:00:00.000Z' }] }),
      });
    });
    page.on('dialog', (dialog) => void dialog.accept());
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    const remove = page.getByRole('button', { name: 'Remove', exact: true });
    await expect(remove).toBeVisible({ timeout: 30_000 });
    await remove.click();
    await expect(page.getByRole('alert').filter({ hasText: 'A workspace must retain at least one owner.' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content').getByText('developer@apiproof.dev', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'last-owner refusal').toEqual([]);
    await page.unroute('**/api/workspace/members');
  });

  test('keeps the owner role when demotion is refused by last-owner protection', async ({ page }) => {
    await page.route('**/api/workspace/members', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'A workspace must retain at least one owner.', code: 'LAST_OWNER_REQUIRED' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ members: [{ id: 'owner-member', userId: 'seed-owner', name: 'APIProof Developer', email: 'developer@apiproof.dev', role: 'owner', createdAt: '2026-11-08T00:00:00.000Z' }] }),
      });
    });
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    const role = page.getByLabel('Role for developer@apiproof.dev');
    await expect(role).toHaveValue('owner', { timeout: 30_000 });
    await expect(role).toHaveCSS('font-size', '16px');
    expect((await role.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await role.selectOption('member');
    await expect(page.getByRole('alert').filter({ hasText: 'A workspace must retain at least one owner.' })).toBeVisible({ timeout: 30_000 });
    await expect(role).toHaveValue('owner');
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'last-owner role refusal').toEqual([]);
    await page.unroute('**/api/workspace/members');
  });

  test('hides owner-only workspace controls from an accepted member', async ({ page, browser }) => {
    await signIn(page);
    const inviteEmail = `browser-member-boundary-${Date.now()}@example.test`;
    await withAcceptedInvitation(page, browser, inviteEmail, async (invitedPage) => {
      await invitedPage.goto('/dashboard');
      const workspaceResponse = await invitedPage.request.get('/api/workspaces');
      const workspaceData = await workspaceResponse.json() as { workspaces?: Array<{ id: string; role: string }> };
      const memberWorkspace = workspaceData.workspaces?.find((workspace) => workspace.role === 'member');
      expect(memberWorkspace).toBeTruthy();
      const workspaceSelector = invitedPage.getByLabel('Active workspace');
      await workspaceSelector.selectOption(memberWorkspace!.id);
      await expect(workspaceSelector).toHaveValue(memberWorkspace!.id);
      await invitedPage.goto('/dashboard/settings/workspace');
      await expect(invitedPage.getByText('Member access')).toBeVisible({ timeout: 30_000 });
      await expect(invitedPage.getByRole('heading', { name: 'Invite a member' })).toHaveCount(0);
      await expect(invitedPage.getByLabel('Invite email')).toHaveCount(0);
      await expect(invitedPage.getByRole('button', { name: 'Save workspace' })).toHaveCount(0);
      await expect(invitedPage.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
    });
  });

  test('announces an empty workspace list instead of a loading state', async ({ page }) => {
    await page.route('**/api/workspaces', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeWorkspaceId: null, workspaces: [] }) });
    });
    await signIn(page);
    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    await expect(sidebar.getByRole('status').filter({ hasText: 'No workspaces are available.' })).toBeVisible({ timeout: 30_000 });
    await expect(sidebar.getByLabel('Active workspace')).toBeDisabled();
    await expect(sidebar.getByLabel('Active workspace').locator('option')).toHaveText('No workspaces available');
    expect((await new AxeBuilder({ page }).include('aside').analyze()).violations, 'empty workspace list state').toEqual([]);
    await page.unroute('**/api/workspaces');
  });

  test('announces workspace-list loading as a busy state', async ({ page }) => {
    let releaseWorkspaces: (() => void) | undefined;
    const workspacesLoading = new Promise<void>((resolve) => { releaseWorkspaces = resolve; });
    await page.route('**/api/workspaces', async (route) => {
      await workspacesLoading;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeWorkspaceId: 'ws-primary', workspaces: [{ id: 'ws-primary', name: 'Primary Workspace', role: 'owner' }] }) });
    });
    await signIn(page); await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    const loading = sidebar.getByRole('status').filter({ hasText: 'Loading workspace list…' });
    await expect(loading).toBeVisible(); await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(sidebar.getByLabel('Active workspace')).toHaveAttribute('aria-busy', 'true');
    releaseWorkspaces?.(); await expect(sidebar.getByLabel('Active workspace')).toHaveValue('ws-primary', { timeout: 30_000 });
    await expect(loading).toHaveCount(0); await page.unroute('**/api/workspaces');
  });

  test('keeps workspace-list recovery visible and busy while retrying', async ({ page }) => {
    let requests = 0;
    let releaseRecovery: (() => void) | undefined;
    const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
    await page.route('**/api/workspaces', async (route) => {
      requests += 1;
      if (requests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace list unavailable.' }) });
        return;
      }
      await recoveryPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeWorkspaceId: 'ws-primary', workspaces: [{ id: 'ws-primary', name: 'Primary Workspace' }] }) });
    });
    await signIn(page);
    const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    const alert = sidebar.getByRole('alert').filter({ hasText: 'Workspace list unavailable.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    const retry = alert.getByRole('button');
    await retry.click();
    await expect(alert).toBeVisible();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    await expect(retry).toHaveText('Retrying workspace list…');
    releaseRecovery?.();
    await expect(alert).toHaveCount(0);
    await expect(sidebar.getByLabel('Active workspace')).toHaveValue('ws-primary', { timeout: 30_000 });
    expect(requests).toBe(2);
    await page.unroute('**/api/workspaces');
  });

  test('distinguishes unavailable members and invitations from empty states', async ({ page }) => {
    await signIn(page);
    let memberRequests = 0; let allowCollectionRecovery = false; let memberRecoveryPending = true; let releaseMemberRecovery: (() => void) | undefined;
    const memberRecovery = new Promise<void>((resolve) => { releaseMemberRecovery = resolve; });
    await page.route('**/api/workspace/members', async (route) => {
      memberRequests += 1;
      if (!allowCollectionRecovery) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Member history is temporarily unavailable.' }) });
        return;
      }
      if (memberRecoveryPending) {
        memberRecoveryPending = false;
        await memberRecovery;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'member-recovered', userId: 'user-recovered', name: 'Recovered Member', email: 'recovered@example.test', role: 'member', createdAt: '2026-11-08T00:00:00.000Z' }] }) });
    });
    let invitationRequests = 0; let invitationRecoveryPending = true; let releaseInvitationRecovery: (() => void) | undefined;
    const invitationRecovery = new Promise<void>((resolve) => { releaseInvitationRecovery = resolve; });
    await page.route('**/api/workspace/invitations', async (route) => {
      invitationRequests += 1;
      if (!allowCollectionRecovery) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Invitation history is temporarily unavailable.' }) });
        return;
      }
      if (invitationRecoveryPending) {
        invitationRecoveryPending = false;
        await invitationRecovery;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invitations: [{ id: 'invitation-recovered', email: 'recovered-invite@example.test', role: 'member', expiresAt: '2026-11-15T00:00:00.000Z', acceptedAt: null, revokedAt: null, createdAt: '2026-11-08T00:00:00.000Z' }] }) });
    });
    await page.goto('/dashboard/settings/workspace');
    const memberAlert = page.getByRole('alert').filter({ hasText: 'Member history is temporarily unavailable.' });
    await expect(memberAlert).toBeVisible({ timeout: 30_000 });
    await expect(memberAlert).toBeFocused();
    await expect(page.getByRole('alert').filter({ hasText: 'Invitation history is temporarily unavailable.' })).toBeVisible();
    await expect(page.getByText('No workspace members found.')).toHaveCount(0);
    await expect(page.getByText('No recent invitations.')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'organization fetch failure states').toEqual([]);
    allowCollectionRecovery = true;
    const retryMembers = page.getByRole('button', { name: 'Retry members' });
    await retryMembers.focus(); await expect(retryMembers).toBeFocused(); await page.keyboard.press('Enter');
    await expect(retryMembers).toBeDisabled(); await expect(retryMembers).toHaveAttribute('aria-busy', 'true');
    releaseMemberRecovery?.();
    const retryInvitations = page.getByRole('button', { name: 'Retry invitations' });
    await retryInvitations.focus(); await expect(retryInvitations).toBeFocused(); await retryInvitations.press('Enter');
    await expect(retryInvitations).toBeDisabled(); await expect(retryInvitations).toHaveAttribute('aria-busy', 'true');
    releaseInvitationRecovery?.();
    await expect(page.getByText('Member history is temporarily unavailable.')).toHaveCount(0);
    await expect(page.getByText('Invitation history is temporarily unavailable.')).toHaveCount(0);
    await expect(page.getByText('Recovered Member')).toBeVisible();
    await expect(page.getByText('recovered-invite@example.test')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Workspace members' }).locator(':scope > li')).toHaveCount(1);
    await expect(page.getByRole('list', { name: 'Recent invitations' }).locator(':scope > li')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'organization recovered states').toEqual([]);
    expect(memberRequests).toBeGreaterThanOrEqual(2);
    expect(invitationRequests).toBeGreaterThanOrEqual(2);
    await page.unroute('**/api/workspace/members');
    await page.unroute('**/api/workspace/invitations');
  });

  test('recovers from an initial workspace-settings failure', async ({ page }) => {
    await signIn(page);
    let settingsRequests = 0; let allowSettingsRecovery = false;
    await page.route('**/api/workspace/settings', async (route) => {
      settingsRequests += 1;
      if (!allowSettingsRecovery) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace settings are temporarily unavailable.' }) });
        return;
      }
      await route.continue();
    });

    await page.goto('/dashboard/settings/workspace');
    const alert = page.getByRole('alert').filter({ hasText: 'Workspace settings are temporarily unavailable.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toBeFocused();
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'workspace settings initial failure').toEqual([]);
    allowSettingsRecovery = true;
    const retrySettings = alert.getByRole('button', { name: 'Retry' });
    await retrySettings.focus(); await expect(retrySettings).toBeFocused(); await page.keyboard.press('Enter');
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'workspace settings recovered state').toEqual([]);
    expect(settingsRequests).toBeGreaterThanOrEqual(2);
    await page.unroute('**/api/workspace/settings');
  });

  test('announces when invitation-link copying is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async () => { throw new Error('Clipboard unavailable'); } },
      });
    });
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    const inviteEmail = `browser-clipboard-${Date.now()}@example.test`;
    await page.getByLabel('Invite email').fill(inviteEmail);
    await page.getByRole('button', { name: 'Create invite link' }).click();
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Copy link' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Unable to copy the invitation link.' });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'clipboard failure state').toEqual([]);
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: `Cancel invitation for ${inviteEmail}` }).click();
  });

  test('does not present an audit failure as an empty trail', async ({ page }) => {
    await signIn(page);
    let releaseSettings: (() => void) | undefined;
    const settingsLoading = new Promise<void>((resolve) => { releaseSettings = resolve; });
    await page.route('**/api/workspace/settings', async (route) => { await settingsLoading; await route.continue(); });

    let allowAuditRecovery = false; let releaseAuditRecovery: (() => void) | undefined;
    const auditRecovery = new Promise<void>((resolve) => { releaseAuditRecovery = resolve; });
    await page.route('**/api/workspace/audit**', async (route) => {
      if (!allowAuditRecovery) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Audit history is temporarily unavailable.' }),
        });
        return;
      }
      await auditRecovery;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [{ id: 'audit-recovered', action: 'audit.recovered', actorEmail: 'owner@example.test', targetType: 'workspace', createdAt: '2026-11-08T00:00:00.000Z' }], nextCursor: null }),
      });
    });

    await page.goto('/dashboard/settings/workspace');
    const settingsLoadingStatus = page.getByRole('status').filter({ hasText: 'Loading workspace settings…' }); await expect(settingsLoadingStatus).toBeVisible(); await expect(settingsLoadingStatus).toHaveAttribute('aria-busy', 'true');
    releaseSettings?.();
    const auditAlert = page.getByRole('alert').filter({ hasText: 'Audit history is temporarily unavailable.' }); await expect(auditAlert).toBeVisible({ timeout: 30_000 }); await expect(auditAlert).toHaveAttribute('aria-live', 'assertive'); await expect(auditAlert).toHaveAttribute('aria-atomic', 'true');
    await expect(page.getByText('No administrative events recorded yet.')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'audit failure state').toEqual([]);

    allowAuditRecovery = true;
    const retryAudit = page.getByRole('button', { name: 'Retry audit' });
    await retryAudit.focus(); await expect(retryAudit).toBeFocused(); await page.keyboard.press('Enter');
    await expect(retryAudit).toBeDisabled(); await expect(retryAudit).toHaveAttribute('aria-busy', 'true');
    releaseAuditRecovery?.();
    await expect(page.getByText('Audit history is temporarily unavailable.')).toHaveCount(0);
    await expect(page.getByText('audit.recovered')).toBeVisible({ timeout: 30_000 });
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'audit recovered state').toEqual([]);

    await page.unroute('**/api/workspace/settings');
    await page.unroute('**/api/workspace/audit**');
  });

  test('loads the next audit page through the cursor contract', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await signIn(page);
    let releaseNextAudit: (() => void) | undefined;
    const nextAuditResponse = new Promise<void>((resolve) => { releaseNextAudit = resolve; });

    await page.route('**/api/workspace/audit**', async (route) => {
      const cursor = new URL(route.request().url()).searchParams.get('cursor');
      if (!cursor) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [{ id: 'audit-1', action: 'workspace.updated', actorEmail: 'owner@example.test', targetType: 'workspace', createdAt: '2026-11-07T10:00:00.000Z' }],
            nextCursor: 'cursor-1',
          }),
        });
        return;
      }

      expect(cursor).toBe('cursor-1');
      await nextAuditResponse;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [{ id: 'audit-2', action: 'member.removed', actorEmail: 'owner@example.test', targetType: 'member', createdAt: '2026-11-07T10:01:00.000Z' }],
          nextCursor: null,
        }),
      });
    });

    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByText('workspace.updated')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Load more audit events' })).toBeVisible(); expect((await page.getByRole('button', { name: 'Load more audit events' }).boundingBox())?.height).toBeGreaterThanOrEqual(44); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'initial audit page').toEqual([]);

    await page.getByRole('button', { name: 'Load more audit events' }).click();
    await expect(page.getByRole('status')).toContainText('Loading more audit events…');
    releaseNextAudit?.();
    await expect(page.getByText('member.removed')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Load more audit events' })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'expanded audit page').toEqual([]);

    await page.unroute('**/api/workspace/audit**');
  });

  test('fails closed for malformed invitation and audit timestamps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/workspace/invitations', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invitations: [{ id: 'invalid-invitation-date', email: 'invalid-date@example.test', role: 'member', expiresAt: '2026-02-31T00:00:00.000Z', acceptedAt: null, revokedAt: null, createdAt: '2026-11-09T00:00:00.000Z' }] }) });
    });
    await page.route('**/api/workspace/audit**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [{ id: 'invalid-audit-date', action: 'workspace.updated', actorEmail: 'owner@example.test', targetType: 'workspace', createdAt: 'not-a-date' }], nextCursor: null }) });
    });
    await signIn(page);
    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('list', { name: 'Recent invitations' }).getByText('Unavailable', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('list', { name: 'Administrative events' }).getByText('Unavailable', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Invalid Date', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'malformed workspace dates').toEqual([]);
    await page.unroute('**/api/workspace/invitations');
    await page.unroute('**/api/workspace/audit**');
  });
});
