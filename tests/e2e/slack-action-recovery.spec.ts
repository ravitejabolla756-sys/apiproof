import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('labels Slack connection recovery for the failed action', async ({ page }) => {
  await signIn(page);
  let connectAttempts = 0;
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });
  await page.route('**/api/slack/connect', async (route) => {
    connectAttempts += 1;
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Slack connection could not be started.' }) });
    } else {
      await recoveryPending;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/dashboard/settings?slack=connected' }) });
    }
  });
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Connect Slack' }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Slack connection could not be started.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert.getByRole('button', { name: 'Retry Slack connection' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry Slack status' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'Slack connection action error').toEqual([]);
  const retrySlack = alert.getByRole('button', { name: /Retry(?:ing)? Slack connection/ });
  await retrySlack.focus();
  await expect(retrySlack).toBeFocused();
  allowRecovery = true;
  await page.keyboard.press('Enter');
  await expect(alert).toBeVisible();
  await expect(retrySlack).toBeDisabled();
  await expect(retrySlack).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(page).toHaveURL(/\/dashboard\/settings\?slack=connected/);
  expect(connectAttempts).toBe(2);
  await page.unroute('**/api/slack/connection');
  await page.unroute('**/api/slack/connect');
});
