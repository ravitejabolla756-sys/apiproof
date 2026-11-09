import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('distinguishes filtered repository emptiness and clears filters', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/repositories', async (route) => {
    const repository = {
      id: 'repo-filter',
      owner: 'fixture',
      name: 'owl-platform',
      full_name: 'fixture/owl-platform',
      github_repository_id: 'repo-filter',
      default_branch: 'main',
      status: 'connected',
      last_scan_at: null,
      created_at: '2026-11-07T00:00:00.000Z',
      findings_count: 0,
      scans_count: 0,
      last_scan_sha: null,
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [repository] }) });
  });

  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'owl-platform' })).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Search repositories' });
  await expect(search).toHaveCSS('font-size', '16px');
  await search.fill('missing-repository');
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No repositories found matching your filter.' });
  await expect(filteredEmpty).toBeVisible();
  await expect(filteredEmpty.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'filtered repository empty state').toEqual([]);

  const clearFilters = filteredEmpty.getByRole('button', { name: 'Clear filters' });
  await clearFilters.focus();
  await expect(clearFilters).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('link', { name: 'owl-platform' })).toBeVisible();

  const healthFilters = page.getByRole('group', { name: 'Filter repositories by health' });
  const affected = healthFilters.getByRole('button', { name: 'affected', exact: true });
  await affected.focus();
  await expect(affected).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(affected).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'No repositories found matching your filter.' })).toBeVisible();

  const all = healthFilters.getByRole('button', { name: 'all', exact: true });
  await all.focus();
  await page.keyboard.press('Enter');
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'owl-platform' })).toBeVisible();
  await page.unroute('**/api/repositories');
});
