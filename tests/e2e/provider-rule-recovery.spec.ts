import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './helpers.js';

test('announces provider-rule loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseRules: (() => void) | undefined;
  const rulesLoading = new Promise<void>((resolve) => { releaseRules = resolve; });
  await page.route('**/api/provider-rules', async (route) => {
    await rulesLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [], coverageSummary: { candidates: 0, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } }) });
  });
  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading provider evidence…' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { name: 'Rule review' }).locator('..').locator('..').locator('..')).toHaveAttribute('aria-busy', 'true');
  releaseRules?.();
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/provider-rules');
});

test('keeps provider-rule load failures distinct from an empty queue', async ({ page }) => {
  await signIn(page);
  let attempts = 0;
  let allowRecovery = false;
  await page.route('**/api/provider-rules', async (route) => {
    attempts += 1;
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Provider rules are temporarily unavailable.' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [], coverageSummary: { candidates: 0, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } }) });
    }
  });
  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Provider rules are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include('[role="alert"]').analyze()).violations, 'provider-rule load error').toEqual([]);
  const retryProviderRules = alert.getByRole('button', { name: 'Retry provider rules' });
  await retryProviderRules.focus();
  await expect(retryProviderRules).toBeFocused();
  allowRecovery = true;
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toBeVisible({ timeout: 30_000 });
  expect(attempts).toBeGreaterThanOrEqual(2);
  await page.unroute('**/api/provider-rules');
});

test('keeps provider-rule recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  const emptyQueue = JSON.stringify({ candidates: [], coverageSummary: { candidates: 0, pendingCandidates: 0, reviewedCandidates: 0, reviewedProviders: 0, providersMissingReviewedRules: [], providersWithExecutableTemplates: [] } });
  await page.route('**/api/provider-rules', async (route) => {
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Provider rules are temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({ status: 200, contentType: 'application/json', body: emptyQueue });
  });
  await page.goto('/dashboard/rules/pending', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Provider rules are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  const retry = alert.getByRole('button', { name: 'Retry provider rules' });
  allowRecovery = true;
  await retry.click();
  await expect(alert).toBeVisible();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(page.getByRole('status').filter({ hasText: 'No provider rule candidates are waiting for review.' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/provider-rules');
});
