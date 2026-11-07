import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('distinguishes filtered findings from an empty backend result', async ({ page }) => {
  await page.route('**/api/findings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ findings: [{
        id: 'finding-filter-state', provider: 'Fixture', change_id: 'change-filter-state', title: 'Fixture finding',
        description: 'A finding used to verify filtered empty-state recovery.', severity: 'high', confidence: 'high',
        file_path: 'src/example.ts', line_number: 12, symbol: 'example', status: 'open', created_at: '2026-11-08T00:00:00.000Z',
        repo_name: 'owl', repo_full_name: 'fixture/owl', capability: { migrationAvailable: false, recommendedNextAction: 'MANUAL_REVIEW' },
      }] }),
    });
  });
  await signIn(page);
  await page.goto('/dashboard/findings');
  await expect(page.getByRole('heading', { name: 'Fixture finding' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'critical' }).click();
  const filteredEmpty = page.getByRole('status').filter({ hasText: 'No findings match the current filters' });
  await expect(filteredEmpty).toBeVisible();
  await expect(filteredEmpty.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'filtered findings empty state').toEqual([]);
  const clearFilters = filteredEmpty.getByRole('button', { name: 'Clear filters' });
  await clearFilters.focus();
  await expect(clearFilters).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fixture finding' })).toBeVisible();
  await page.unroute('**/api/findings');
});
