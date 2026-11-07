import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test.describe('workspace audit trail', () => {
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

  test('distinguishes unavailable members and invitations from empty states', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/workspace/members', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Member history is temporarily unavailable.' }) });
    });
    await page.route('**/api/workspace/invitations', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Invitation history is temporarily unavailable.' }) });
    });
    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('alert').filter({ hasText: 'Member history is temporarily unavailable.' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Invitation history is temporarily unavailable.' })).toBeVisible();
    await expect(page.getByText('No workspace members found.')).toHaveCount(0);
    await expect(page.getByText('No recent invitations.')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'organization fetch failure states').toEqual([]);
    await page.unroute('**/api/workspace/members');
    await page.unroute('**/api/workspace/invitations');
  });

  test('recovers from an initial workspace-settings failure', async ({ page }) => {
    await signIn(page);
    let settingsRequests = 0;
    await page.route('**/api/workspace/settings', async (route) => {
      settingsRequests += 1;
      if (settingsRequests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace settings are temporarily unavailable.' }) });
        return;
      }
      await route.continue();
    });

    await page.goto('/dashboard/settings/workspace');
    const alert = page.getByRole('alert').filter({ hasText: 'Workspace settings are temporarily unavailable.' });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'workspace settings initial failure').toEqual([]);
    await alert.getByRole('button', { name: 'Retry' }).click();
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

    await page.route('**/api/workspace/audit**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Audit history is temporarily unavailable.' }),
      });
    });

    await page.goto('/dashboard/settings/workspace');
    await expect(page.getByRole('status')).toContainText('Loading workspace settings…');
    releaseSettings?.();
    const auditAlert = page.getByRole('alert').filter({ hasText: 'Audit history is temporarily unavailable.' }); await expect(auditAlert).toBeVisible({ timeout: 30_000 }); await expect(auditAlert).toHaveAttribute('aria-live', 'assertive'); await expect(auditAlert).toHaveAttribute('aria-atomic', 'true');
    await expect(page.getByText('No administrative events recorded yet.')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'audit failure state').toEqual([]);

    await page.unroute('**/api/workspace/settings');
    await page.unroute('**/api/workspace/audit**');
  });

  test('loads the next audit page through the cursor contract', async ({ page }) => {
    await signIn(page);
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
    await expect(page.getByRole('button', { name: 'Load more audit events' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'initial audit page').toEqual([]);

    await page.getByRole('button', { name: 'Load more audit events' }).click();
    await expect(page.getByRole('status')).toContainText('Loading more audit events…');
    releaseNextAudit?.();
    await expect(page.getByText('member.removed')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Load more audit events' })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'expanded audit page').toEqual([]);

    await page.unroute('**/api/workspace/audit**');
  });
});
