import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('keeps provider-rule load failures distinct from an empty queue', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  await page.route('**/api/provider-rules', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Provider rules are temporarily unavailable.' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [], coverageSummary: { candidates: 0, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } }) });
    }
  });
  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Provider rules are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'provider-rule load error').toEqual([]);
  const retryProviderRules = alert.getByRole('button', { name: 'Retry provider rules' });
  await retryProviderRules.focus();
  await expect(retryProviderRules).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toBeVisible({ timeout: 30_000 });
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(attempts).toBeLessThanOrEqual(3);
  await page.unroute('**/api/provider-rules');
});
