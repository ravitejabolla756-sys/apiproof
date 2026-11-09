import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps the digest boundary disabled and preserves notification skip-link focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Notification preferences' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Digest scheduling is unavailable until its cadence, recipient and scheduler contract is approved.')).toBeVisible();
  await expect(page.getByLabel('Weekly digest via email')).toBeDisabled();
  await expect(page.getByLabel('Weekly digest via slack')).toBeDisabled();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  const skipLink = page.locator('.skip-link').first();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
