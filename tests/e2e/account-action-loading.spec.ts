import { expect, test } from '@playwright/test';
import { createLocalAccount } from './helpers.js';

test('announces account profile saving as a busy status', async ({ page }) => {
  const email = `browser-account-loading-${Date.now()}@example.test`;
  await createLocalAccount(page, email, 'AccountLoading123!');
  await page.goto('/dashboard/settings/account');

  let releasePatch!: () => void;
  const patchReleased = new Promise<void>((resolve) => { releasePatch = resolve; });
  await page.route('**/api/account', async (route) => {
    if (route.request().method() === 'PATCH') await patchReleased;
    await route.continue();
  });

  await page.getByLabel('Display name').fill('Updated loading account');
  await page.getByRole('button', { name: 'Save profile' }).click();
  const progress = page.getByRole('status').filter({ hasText: 'Saving…' });
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { name: 'Account settings' }).locator('..').locator('..').locator('..')).toHaveAttribute('aria-busy', 'true');

  releasePatch();
  await expect(page.getByRole('status').filter({ hasText: 'Profile updated.' })).toBeVisible();
  await page.unroute('**/api/account');
});
