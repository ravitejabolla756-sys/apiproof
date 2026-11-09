import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('fails closed when member and invitation collections are malformed', async ({ page }) => {
  await page.route('**/api/workspace/members', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [{ id: 'member-1', userId: 'user-1', email: 'member@example.test', name: 'Member', role: 'admin', createdAt: '2026-11-09T00:00:00.000Z' }] }) });
  });
  await page.route('**/api/workspace/invitations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invitations: [{ id: 'invite-1', email: 'invite@example.test', role: 'member', expiresAt: 4, acceptedAt: null, revokedAt: null, createdAt: '2026-11-09T00:00:00.000Z' }] }) });
  });

  await signIn(page);
  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load workspace members.' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load workspace invitations.' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Workspace members' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Recent invitations' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'malformed organization collections').toEqual([]);
  await page.unroute('**/api/workspace/members');
  await page.unroute('**/api/workspace/invitations');
});
