import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('announces a reviewed compatibility source with no records yet', async ({ page }) => {
  await page.route('**/api/compatibility-proof', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ claimsAvailable: true, reason: null, changes: [] }),
    });
  });
  await signIn(page);
  await page.goto('/dashboard/compatibility');
  const emptyState = page.getByRole('status').filter({ hasText: 'No reviewed compatibility records are available yet' });
  await expect(emptyState).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Reviewed records available')).toBeVisible();
  expect((await page.getByRole('button', { name: 'Refresh' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).include('#main-content').analyze()).violations, 'compatibility empty state').toEqual([]);
  await page.unroute('**/api/compatibility-proof');
});

test('announces compatibility loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseCompatibility: (() => void) | undefined;
  const compatibilityLoading = new Promise<void>((resolve) => { releaseCompatibility = resolve; });
  await page.route('**/api/compatibility-proof', async (route) => {
    await compatibilityLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ claimsAvailable: false, reason: 'fixture', changes: [] }) });
  });

  await page.goto('/dashboard/compatibility', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading reviewed compatibility records...' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  releaseCompatibility?.();
  await expect(page.getByText('No reviewed compatibility claims are available')).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/compatibility-proof');
});
