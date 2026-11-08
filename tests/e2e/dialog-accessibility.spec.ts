import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps authenticated dialog close controls touch-sized and recoverable on mobile', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');

  const searchTrigger = page.getByRole('button', { name: /Search repos, findings, SDKs/ });
  await searchTrigger.click();
  const commandPalette = page.getByRole('dialog', { name: 'Search MY OWL' });
  const closeSearch = commandPalette.getByRole('button', { name: 'Close search' });
  const commandSearch = commandPalette.getByRole('textbox', { name: 'Search repositories and workspace navigation' });
  await expect(commandSearch).toBeFocused();
  expect((await commandSearch.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await commandSearch.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  await closeSearch.focus();
  await expect(closeSearch).toBeFocused();
  expect((await closeSearch.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await closeSearch.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(searchTrigger).toBeFocused();

  await page.route('**/api/github/repositories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: false, repositories: [] }) });
  });
  await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
  const repositoryDialog = page.getByRole('dialog', { name: 'Connect GitHub Repository' });
  const closeRepositoryDialog = repositoryDialog.getByRole('button', { name: 'Close repository connection dialog' });
  await expect(closeRepositoryDialog).toBeFocused();
  await expect(closeRepositoryDialog.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  expect((await closeRepositoryDialog.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await closeRepositoryDialog.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(repositoryDialog).toHaveCount(0);
  await page.unroute('**/api/github/repositories');
});
