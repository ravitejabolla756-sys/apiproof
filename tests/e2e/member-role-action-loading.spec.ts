import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks member role update busy while the request is pending', async ({ page }) => {
  await signIn(page);

  const workspace = { id: 'workspace-role-loading', name: 'Fixture workspace', slug: 'fixture', role: 'owner' };
  const member = { id: 'member-role-loading', userId: 'user-role-loading', name: 'Fixture Member', email: 'member-role-loading@example.test', role: 'member', createdAt: '2026-11-08T00:00:00.000Z' };
  let releaseRole: (() => void) | undefined;
  const rolePending = new Promise<void>((resolve) => {
    releaseRole = resolve;
  });

  await page.route('**/api/workspace/settings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace }) });
  });
  await page.route('**/api/workspace/members', async (route) => {
    if (route.request().method() === 'PATCH') {
      await rolePending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ ...member, role: 'owner' }] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [member] }) });
  });
  await page.route('**/api/workspace/invitations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invitations: [] }) });
  });
  await page.route('**/api/workspace/audit', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [], nextCursor: null }) });
  });

  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });
  const role = page.getByLabel('Role for member-role-loading@example.test');
  await expect(role).toHaveValue('member', { timeout: 30_000 });
  await role.selectOption('owner');
  await expect(role).toHaveAttribute('aria-busy', 'true');

  releaseRole?.();
  await expect(role).toHaveValue('owner', { timeout: 30_000 });
  await expect(role).not.toHaveAttribute('aria-busy');

  await page.unroute('**/api/workspace/settings');
  await page.unroute('**/api/workspace/members');
  await page.unroute('**/api/workspace/invitations');
  await page.unroute('**/api/workspace/audit');
});
