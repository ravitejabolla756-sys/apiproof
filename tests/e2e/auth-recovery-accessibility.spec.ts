import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('keeps password recovery actions touch-sized and accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/forgot-password');
  expect((await page.getByLabel('Email').boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const requestReset = page.getByRole('button', { name: 'Send reset link' });
  const forgotBack = page.getByRole('link', { name: 'Back to sign in' });
  expect((await requestReset.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await forgotBack.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  await page.goto('/reset-password#token=test-token');
  expect((await page.getByLabel('New password').boundingBox())?.height).toBeGreaterThanOrEqual(44);
  const resetPassword = page.getByRole('button', { name: 'Reset password' });
  const resetBack = page.getByRole('link', { name: 'Back to sign in' });
  await expect(resetPassword).toBeVisible();
  expect((await resetPassword.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await resetBack.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);
});
