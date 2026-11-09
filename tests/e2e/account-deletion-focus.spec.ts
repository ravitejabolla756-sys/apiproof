import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps account deletion non-destructive and preserves account skip-link focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({ timeout: 30_000 });
  const deletionHeading = page.getByRole('heading', { name: 'Account deletion' });
  await expect(deletionHeading).toBeVisible();
  const deletionButton = page.getByRole('button', { name: 'Account deletion unavailable' });
  await expect(deletionButton).toBeDisabled();
  await expect(deletionButton).toHaveAttribute('aria-describedby', 'account-deletion-help');
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  const skipLink = page.locator('.skip-link').first();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
