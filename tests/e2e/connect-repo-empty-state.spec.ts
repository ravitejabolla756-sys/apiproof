import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('announces a connected GitHub app with no repositories available', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, repositories: [] }),
    });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  const emptyState = dialog.getByRole('status').filter({ hasText: 'No Repositories Available' });
  await expect(emptyState).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Adjust Repositories' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations, 'connected GitHub empty state').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.unroute('**/api/github/repositories');
});

test('announces when the GitHub app is not connected', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connected: false, repositories: [] }),
    });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  const disconnectedState = dialog.getByRole('status').filter({ hasText: 'GitHub App Not Connected' });
  await expect(disconnectedState).toBeVisible();
  await expect(disconnectedState).toHaveAttribute('aria-atomic', 'true');
  await expect(disconnectedState.getByRole('button', { name: 'Connect GitHub', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations, 'disconnected GitHub state').toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.unroute('**/api/github/repositories');
});
