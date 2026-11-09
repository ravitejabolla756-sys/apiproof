import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks invitation creation busy while the request is pending', async ({ page }) => {
  await signIn(page);
  const workspace = { id: 'workspace-invite-loading', name: 'Fixture workspace', slug: 'fixture', role: 'owner' };
  await page.route('**/api/workspace/settings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace }) });
  });
  await page.route('**/api/workspace/members', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: [] }) });
  });
  await page.route('**/api/workspace/invitations', async (route) => {
    if (route.request().method() === 'POST') {
      await invitePending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ inviteUrl: '/invite/accept?token=fixture-token' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ invitations: [] }) });
  });
  await page.route('**/api/workspace/audit', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [], nextCursor: null }) });
  });
  let releaseInvite: (() => void) | undefined;
  const invitePending = new Promise<void>((resolve) => { releaseInvite = resolve; });
  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Invite email').fill('loading-invite@example.test');
  const createInvite = page.getByRole('button', { name: 'Create invite link' });
  await createInvite.click();
  await expect(page.getByRole('button', { name: 'Creating…' })).toHaveAttribute('aria-busy', 'true');
  releaseInvite?.();
  await expect(page.getByRole('button', { name: 'Create invite link' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await page.unroute('**/api/workspace/settings');
  await page.unroute('**/api/workspace/members');
  await page.unroute('**/api/workspace/invitations');
  await page.unroute('**/api/workspace/audit');
});
