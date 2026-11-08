import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('wraps findings filters for multi-provider mobile results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  await page.route('**/api/findings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        findings: ['github', 'stripe', 'slack', 'twilio'].map((provider, index) => ({
          id: `finding-${provider}`,
          provider,
          change_id: `rule-${provider}`,
          title: `${provider} compatibility finding`,
          description: 'A fixture finding used to verify responsive filter recovery.',
          severity: index % 2 === 0 ? 'high' : 'critical',
          confidence: '0.9',
          file_path: 'src/integration.ts',
          line_number: index + 1,
          symbol: `call${index + 1}`,
          status: 'open',
          created_at: '2026-11-08T00:00:00.000Z',
          repo_name: 'fixture-repository',
          repo_full_name: 'fixture/fixture-repository',
          pr_number: null,
          pr_url: null,
          pr_state: null,
          capability: { migrationAvailable: false, recommendedNextAction: 'MANUAL_REVIEW' },
        })),
      }),
    });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'API Compatibility Findings' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('group', { name: 'Filter by provider' }).getByRole('button')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  const providerGroup = page.getByRole('group', { name: 'Filter by provider' });
  const githubFilter = providerGroup.getByRole('button', { name: 'github', exact: true });
  await githubFilter.focus();
  await expect(githubFilter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(githubFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'github compatibility finding' })).toBeVisible();

  const allProviders = providerGroup.getByRole('button', { name: 'all', exact: true });
  await allProviders.focus();
  await page.keyboard.press('Enter');
  await expect(allProviders).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'twilio compatibility finding' })).toBeVisible();
});

test('recovers from a filtered-empty findings state', async ({ page }) => {
  await signIn(page);

  await page.route('**/api/findings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        findings: [{
          id: 'finding-filter-recovery',
          provider: 'github',
          change_id: 'rule-filter-recovery',
          title: 'Filtered recovery finding',
          description: 'A fixture finding used to verify filtered-empty recovery.',
          severity: 'high',
          confidence: '0.9',
          file_path: 'src/integration.ts',
          line_number: 1,
          symbol: 'compatibilityCall',
          status: 'open',
          created_at: '2026-11-08T00:00:00.000Z',
          repo_name: 'fixture-repository',
          repo_full_name: 'fixture/fixture-repository',
          pr_number: null,
          pr_url: null,
          pr_state: null,
          capability: { migrationAvailable: false, recommendedNextAction: 'MANUAL_REVIEW' },
        }],
      }),
    });
  });

  await page.goto('/dashboard/findings', { waitUntil: 'domcontentloaded' });
  const search = page.getByRole('textbox', { name: 'Search findings' });
  await search.fill('does-not-match');
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No findings match the current filters' });
  await expect(filteredEmpty).toBeVisible({ timeout: 30_000 });
  await expect(filteredEmpty.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations).toEqual([]);

  const clearFilters = filteredEmpty.getByRole('button', { name: 'Clear filters' });
  await clearFilters.focus();
  await expect(clearFilters).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Filtered recovery finding' })).toBeVisible();
});
