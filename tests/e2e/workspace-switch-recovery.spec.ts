import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('recovers a failed workspace context switch', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  await page.route('**/api/workspaces', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeWorkspaceId: 'ws_primary', workspaces: [{ id: 'ws_primary', name: 'Primary Workspace' }, { id: 'ws_secondary', name: 'Secondary Workspace' }] }) });
  });
  await page.route('**/api/workspace/context', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace could not be changed.' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspace: { id: 'ws_secondary', name: 'Secondary Workspace', role: 'member' } }) });
    }
  });
  await page.goto('/dashboard');
  const selector = page.getByLabel('Active workspace');
  await expect(selector).toHaveValue('ws_primary', { timeout: 30_000 });
  await selector.selectOption('ws_secondary');
  const alert = page.getByRole('alert').filter({ hasText: 'Workspace could not be changed.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'workspace switch error').toEqual([]);
  await alert.getByRole('button', { name: 'Retry workspace switch' }).click();
  await expect.poll(() => attempts).toBe(2);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.unroute('**/api/workspaces');
  await page.unroute('**/api/workspace/context');
});
