import { expect, test } from '@playwright/test';

test.describe('authentication loading announcements', () => {
  test('announces login, reset-request and password-reset submission progress', async ({ page }) => {
    let releaseLogin: (() => void) | undefined;
    const loginPending = new Promise<void>((resolve) => { releaseLogin = resolve; });
    await page.route('**/api/auth', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await loginPending;
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid email or password.' }) });
    });
    await page.goto('/login');
    await page.getByLabel('Email').fill('unknown@example.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText('Signing in...', { exact: true })).toBeVisible();
    releaseLogin?.();
    await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password.' })).toBeVisible();
    await page.unroute('**/api/auth');

    let releaseRequest: (() => void) | undefined;
    const requestPending = new Promise<void>((resolve) => { releaseRequest = resolve; });
    await page.route('**/api/auth', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await requestPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'If an account exists, a reset link has been sent.' }) });
    });
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('member@example.test');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('Sending…', { exact: true })).toBeVisible();
    releaseRequest?.();
    await expect(page.getByRole('status')).toContainText('If an account exists');
    await page.unroute('**/api/auth');

    let releaseReset: (() => void) | undefined;
    const resetPending = new Promise<void>((resolve) => { releaseReset = resolve; });
    await page.route('**/api/auth', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await resetPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Password updated.' }) });
    });
    await page.goto('/reset-password#token=test-token');
    await page.getByLabel('New password').fill('new-password-123');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Updating…', { exact: true })).toBeVisible();
    releaseReset?.();
    await expect(page.getByRole('status')).toContainText('Password updated.');
  });
});
