import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('fails closed when the workspace selector projection is inconsistent', async ({ page }) => {
  await page.route('**/api/workspaces', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activeWorkspaceId: 'ws_missing', workspaces: [{ id: 'ws_primary', name: 'Primary Workspace' }] }),
    });
  });

  await signIn(page);
  const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
  await expect(sidebar.getByRole('alert').filter({ hasText: 'Workspace list unavailable.' })).toBeVisible();
  await expect(sidebar.getByLabel('Active workspace')).toBeDisabled();
  expect((await new AxeBuilder({ page }).include('aside').analyze()).violations, 'malformed workspace projection').toEqual([]);
  await page.unroute('**/api/workspaces');
});
