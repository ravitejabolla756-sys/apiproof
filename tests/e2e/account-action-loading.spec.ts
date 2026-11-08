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

test('keeps account-load recovery visible and busy while retrying', async ({ page }) => {
  const email = `browser-account-recovery-${Date.now()}@example.test`;
  await createLocalAccount(page, email, 'AccountRecovery123!');
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  await page.route('**/api/account', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unable to load account settings.' }) });
      return;
    }
    await recoveryPending;
    await route.continue();
  });
  await page.goto('/dashboard/settings/account');
  const alert = page.getByRole('alert').filter({ hasText: 'Unable to load account settings.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const retry = alert.getByRole('button', { name: /Retry(?:ing)? account load/ });
  allowRecovery = true;
  await retry.click();
  await expect(alert).toBeVisible();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/account');
});
