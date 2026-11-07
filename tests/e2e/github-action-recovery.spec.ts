import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('labels GitHub installation recovery for the failed action', async ({ page }) => {
  await signIn(page);
  let installAttempts = 0;
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' }, plan: { id: 'free', name: 'Free', description: 'Fixture plan', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } }, metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } } }) });
  });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });
  await page.route('**/api/github/install', async (route) => {
    installAttempts += 1;
    if (installAttempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Failed to generate installation URL' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/dashboard/settings?github=connected' }) });
    }
  });
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  await page.locator('#main-content').getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Failed to generate installation URL' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert.getByRole('button', { name: 'Retry GitHub connection' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry settings load' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'GitHub connection action error').toEqual([]);
  const retryGitHub = alert.getByRole('button', { name: 'Retry GitHub connection' });
  await retryGitHub.focus();
  await expect(retryGitHub).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/settings\?github=connected/);
  expect(installAttempts).toBe(2);
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
  await page.unroute('**/api/slack/connection');
  await page.unroute('**/api/github/install');
});
