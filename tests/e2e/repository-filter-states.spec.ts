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
  const expandRepository = page.getByRole('button', { name: /^(Expand|Collapse) owl-platform$/ });
  if (await expandRepository.getAttribute('aria-expanded') !== 'true') await expandRepository.click();
  await expect(expandRepository).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Details for owl-platform' })).toBeVisible();
  await expandRepository.click();

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

test('contains long repository metadata in the expanded mobile state', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 844 });
  const longFullName = `fixture/${'repository-name-'.repeat(14)}`;
  await page.route('**/api/repositories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ repositories: [{
        id: 'repo-long-metadata', owner: 'fixture', name: 'long-repository', full_name: longFullName,
        github_repository_id: `github-${'id-'.repeat(30)}`, default_branch: 'feature/'.concat('long-branch-'.repeat(10)),
        status: 'connected', last_scan_at: null, created_at: '2026-11-10T00:00:00.000Z', findings_count: 0,
        scans_count: 0, last_scan_sha: null,
      }] }),
    });
  });
  await page.goto('/dashboard/repositories', { waitUntil: 'domcontentloaded' });
  const expandRepository = page.getByRole('button', { name: /^(Expand|Collapse) long-repository$/ });
  await expect(expandRepository).toBeVisible({ timeout: 30_000 });
  if (await expandRepository.getAttribute('aria-expanded') !== 'true') {
    await expandRepository.focus();
    await page.keyboard.press('Enter');
  }
  await expect(expandRepository).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Details for long-repository' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'long repository metadata').toEqual([]);
  await page.unroute('**/api/repositories');
});
