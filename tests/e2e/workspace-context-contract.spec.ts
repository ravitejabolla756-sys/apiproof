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

test('recovers from a rejected workspace switch without losing the retry context', async ({ page }) => {
  let activeWorkspaceId = 'ws_primary';
  let switchAttempts = 0;
  let releaseRetry: (() => void) | undefined;
  const retryResponse = new Promise<void>((resolve) => { releaseRetry = resolve; });

  await page.route('**/api/workspaces', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeWorkspaceId,
        workspaces: [
          { id: 'ws_primary', name: 'Primary Workspace', role: 'owner' },
          { id: 'ws_secondary', name: 'Secondary Workspace', role: 'owner' },
        ],
      }),
    });
  });
  await page.route('**/api/workspace/context', async (route) => {
    switchAttempts += 1;
    if (switchAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace could not be changed.' }) });
      return;
    }
    await retryResponse;
    activeWorkspaceId = 'ws_secondary';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workspaceId: activeWorkspaceId }) });
  });

  await signIn(page);
  const sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
  const selector = sidebar.getByLabel('Active workspace');
  await expect(selector).toHaveValue('ws_primary');
  await selector.selectOption('ws_secondary');

  const alert = sidebar.getByRole('alert').filter({ hasText: 'Please try again.' });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  const retry = sidebar.getByRole('button', { name: /workspace switch/i });
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  await expect(retry).toHaveText('Retrying workspace switch…');
  releaseRetry?.();
  await expect.poll(() => switchAttempts).toBe(2);
  await page.unroute('**/api/workspace/context');
  await page.unroute('**/api/workspaces');
});
