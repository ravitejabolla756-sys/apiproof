import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test.describe('workspace audit trail', () => {
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
