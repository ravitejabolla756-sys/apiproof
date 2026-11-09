import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('fails closed when workspace settings have an invalid server projection', async ({ page }) => {
  await page.route('**/api/workspace/settings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace: { id: 'ws-primary', name: 'Primary Workspace', slug: 'primary-workspace', role: 'admin' } }) });
  });

  await signIn(page);
  await page.goto('/dashboard/settings/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load workspace settings.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Workspace name' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'malformed workspace settings').toEqual([]);
  await page.unroute('**/api/workspace/settings');
});
