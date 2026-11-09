import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps password recovery actions touch-sized and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/forgot-password');
  const forgotHome = page.locator('main a[href="/"]');
  await expect(forgotHome).toBeVisible();
  expect((await forgotHome.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel('Email').boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const requestReset = page.getByRole('button', { name: 'Send reset link' });
  const forgotBack = page.getByRole('link', { name: 'Back to sign in' });
  expect((await requestReset.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await forgotBack.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await requestReset.focus(); await expect(requestReset).toBeFocused();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  await page.goto('/reset-password#token=test-token');
  const resetHome = page.locator('main a[href="/"]');
  await expect(resetHome).toBeVisible();
  expect((await resetHome.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel('New password').boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const resetPassword = page.getByRole('button', { name: 'Reset password' });
  const resetBack = page.getByRole('link', { name: 'Back to sign in' });
  await expect(resetPassword).toBeVisible();
  expect((await resetPassword.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await resetBack.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await resetPassword.focus(); await expect(resetPassword).toBeFocused();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});

test('keeps missing verification-token recovery accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/verify-email');
  const alert = page.getByRole('alert').filter({ hasText: 'missing its token' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  const signIn = page.getByRole('link', { name: 'Continue to sign in' });
  expect((await signIn.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await signIn.focus(); await expect(signIn).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
