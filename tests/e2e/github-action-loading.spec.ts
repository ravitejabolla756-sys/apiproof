import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('marks GitHub authorization busy while the install request is pending', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' }, plan: { id: 'free', name: 'Free', description: 'Fixture plan', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } }, metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } } }) });
  });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });
  let releaseInstall: (() => void) | undefined;
  const installPending = new Promise<void>((resolve) => { releaseInstall = resolve; });
  await page.route('**/api/github/install', async (route) => {
    await installPending;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Failed to generate installation URL' }) });
  });
  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  const connect = page.locator('#main-content').getByRole('button', { name: 'Connect GitHub', exact: true });
  await expect(connect).toBeVisible({ timeout: 30_000 });
  await connect.click();
  await expect(connect).toHaveAttribute('aria-busy', 'true');
  releaseInstall?.();
  const alert = page.getByRole('alert').filter({ hasText: 'Failed to generate installation URL' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry GitHub connection' })).toBeVisible();
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
  await page.unroute('**/api/slack/connection');
  await page.unroute('**/api/github/install');
});
