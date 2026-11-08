import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

test('announces finding detail loading as a busy state', async ({ page }) => {
  await signIn(page);
  let releaseFinding: (() => void) | undefined;
  const findingLoading = new Promise<void>((resolve) => { releaseFinding = resolve; });
  await page.route('**/api/findings/finding_loading', async (route) => {
    await findingLoading;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ finding: null, migration: null }) });
  });
  await page.goto('/dashboard/findings/finding_loading', { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Loading AST finding workbench...' });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  releaseFinding?.();
  await expect(page.getByRole('alert').filter({ hasText: 'Finding not found or access denied.' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/findings/finding_loading');
});

test('keeps finding detail recovery visible and busy while retrying', async ({ page }) => {
  await signIn(page);
  let allowRecovery = false;
  let releaseRecovery: (() => void) | undefined;
  const recoveryPending = new Promise<void>((resolve) => { releaseRecovery = resolve; });
  await page.route('**/api/findings/finding_recovery', async (route) => {
    if (!allowRecovery) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Finding details are temporarily unavailable.' }) });
      return;
    }
    await recoveryPending;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        finding: {
          id: 'finding_recovery', provider: 'Fixture', change_id: 'change_recovery', title: 'Recovered finding',
          description: 'A recovered finding fixture.', severity: 'P1', confidence: 'high', file_path: 'src/example.ts',
          line_number: 12, symbol: 'example', reason: 'Fixture reason', source_snippet: 'example()', status: 'open',
          created_at: '2026-11-08T00:00:00.000Z', repo_name: 'owl', repo_full_name: 'fixture/owl', repo_owner: 'fixture',
          default_branch: 'main', evidence: [], reasonCodes: [], capability: null,
        },
        migration: null,
      }),
    });
  });
  await page.goto('/dashboard/findings/finding_recovery', { waitUntil: 'domcontentloaded' });
  const alert = page.getByRole('alert').filter({ hasText: 'Finding details are temporarily unavailable.' });
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toBeFocused();
  const retry = alert.getByRole('button');
  allowRecovery = true;
  await retry.click();
  await expect(alert).toBeVisible();
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveAttribute('aria-busy', 'true');
  releaseRecovery?.();
  await expect(page.getByRole('heading', { name: 'Recovered finding' })).toBeVisible({ timeout: 30_000 });
  await page.unroute('**/api/findings/finding_recovery');
});
