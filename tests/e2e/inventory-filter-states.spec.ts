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
  await search.fill('missing-provider');
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No provider rules match this filter' });
  await expect(filteredEmpty).toBeVisible();
  await expect(filteredEmpty.getByRole('button', { name: 'Clear filter' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'inventory filtered empty state').toEqual([]);

  await filteredEmpty.getByRole('button', { name: 'Clear filter' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText('Example SDK')).toBeVisible();
  await page.unroute('**/api/inventory');
});
