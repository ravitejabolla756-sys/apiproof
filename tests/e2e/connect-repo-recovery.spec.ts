import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps initial GitHub repository failures distinct from a disconnected app', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  let modalOpen = false;
  await page.route('**/api/github/repositories', async (route) => {
    attempts += 1;
    if (modalOpen && attempts === 2) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Failed to load GitHub repositories.' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
    }
  });
  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  modalOpen = true;
  await page.getByRole('button', { name: 'Connect repository', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  const unavailable = dialog.getByRole('alert').filter({ hasText: 'GitHub repositories are temporarily unavailable.' });
  await expect(unavailable).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('status').filter({ hasText: 'GitHub App Not Connected' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations, 'GitHub repository load failure').toEqual([]);
  const retryRepositories = unavailable.getByRole('button', { name: 'Retry repositories' });
  await retryRepositories.focus();
  await expect(retryRepositories).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('status').filter({ hasText: 'GitHub App Not Connected' })).toBeVisible({ timeout: 30_000 });
  expect(attempts).toBe(3);
  await page.getByRole('button', { name: 'Close repository connection dialog' }).click();
  await page.unroute('**/api/github/repositories');
});

test('traps repository dialog focus and restores the invoking control on Escape', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  const openButton = page.getByRole('button', { name: 'Connect repository', exact: true });
  await openButton.click();
  const dialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  const closeButton = dialog.getByRole('button', { name: 'Close repository connection dialog' });
  const connectGitHub = dialog.getByRole('button', { name: 'Connect GitHub', exact: true });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(connectGitHub).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'repository dialog dismissal').toEqual([]);
  await page.unroute('**/api/github/repositories');
});
