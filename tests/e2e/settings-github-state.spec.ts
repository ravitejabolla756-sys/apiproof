import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('announces the disconnected GitHub integration state', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
        plan: { id: 'free', name: 'Free', description: 'Fixture plan', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } },
        metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } },
      }),
    });
  });
  await page.route('**/api/slack/connection', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false }) });
  });

  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' });
  const githubState = page.getByRole('status').filter({ hasText: 'Not connected to GitHub' });
  await expect(githubState).toBeVisible();
  await expect(githubState).toHaveAttribute('aria-live', 'polite');
  await expect(githubState.getByRole('button', { name: 'Connect GitHub' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'GitHub disconnected settings state').toEqual([]);
  await page.unroute('**/api/github/repositories');
  await page.unroute('**/api/billing/subscription');
  await page.unroute('**/api/slack/connection');
});
