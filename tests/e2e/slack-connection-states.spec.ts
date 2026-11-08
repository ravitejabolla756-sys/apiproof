import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('announces Slack disconnect progress', async ({ page }) => {
  await signIn(page);
  let releaseDelete: (() => void) | undefined;
  const deletePending = new Promise<void>((resolve) => { releaseDelete = resolve; });
  await page.route('**/api/slack/connection', async (route) => {
    if (route.request().method() === 'DELETE') {
      await deletePending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, teamName: 'Fixture Slack' }) });
  });
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  const deleteResponse = page.waitForResponse((response) => response.url().includes('/api/slack/connection') && response.request().method() === 'DELETE');
  const disconnect = page.getByRole('button', { name: 'Disconnect' });
  await disconnect.focus();
  await expect(disconnect).toBeFocused();
  await page.keyboard.press('Enter');
  const progress = page.getByRole('status').filter({ hasText: 'Disconnecting Slack…' });
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute('aria-live', 'polite');
  await expect(progress).toHaveAttribute('aria-atomic', 'true');
  await expect(disconnect).toHaveAttribute('aria-busy', 'true');
  releaseDelete?.();
  await deleteResponse;
  await page.unroute('**/api/slack/connection');
});
