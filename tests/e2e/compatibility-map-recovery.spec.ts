import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('recovers compatibility-map initial and refresh failures', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  await page.route('**/api/compatibility-map', async (route) => {
    attempts += 1;
    if (attempts === 1 || attempts === 3) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Compatibility data could not be loaded (503).' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [{ id: 'compat-recovery', owner: 'fixture', name: 'compat-recovery', fullName: 'fixture/compat-recovery', defaultBranch: 'main', latestScanStatus: 'completed', latestCompletedScan: null, analysisEvidenceAvailable: true, integrations: [], openFindingCount: 0, findings: [] }] }) });
    }
  });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  const initialAlert = page.getByRole('alert').filter({ hasText: 'Compatibility data could not be loaded' });
  await expect(initialAlert).toBeVisible({ timeout: 30_000 });
  await initialAlert.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Compatibility topology' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Refresh compatibility map' }).click();
  const refreshAlert = page.getByRole('alert').filter({ hasText: 'Refresh failed:' });
  await expect(refreshAlert).toBeVisible({ timeout: 30_000 });
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'compatibility refresh error state').toEqual([]);
  await refreshAlert.getByRole('button', { name: 'Retry compatibility map refresh' }).click();
  await expect(refreshAlert).toBeHidden({ timeout: 30_000 });
  expect(attempts).toBeGreaterThanOrEqual(4);
  await page.unroute('**/api/compatibility-map');
});
