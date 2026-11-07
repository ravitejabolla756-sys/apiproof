import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test.describe('authentication loading announcements', () => {
  test('announces dashboard session validation in progress', async ({ page }) => {
    await signIn(page);
    let releaseSession: (() => void) | undefined;
    const sessionPending = new Promise<void>((resolve) => { releaseSession = resolve; });
    await page.route('**/api/auth', async (route) => {
      if (route.request().method() === 'GET') {
        await sessionPending;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) });
        return;
      }
      await route.continue();
    });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const sessionStatus = page.getByRole('status').filter({ hasText: 'Checking your session…' });
    await expect(sessionStatus).toBeVisible();
    await expect(sessionStatus).toHaveAttribute('aria-live', 'polite');
    await expect(sessionStatus).toHaveAttribute('aria-atomic', 'true');
    releaseSession?.();
    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/auth');
  });

  test('announces dashboard session validation failure', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/auth', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Session validation unavailable.' }) });
        return;
      }
      await route.continue();
    });
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const sessionAlert = page.getByRole('alert').filter({ hasText: 'We could not validate your session.' });
    await expect(sessionAlert).toBeVisible();
    await expect(sessionAlert).toHaveAttribute('aria-live', 'assertive');
    await expect(sessionAlert).toHaveAttribute('aria-atomic', 'true');
    await page.unroute('**/api/auth');
  });

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
    const signInStatus = page.getByText('Signing in...', { exact: true }); await expect(signInStatus).toBeVisible(); await expect(signInStatus).toHaveAttribute('aria-atomic', 'true');
    releaseLogin?.();
    const loginAlert = page.getByRole('alert').filter({ hasText: 'Invalid email or password.' }); await expect(loginAlert).toBeVisible(); await expect(loginAlert).toHaveAttribute('aria-live', 'assertive'); await expect(loginAlert).toHaveAttribute('aria-atomic', 'true');
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
    const requestStatus = page.getByRole('status'); await expect(requestStatus).toContainText('If an account exists'); await expect(requestStatus).toHaveAttribute('aria-atomic', 'true');
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
    const resetStatus = page.getByRole('status'); await expect(resetStatus).toContainText('Password updated.'); await expect(resetStatus).toHaveAttribute('aria-atomic', 'true');
  });
});
