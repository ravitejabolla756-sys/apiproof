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
    const signInSubmit = page.locator('form button[type="submit"]');
    await signInSubmit.focus(); await expect(signInSubmit).toBeFocused(); await page.keyboard.press('Enter');
    const signInStatus = page.getByText('Signing in...', { exact: true }); await expect(signInStatus).toBeVisible(); await expect(signInStatus).toHaveAttribute('aria-atomic', 'true'); await expect(signInStatus).toHaveAttribute('aria-busy', 'true');
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
    const sendResetLink = page.getByRole('button', { name: 'Send reset link' });
    await sendResetLink.focus(); await expect(sendResetLink).toBeFocused(); await page.keyboard.press('Enter');
    const sendingStatus = page.getByText('Sending…', { exact: true }); await expect(sendingStatus).toBeVisible(); await expect(sendingStatus).toHaveAttribute('aria-busy', 'true');
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
    const resetPassword = page.getByRole('button', { name: 'Reset password' });
    await resetPassword.focus(); await expect(resetPassword).toBeFocused(); await page.keyboard.press('Enter');
    const updatingStatus = page.getByText('Updating…', { exact: true }); await expect(updatingStatus).toBeVisible(); await expect(updatingStatus).toHaveAttribute('aria-busy', 'true');
    releaseReset?.();
    const resetStatus = page.getByRole('status'); await expect(resetStatus).toContainText('Password updated.'); await expect(resetStatus).toHaveAttribute('aria-atomic', 'true');
  });

  test('announces auth-entry recovery failures without enabling unsafe reset actions', async ({ page }) => {
    await page.goto('/reset-password');
    const missingToken = page.getByRole('alert').filter({ hasText: 'This reset link is missing or invalid.' });
    await expect(missingToken).toBeVisible(); await expect(missingToken).toHaveAttribute('aria-live', 'assertive'); await expect(page.getByLabel('New password')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Reset password' })).toHaveCount(0);

    await page.route('**/api/auth', async (route) => { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Password recovery is temporarily unavailable.' }) }); });
    await page.goto('/forgot-password'); await page.getByLabel('Email').fill('member@example.test'); await page.getByRole('button', { name: 'Send reset link' }).click();
    const recoveryAlert = page.getByRole('alert').filter({ hasText: 'Password recovery is temporarily unavailable.' }); await expect(recoveryAlert).toBeVisible(); await expect(recoveryAlert).toHaveAttribute('aria-atomic', 'true'); await page.unroute('**/api/auth');
  });

  test('marks email verification progress as busy', async ({ page }) => {
    let releaseVerification: (() => void) | undefined;
    const verificationPending = new Promise<void>((resolve) => { releaseVerification = resolve; });
    await page.route('**/api/auth', async (route) => { await verificationPending; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Email address verified successfully.' }) }); });
    await page.goto('/verify-email#token=test-token');
    const verificationStatus = page.getByRole('status').filter({ hasText: 'Checking your verification link…' });
    await expect(verificationStatus).toBeVisible();
    await expect(verificationStatus).toHaveAttribute('aria-busy', 'true');
    releaseVerification?.();
    const verifiedStatus = page.getByRole('status').filter({ hasText: 'Email address verified successfully.' });
    await expect(verifiedStatus).toBeVisible({ timeout: 30_000 });
    await expect(verifiedStatus).toBeFocused();
    await page.unroute('**/api/auth');
  });
});
