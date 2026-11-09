import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps workspace administration accessible and preserves skip-link focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Workspace administration' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  const skipLink = page.locator('.skip-link').first();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});
