import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('clears an inventory search that has no matches', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/inventory', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: [{
          id: 'inventory-filter',
          name: 'Example SDK',
          category: 'Payments',
          status: 'reviewed',
          rulesCount: 1,
          description: 'Fixture for inventory filter recovery.',
          rules: [{ id: 'rule-filter', title: 'Example rule', severity: 'warning', description: 'Fixture rule.' }],
        }],
      }),
    });
  });

  await page.goto('/dashboard/inventory', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Example SDK')).toBeVisible();

  const search = page.getByRole('textbox', { name: 'Filter provider integrations' });
  expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await search.fill('missing-provider');
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No provider rules match this filter' });
  await expect(filteredEmpty).toBeVisible();
  await expect(filteredEmpty.getByRole('button', { name: 'Clear filter' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'inventory filtered empty state').toEqual([]);

  const clearFilter = filteredEmpty.getByRole('button', { name: 'Clear filter' });
  expect((await clearFilter.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await clearFilter.focus();
  await expect(clearFilter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('');
  await expect(page.getByText('Example SDK')).toBeVisible();
  await page.unroute('**/api/inventory');
});

test('announces inventory loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseInventory: (() => void) | undefined;
  const inventoryLoading = new Promise<void>((resolve) => { releaseInventory = resolve; });
  await page.route('**/api/inventory', async (route) => {
    await inventoryLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: [] }) });
  });

  await page.goto('/dashboard/inventory', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading API provider registry...' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  releaseInventory?.();
  await expect(page.getByText('No API inventory records are available yet')).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/inventory');
});
