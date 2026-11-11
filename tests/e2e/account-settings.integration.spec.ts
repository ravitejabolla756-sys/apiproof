import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('authenticated account settings loads and supports profile update', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('developer@apiproof.dev');
  const name = page.getByLabel('Display name');
  await name.fill('Browser Verified User');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Profile updated.');
});

test('unauthenticated account settings redirects to login', async ({ page }) => {
  await page.goto('/dashboard/settings/account');
  await expect(page).toHaveURL(/\/login/);
});

test('account settings remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  expect(await page.evaluate(() => {
    const browser = globalThis as unknown as { document: { documentElement: { scrollWidth: number } }; innerWidth: number };
    return browser.document.documentElement.scrollWidth <= browser.innerWidth + 1;
  })).toBe(true);
});
